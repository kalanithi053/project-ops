"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { taskActivityKey } from "@/lib/api/hooks/use-tasks";
import type {
  CreateTaskCommentDto,
  TaskComment,
  UpdateTaskCommentDto,
} from "@/lib/api/types";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";

export function taskCommentsKey(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
) {
  return ["task-comments", workspaceSlug, projectId, taskId] as const;
}

/** GET /projects/:projectId/tasks/:taskId/comments — oldest first. */
export function useTaskComments(
  workspaceSlug: string,
  projectId: string,
  taskId?: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: taskCommentsKey(workspaceSlug, projectId, taskId ?? ""),
    queryFn: () =>
      apiFetch<TaskComment[]>(
        `/projects/${projectId}/tasks/${taskId}/comments`,
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && projectId && taskId),
  });
}

/** POST /projects/:projectId/tasks/:taskId/comments — requires comment.create. */
export function useCreateTaskComment(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTaskCommentDto) =>
      apiFetch<TaskComment>(`/projects/${projectId}/tasks/${taskId}/comments`, {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: taskCommentsKey(workspaceSlug, projectId, taskId),
      });
      queryClient.invalidateQueries({
        queryKey: taskActivityKey(workspaceSlug, projectId, taskId),
      });
      toast.success("Comment added");
    },
  });
}

function invalidateTaskCommentData(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  projectId: string,
  taskId: string,
) {
  queryClient.invalidateQueries({
    queryKey: taskCommentsKey(workspaceSlug, projectId, taskId),
  });
  queryClient.invalidateQueries({
    queryKey: taskActivityKey(workspaceSlug, projectId, taskId),
  });
}

/** PATCH /projects/:projectId/tasks/:taskId/comments/:commentId. */
export function useUpdateTaskComment(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskCommentDto }) =>
      apiFetch<TaskComment>(
        `/projects/${projectId}/tasks/${taskId}/comments/${id}`,
        { method: "PATCH", body: dto, workspaceSlug },
      ),
    onSuccess: () => {
      invalidateTaskCommentData(queryClient, workspaceSlug, projectId, taskId);
      toast.success("Comment updated");
    },
  });
}

/** DELETE /projects/:projectId/tasks/:taskId/comments/:commentId. */
export function useDeleteTaskComment(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; deleted: boolean }>(
        `/projects/${projectId}/tasks/${taskId}/comments/${id}`,
        { method: "DELETE", workspaceSlug },
      ),
    onSuccess: () => {
      invalidateTaskCommentData(queryClient, workspaceSlug, projectId, taskId);
      toast.success("Comment deleted");
    },
  });
}
