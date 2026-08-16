"use client";

import * as React from "react";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type {
  CreateTaskDto,
  Task,
  TaskActivityPage,
  TaskStatusRef,
  UpdateTaskDto,
  WorkTypeCategory,
} from "@/lib/api/types";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";

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
  /** Work items with no WorkType are treated server-side as "task". */
  category?: WorkTypeCategory;
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
  options?: { enabled?: boolean },
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
        `/projects/${projectId}/work-items${queryString ? `?${queryString}` : ""}`,
        { workspaceSlug },
      ),
    enabled:
      Boolean(token && workspaceSlug && projectId) &&
      (options?.enabled ?? true),
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
      apiFetch<Task>(`/projects/${projectId}/work-items/${taskId}`, {
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

/** Entries per page for useTaskActivity's infinite scroll. */
export const TASK_ACTIVITY_PAGE_SIZE = 10;

/**
 * GET /projects/:projectId/tasks/:taskId/activity — newest first, paginated
 * 10 at a time. Call `fetchNextPage()` (e.g. from a scroll sentinel) to load
 * the next (older) page; `data.pages` is the ordered list of fetched pages.
 */
export function useTaskActivity(
  workspaceSlug: string,
  projectId: string,
  taskId?: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useInfiniteQuery({
    queryKey: taskActivityKey(workspaceSlug, projectId, taskId ?? ""),
    queryFn: ({ pageParam }) =>
      apiFetch<TaskActivityPage>(
        `/projects/${projectId}/work-items/${taskId}/activity?page=${pageParam}&limit=${TASK_ACTIVITY_PAGE_SIZE}`,
        { workspaceSlug },
      ),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, page) => sum + page.items.length, 0);
      return loaded < lastPage.total ? allPages.length + 1 : undefined;
    },
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
      apiFetch<Task>(`/projects/${projectId}/work-items`, {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({
        queryKey: tasksKey(workspaceSlug, projectId),
      });
      // Module instances meter overflow via addonTask, and the project header
      // shows a task count — both shift when a task is added.
      queryClient.invalidateQueries({
        queryKey: ["project", workspaceSlug, projectId],
      });
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
      apiFetch<Task>(`/projects/${projectId}/work-items/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (task) => {
      queryClient.invalidateQueries({
        queryKey: tasksKey(workspaceSlug, projectId),
      });
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

/** Applies a batch of position/status placements to a cached task list. */
function applyPlacements(
  current: Task[] | undefined,
  placements: TaskPlacement[],
): Task[] {
  const byId = new Map(placements.map((p) => [p.id, p]));
  return (current ?? []).map((task) => {
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
  });
}

/**
 * Commits a drag on the board: moves a task between columns and/or reorders
 * it. `position` is a gap-based (fractional-indexing) value — the caller
 * (task-board.tsx's handleDragEnd) normally computes just the dragged row's
 * new midpoint value, so this is usually a single PATCH, not a renumber of
 * the whole column. It falls back to renumbering only that one column when
 * two neighbors have no room left between them.
 *
 * Drag is also the one interaction that can't wait for the server: without an
 * optimistic write the card visibly snaps back until the PATCH resolves. The
 * write has to happen through the returned `reorder()` function rather than
 * TanStack Query's own `onMutate` lifecycle — `mutate()` reaches `onMutate`
 * through at least one internal `await`, so by the time it runs, dnd-kit has
 * already reset the dragged card's transform against the *old* order (a
 * visible "snap back to start, then jump to the real spot" glitch). Writing
 * the cache before `mutate()` is even called closes that gap: the reorder and
 * `setActiveItem(null)` land in the same synchronous event-handler tick, so
 * React batches them into one commit.
 *
 * Reads/writes go through `getQueriesData`/`setQueriesData` — a *prefix*
 * match on `tasksKey(...)` — rather than `getQueryData`/`setQueryData`'s
 * exact-key match. `useTasks` appends a filters-derived query string onto
 * this same prefix (`[...tasksKey(...), queryString]`), so an exact-key
 * lookup for the bare prefix would silently miss the board's real (filtered)
 * cache entry every time — the optimistic write would then land nowhere any
 * mounted `useTasks` observer is subscribed to, so the board keeps showing
 * the pre-drag order until an unrelated refetch happens to correct it.
 */
export function useReorderTasks(workspaceSlug: string, projectId: string) {
  const queryClient = useQueryClient();
  const keyPrefix = tasksKey(workspaceSlug, projectId);
  const previousRef = React.useRef<
    Array<[readonly unknown[], Task[] | undefined]>
  >([]);

  const mutation = useMutation({
    mutationFn: (placements: TaskPlacement[]) =>
      Promise.all(
        placements.map(({ id, position, statusId }) =>
          apiFetch<Task>(`/projects/${projectId}/work-items/${id}`, {
            method: "PATCH",
            body: statusId ? { statusId, position } : { position },
            workspaceSlug,
          }),
        ),
      ),

    onError: () => {
      for (const [queryKey, data] of previousRef.current) {
        queryClient.setQueryData(queryKey, data);
      }
    },

    // Each PATCH response already carries the authoritative position/status
    // for the row it updated — merge those in directly instead of
    // invalidating, which would fire a whole extra list refetch after every
    // single drag for no reason.
    onSuccess: (updated) => {
      const byId = new Map(updated.map((task) => [task.id, task]));
      queryClient.setQueriesData<Task[]>({ queryKey: keyPrefix }, (current) =>
        (current ?? []).map((task) => byId.get(task.id) ?? task),
      );
    },
  });

  return {
    ...mutation,
    reorder: (
      placements: TaskPlacement[],
      options?: { onSuccess?: () => void },
    ) => {
      previousRef.current = queryClient.getQueriesData<Task[]>({
        queryKey: keyPrefix,
      });
      queryClient.setQueriesData<Task[]>({ queryKey: keyPrefix }, (current) =>
        applyPlacements(current, placements),
      );
      // Fire-and-forget: aborts any in-flight refetch so it can't clobber the
      // write above with stale data: the promise's own resolution isn't
      // needed before proceeding.
      queryClient.cancelQueries({ queryKey: keyPrefix });
      mutation.mutate(placements, options);
    },
  };
}

/** POST /projects/:projectId/work-items/:taskId/notify — email the assignee. */
export function useNotifyTaskAssignee(
  workspaceSlug: string,
  projectId: string,
) {
  return useMutation({
    mutationFn: (taskId: string) =>
      apiFetch<{ notified: boolean; assignee: string }>(
        `/projects/${projectId}/work-items/${taskId}/notify`,
        { method: "POST", workspaceSlug },
      ),
    onSuccess: () => toast.success("Work item assignee notified"),
  });
}
