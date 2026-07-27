"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDownload, apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type { TaskAttachment } from "@/lib/api/types";

/** Matches the backend's multer limit — rejected client-side first. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Human-readable file size, e.g. "1.4 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function taskAttachmentsKey(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
) {
  return ["attachments", workspaceSlug, projectId, taskId] as const;
}

/** GET /projects/:projectId/tasks/:taskId/attachments */
export function useTaskAttachments(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: taskAttachmentsKey(workspaceSlug, projectId, taskId),
    queryFn: () =>
      apiFetch<TaskAttachment[]>(
        `/projects/${projectId}/tasks/${taskId}/attachments`,
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && projectId && taskId),
  });
}

/** GET /projects/:projectId/attachments — every document in the project. */
export function useProjectAttachments(
  workspaceSlug: string,
  projectId: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["attachments", workspaceSlug, projectId],
    queryFn: () =>
      apiFetch<TaskAttachment[]>(`/projects/${projectId}/attachments`, {
        workspaceSlug,
      }),
    enabled: Boolean(token && workspaceSlug && projectId),
  });
}

/**
 * POST a file as multipart/form-data.
 *
 * The client detects FormData and leaves Content-Type unset so the browser
 * can attach the multipart boundary itself.
 */
export function useUploadAttachment(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append("file", file);
      return apiFetch<TaskAttachment>(
        `/projects/${projectId}/tasks/${taskId}/attachments`,
        { method: "POST", body, workspaceSlug },
      );
    },
    onSuccess: (attachment) => {
      queryClient.invalidateQueries({
        queryKey: ["attachments", workspaceSlug, projectId],
      });
      toast.success("File attached", attachment?.fileName);
    },
  });
}

/** DELETE an attachment and its bytes. */
export function useDeleteAttachment(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiFetch<{ id: string; deleted: boolean }>(
        `/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`,
        { method: "DELETE", workspaceSlug },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["attachments", workspaceSlug, projectId],
      });
      toast.success("File removed");
    },
  });
}

/**
 * Downloads an attachment through the authenticated API.
 *
 * Files aren't served from a public folder, so the bytes have to be fetched
 * with the bearer token and handed to the browser as a temporary object URL —
 * a plain link would 401.
 */
export async function downloadAttachment(
  workspaceSlug: string,
  projectId: string,
  taskId: string,
  attachment: Pick<TaskAttachment, "id" | "fileName">,
): Promise<void> {
  const blob = await apiDownload(
    `/projects/${projectId}/tasks/${taskId}/attachments/${attachment.id}/download`,
    { workspaceSlug },
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = attachment.fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
