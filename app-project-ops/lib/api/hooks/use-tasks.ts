"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type {
  CreateTaskDto,
  Task,
  TaskActivityEntry,
  TaskStatusRef,
  UpdateTaskDto,
} from "@/lib/api/types";

/** Query key for a project's task list. */
export function tasksKey(workspaceSlug: string, projectId: string) {
  return ["tasks", workspaceSlug, projectId] as const;
}

export interface TaskListFilters {
  moduleInstanceId?: string;
  moduleInstanceIds?: string[];
  statusId?: string;
  statusIds?: string[];
  priorityId?: string;
  search?: string;
  assigneeIds?: string[];
  startDate?: string;
  endDate?: string;
}

/**
 * GET /projects/:projectId/tasks — every live task in the project, ordered by
 * position then creation.
 *
 * The whole board reads from this one query and groups client-side. The API
 * can filter by a single statusId, but a board needs every column at once and
 * there's no pagination, so one fetch is both simpler and fewer requests.
 */
export function useTasks(
  workspaceSlug: string,
  projectId: string,
  filters: TaskListFilters = {},
) {
  const token = useAuthStore((state) => state.accessToken);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value) {
      params.set(key, value);
    }
  }
  const queryString = params.toString();
  return useQuery({
    queryKey: [...tasksKey(workspaceSlug, projectId), queryString],
    queryFn: () =>
      apiFetch<Task[]>(
        `/projects/${projectId}/tasks${queryString ? `?${queryString}` : ""}`,
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && projectId),
  });
}

/** GET /projects/:projectId/tasks/:taskId — one task for the task editor. */
export function useTask(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["task", workspaceSlug, projectId, taskId],
    queryFn: () =>
      apiFetch<Task>(`/projects/${projectId}/tasks/${taskId}`, {
        workspaceSlug,
      }),
    enabled: Boolean(token && workspaceSlug && projectId && taskId),
  });
}

export function taskActivityKey(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
) {
  return ["task-activity", workspaceSlug, projectId, taskId] as const;
}

/** GET /projects/:projectId/tasks/:taskId/activity — oldest first. */
export function useTaskActivity(
  workspaceSlug: string,
  projectId: string,
  taskId?: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: taskActivityKey(workspaceSlug, projectId, taskId ?? ""),
    queryFn: () =>
      apiFetch<TaskActivityEntry[]>(
        `/projects/${projectId}/tasks/${taskId}/activity`,
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && projectId && taskId),
  });
}

/**
 * POST /projects/:projectId/tasks — requires `task.create`.
 *
 * The response is a bare task with no nested status/priority/assignee, so the
 * list is refetched rather than appended to.
 */
export function useCreateTask(workspaceSlug: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTaskDto) =>
      apiFetch<Task>(`/projects/${projectId}/tasks`, {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: tasksKey(workspaceSlug, projectId) });
      // Module instances meter overflow via addonTask, and the project header
      // shows a task count — both shift when a task is added.
      queryClient.invalidateQueries({ queryKey: ["project", workspaceSlug, projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceSlug] });
      toast.success("Task created", task?.name);
    },
  });
}

/** PATCH /projects/:projectId/tasks/:taskId — requires `task.update`. */
export function useUpdateTask(workspaceSlug: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskDto }) =>
      apiFetch<Task>(`/projects/${projectId}/tasks/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({ queryKey: tasksKey(workspaceSlug, projectId) });
      queryClient.invalidateQueries({
        queryKey: ["task", workspaceSlug, projectId, task.id],
      });
      queryClient.invalidateQueries({
        queryKey: taskActivityKey(workspaceSlug, projectId, task.id),
      });
      toast.success("Task updated", task?.name);
    },
  });
}

/** One task's new place on the board. */
export interface TaskPlacement {
  id: string;
  position: number;
  /** Omit to reorder within the task's current column. */
  statusId?: string;
  /**
   * Client-side only — never sent. Lets the optimistic write relabel a card
   * that changed column, since the PATCH response carries no nested status.
   */
  status?: TaskStatusRef | null;
}

/**
 * Commits a drag on the board: moves a task between columns and/or reorders
 * it, renumbering the affected column so positions stay monotonic.
 *
 * `position` is a flat Int across the whole project with no gap strategy and
 * no bulk endpoint, so there's no midpoint to slot into — the caller
 * renumbers the touched column and this issues one PATCH per task whose
 * position actually changed. Columns are small, so that stays a handful of
 * requests.
 *
 * Drag is also the one interaction that can't wait for the server: without an
 * optimistic write the card visibly snaps back until the PATCH resolves. So
 * the cache is rewritten immediately and rolled back on failure. No success
 * toast — the card landing *is* the feedback.
 */
export function useReorderTasks(workspaceSlug: string, projectId: string) {
  const queryClient = useQueryClient();
  const key = tasksKey(workspaceSlug, projectId);

  return useMutation({
    mutationFn: (placements: TaskPlacement[]) =>
      Promise.all(
        placements.map(({ id, position, statusId }) =>
          apiFetch<Task>(`/projects/${projectId}/tasks/${id}`, {
            method: "PATCH",
            body: statusId ? { statusId, position } : { position },
            workspaceSlug,
          }),
        ),
      ),

    onMutate: async (placements) => {
      // Stop any in-flight refetch from clobbering the optimistic write.
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Task[]>(key);
      const byId = new Map(placements.map((p) => [p.id, p]));

      queryClient.setQueryData<Task[]>(key, (current) =>
        (current ?? []).map((task) => {
          const placement = byId.get(task.id);
          if (!placement) return task;
          return {
            ...task,
            position: placement.position,
            ...(placement.statusId
              ? {
                  statusId: placement.statusId,
                  status: placement.status ?? task.status,
                }
              : {}),
          };
        }),
      );

      return { previous };
    },

    onError: (_error, _placements, context) => {
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },

    // Reconcile either way — the PATCH response has no nested objects.
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });
}

/** POST /projects/:projectId/tasks/:taskId/notify — email the assignee. */
export function useNotifyTaskAssignee(
  workspaceSlug: string,
  projectId: string,
) {
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<{ notified: boolean; assignee: string }>(
        `/projects/${projectId}/tasks/${taskId}/notify`,
        { method: "POST", workspaceSlug },
      ),
    onSuccess: () => toast.success("Task assignee notified"),
  });
}
