"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDownload, apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type { ProjectAttachment } from "@/lib/api/types";
// Generic, non-task-specific helpers shared with the task-level attachments
// feature — the byte limit mirrors the backend's multer config exactly.
import { MAX_ATTACHMENT_BYTES, formatBytes } from "@/lib/api/hooks/use-attachments";

export { MAX_ATTACHMENT_BYTES, formatBytes };

function projectAttachmentsKey(workspaceSlug: string, projectId: string) {
  return ["project-attachments", workspaceSlug, projectId] as const;
}

/** GET /projects/:projectId/attachments */
export function useProjectAttachments(
  workspaceSlug: string,
  projectId: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: projectAttachmentsKey(workspaceSlug, projectId),
    queryFn: () =>
      apiFetch<ProjectAttachment[]>(`/projects/${projectId}/attachments`, {
        workspaceSlug,
      }),
    enabled: Boolean(token && workspaceSlug && projectId),
  });
}

/** POST a file as multipart/form-data — used directly by uploadProjectAttachment too. */
function uploadFile(
  workspaceSlug: string,
  projectId: string,
  file: File,
): Promise<ProjectAttachment> {
  const body = new FormData();
  body.append("file", file);
  return apiFetch<ProjectAttachment>(`/projects/${projectId}/attachments`, {
    method: "POST",
    body,
    workspaceSlug,
  });
}

export function useUploadProjectAttachment(
  workspaceSlug: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadFile(workspaceSlug, projectId, file),
    onSuccess: (attachment) => {
      queryClient.invalidateQueries({
        queryKey: projectAttachmentsKey(workspaceSlug, projectId),
      });
      toast.success("File attached", attachment?.fileName);
    },
  });
}

/**
 * One-off upload outside the mutation/component lifecycle — for staging
 * files in the "New project" form and uploading them right after the
 * project is created (no project id exists yet while the form is open, so
 * this can't be a normal per-project `useMutation`).
 */
export function uploadProjectAttachment(
  workspaceSlug: string,
  projectId: string,
  file: File,
): Promise<ProjectAttachment> {
  return uploadFile(workspaceSlug, projectId, file);
}

export function useDeleteProjectAttachment(
  workspaceSlug: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachmentId: string) =>
      apiFetch<{ id: string; deleted: boolean }>(
        `/projects/${projectId}/attachments/${attachmentId}`,
        { method: "DELETE", workspaceSlug },
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: projectAttachmentsKey(workspaceSlug, projectId),
      });
      toast.success("File removed");
    },
  });
}

/** Downloads an attachment through the authenticated API — same pattern as task attachments. */
export async function downloadProjectAttachment(
  workspaceSlug: string,
  projectId: string,
  attachment: Pick<ProjectAttachment, "id" | "fileName">,
): Promise<void> {
  const blob = await apiDownload(
    `/projects/${projectId}/attachments/${attachment.id}/download`,
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

/** Whether an attachment's bytes can be shown inline as an image preview. */
export function isPreviewableImage(mimeType: string): boolean {
  return mimeType.startsWith("image/");
}

/**
 * Fetches an attachment's bytes as a viewable blob URL — used for the
 * inline row thumbnail and the click-to-expand preview dialog.
 *
 * Unlike `useResolveAttachmentImages`, revoking the object URL in cleanup is
 * safe here: a plain `useState` (not a DOM marker) tracks the fetch, so
 * Strict Mode's dev-mode double-invoke just starts a fresh fetch on remount
 * instead of racing a stale "already resolved" flag.
 */
export function useAttachmentPreviewUrl(
  workspaceSlug: string,
  projectId: string,
  attachment: Pick<ProjectAttachment, "id"> | null,
): { url: string | null; isError: boolean } {
  const attachmentId = attachment?.id ?? null;
  // Keyed by attachmentId (rather than reset with a synchronous setState at
  // the top of the effect) so a stale result from a just-superseded fetch is
  // recognized and ignored below instead of ever being written to state.
  const [result, setResult] = React.useState<{
    id: string;
    url: string | null;
    isError: boolean;
  } | null>(null);

  React.useEffect(() => {
    if (!attachmentId || !workspaceSlug || !projectId) return;

    let cancelled = false;
    let objectUrl: string | null = null;

    (async () => {
      try {
        const blob = await apiDownload(
          `/projects/${projectId}/attachments/${attachmentId}/download`,
          { workspaceSlug },
        );
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setResult({ id: attachmentId, url: objectUrl, isError: false });
      } catch {
        if (!cancelled) setResult({ id: attachmentId, url: null, isError: true });
      }
    })();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [workspaceSlug, projectId, attachmentId]);

  if (!attachmentId || result?.id !== attachmentId) {
    return { url: null, isError: false };
  }
  return { url: result.url, isError: result.isError };
}

/**
 * Resolves every `<img data-attachment-id>` inside a container to a viewable
 * blob URL, fetched through the authenticated download endpoint.
 *
 * Rich-text image `src` values only ever hold a same-session `blob:` preview
 * (set at insert time) — they're dead on arrival in any later session, since
 * blob URLs don't survive a reload. So this doesn't trust `src` at all: it
 * tracks "already resolved" via a `data-resolved` DOM marker and re-fetches
 * everything else.
 *
 * Watches the container with a MutationObserver instead of scanning once at
 * effect-setup, because React sometimes re-commits the `dangerouslySetInnerHTML`
 * content a second time shortly after the initial mount (observed via
 * childList mutations replacing the same img node) even though the source
 * HTML string is unchanged — a one-shot scan resolves the *original* node
 * while a fresh, unresolved replacement silently takes its place in the DOM,
 * leaving a permanently broken image. Re-scanning on every mutation makes
 * resolution self-healing regardless of how many times that happens.
 *
 * Deliberately never revokes the object URLs it creates — revoking on
 * cleanup would race the next scan finding the same node "already resolved"
 * and skipping it. A handful of images per description is nowhere near
 * enough for the unrevoked URLs to matter memory-wise before the tab/page
 * unloads.
 */
export function useResolveAttachmentImages(
  containerRef: React.RefObject<HTMLElement | null>,
  workspaceSlug: string,
  projectId: string,
  deps: React.DependencyList,
) {
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container || !workspaceSlug || !projectId) return;

    let cancelled = false;
    const inFlight = new WeakSet<HTMLImageElement>();

    function resolveImage(img: HTMLImageElement) {
      if (inFlight.has(img)) return;
      const attachmentId = img.dataset.attachmentId;
      if (!attachmentId) return;
      inFlight.add(img);
      apiDownload(
        `/projects/${projectId}/attachments/${attachmentId}/download`,
        { workspaceSlug },
      )
        .then((blob) => {
          if (cancelled) return;
          img.src = URL.createObjectURL(blob);
          img.dataset.resolved = "true";
        })
        .catch(() => {
          // Leave it broken — the alt text still shows, and the surrounding
          // text isn't worth failing to render over one missing image.
        });
    }

    const scan = () => {
      container
        .querySelectorAll<HTMLImageElement>(
          "img[data-attachment-id]:not([data-resolved])",
        )
        .forEach(resolveImage);
    };

    scan();
    const observer = new MutationObserver(scan);
    observer.observe(container, { childList: true, subtree: true });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
