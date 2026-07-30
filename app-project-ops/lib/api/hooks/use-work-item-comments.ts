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

export type CommentableItemType = "task" | "incident";

function commentsKey(
  workspaceSlug: string,
  projectId: string,
  itemType: CommentableItemType,
  itemId: string,
) {
  return ["comments", itemType, workspaceSlug, projectId, itemId] as const;
}

// Every commentable item (task/incident/bug) is now a WorkItem under one
// unified endpoint — itemType is kept only to key the query cache per editor.
function commentPath(projectId: string, itemId: string) {
  return `/projects/${projectId}/work-items/${itemId}/comments`;
}

function invalidateComments(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  projectId: string,
  itemType: CommentableItemType,
  itemId: string,
) {
  queryClient.invalidateQueries({
    queryKey: commentsKey(workspaceSlug, projectId, itemType, itemId),
  });
  queryClient.invalidateQueries({
    queryKey: taskActivityKey(workspaceSlug, projectId, itemId),
  });
}

export function useWorkItemComments(
  workspaceSlug: string,
  projectId: string,
  itemType: CommentableItemType,
  itemId?: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: commentsKey(workspaceSlug, projectId, itemType, itemId ?? ""),
    queryFn: () =>
      apiFetch<TaskComment[]>(
        commentPath(projectId, itemId ?? ""),
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && projectId && itemId),
  });
}

export function useCreateWorkItemComment(
  workspaceSlug: string,
  projectId: string,
  itemType: CommentableItemType,
  itemId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTaskCommentDto) =>
      apiFetch<TaskComment>(commentPath(projectId, itemId), {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: () => {
      invalidateComments(queryClient, workspaceSlug, projectId, itemType, itemId);
      toast.success("Comment added");
    },
  });
}

export function useUpdateWorkItemComment(
  workspaceSlug: string,
  projectId: string,
  itemType: CommentableItemType,
  itemId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTaskCommentDto }) =>
      apiFetch<TaskComment>(`${commentPath(projectId, itemId)}/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: () => {
      invalidateComments(queryClient, workspaceSlug, projectId, itemType, itemId);
      toast.success("Comment updated");
    },
  });
}

export function useDeleteWorkItemComment(
  workspaceSlug: string,
  projectId: string,
  itemType: CommentableItemType,
  itemId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; deleted: boolean }>(
        `${commentPath(projectId, itemId)}/${id}`,
        { method: "DELETE", workspaceSlug },
      ),
    onSuccess: () => {
      invalidateComments(queryClient, workspaceSlug, projectId, itemType, itemId);
      toast.success("Comment deleted");
    },
  });
}
