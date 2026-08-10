"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { QueryState } from "@/components/shared/query-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast/toast-store";
import {
  ATTACHMENT_ACCEPT,
  MAX_ATTACHMENT_BYTES,
  downloadProjectAttachment,
  formatBytes,
  isAllowedAttachmentFile,
  isPreviewableImage,
  projectAttachmentsKey,
  uploadProjectAttachment,
  useAttachmentPreviewUrl,
  useDeleteProjectAttachment,
  useProjectAttachments,
} from "@/lib/api/hooks/use-project-attachments";
import type { ProjectAttachment } from "@/lib/api/types";

/** One file mid-upload, tracked locally so each has its own progress bar. */
interface UploadingFile {
  id: string;
  name: string;
  progress: number;
}

function uploaderName(uploader: ProjectAttachment["uploader"]): string {
  if (!uploader) return "";
  const name = [uploader.firstName, uploader.lastName]
    .filter(Boolean)
    .join(" ");
  return name || uploader.email;
}

/** Small inline thumbnail for an image attachment, falling back to a generic icon. */
function AttachmentThumbnail({
  workspaceSlug,
  projectId,
  attachment,
  onPreview,
}: {
  workspaceSlug: string;
  projectId: string;
  attachment: ProjectAttachment;
  onPreview: () => void;
}) {
  const isImage = isPreviewableImage(attachment.mimeType);
  const { url } = useAttachmentPreviewUrl(
    workspaceSlug,
    projectId,
    isImage ? attachment : null,
  );

  if (!isImage) {
    return <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />;
  }

  return (
    <button
      type="button"
      onClick={onPreview}
      disabled={!url}
      aria-label={`Preview ${attachment.fileName}`}
      className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-muted/40"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
      )}
    </button>
  );
}

/** Full-size lightbox for an image attachment, opened by clicking its thumbnail. */
function AttachmentPreviewDialog({
  workspaceSlug,
  projectId,
  attachment,
  onClose,
}: {
  workspaceSlug: string;
  projectId: string;
  attachment: ProjectAttachment | null;
  onClose: () => void;
}) {
  const { url, isError } = useAttachmentPreviewUrl(
    workspaceSlug,
    projectId,
    attachment,
  );

  return (
    <Dialog open={Boolean(attachment)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">
            {attachment?.fileName}
          </DialogTitle>
        </DialogHeader>
        <div className="flex max-h-[70vh] items-center justify-center overflow-auto rounded-md bg-muted/30">
          {isError ? (
            <p className="p-8 text-sm text-muted-foreground">
              Couldn&apos;t load this preview.
            </p>
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={attachment?.fileName ?? ""}
              className="max-h-[70vh] w-auto object-contain"
            />
          ) : (
            <Loader2 className="m-8 h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Project-level file manager: drop zone for uploads, a list of everything
 * already attached, with download/delete per row.
 *
 * Uploads and deletes commit immediately rather than waiting for a Save —
 * a file transfer isn't form state, and there's nothing to discard here.
 */
export function ProjectAttachments({
  workspaceSlug,
  projectId,
  workItemId,
  canCreate,
  canDelete,
}: {
  workspaceSlug: string;
  projectId: string;
  /** Scopes to one work item's own attachments instead of the whole project's. */
  workItemId?: string;
  canCreate: boolean;
  canDelete: boolean;
}) {
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useProjectAttachments(workspaceSlug, projectId, workItemId);
  const remove = useDeleteProjectAttachment(workspaceSlug, projectId, workItemId);
  const queryClient = useQueryClient();

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);
  const [uploadingFiles, setUploadingFiles] = React.useState<UploadingFile[]>(
    [],
  );
  const [previewAttachment, setPreviewAttachment] =
    React.useState<ProjectAttachment | null>(null);

  const attachments = data ?? [];

  async function uploadOne(file: File) {
    const id = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
    setUploadingFiles((current) => [
      ...current,
      { id, name: file.name, progress: 0 },
    ]);
    try {
      const attachment = await uploadProjectAttachment(
        workspaceSlug,
        projectId,
        file,
        workItemId,
        false,
        (progress) =>
          setUploadingFiles((current) =>
            current.map((u) => (u.id === id ? { ...u, progress } : u)),
          ),
      );
      await queryClient.invalidateQueries({
        queryKey: projectAttachmentsKey(workspaceSlug, projectId, workItemId),
      });
      toast.success("Uploaded successfully", attachment.fileName);
    } catch {
      // apiUpload already toasted the error.
    } finally {
      setUploadingFiles((current) => current.filter((u) => u.id !== id));
    }
  }

  function submitFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      // Checked here as well as server-side so a rejected file fails
      // instantly instead of after a long upload.
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(
          "File too large",
          `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
        );
        continue;
      }
      if (!isAllowedAttachmentFile(file)) {
        toast.error(
          "Unsupported file type",
          `${file.name} — allowed: images, PDF, Word, Excel, CSV.`,
        );
        continue;
      }
      void uploadOne(file);
    }
  }

  async function handleDownload(attachment: ProjectAttachment) {
    setDownloadingId(attachment.id);
    try {
      await downloadProjectAttachment(workspaceSlug, projectId, attachment);
    } catch {
      toast.error("Download failed", attachment.fileName);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-lg font-semibold">Attachments</h2>
        <p className="text-sm text-muted-foreground">
          {workItemId
            ? "Files attached to this work item."
            : "Files shared across this project."}
        </p>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton columns={3} rows={4} />}
      >
        <div className="flex flex-col gap-4">
          {canCreate && (
            <>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragging(false);
                  submitFiles(event.dataTransfer.files);
                }}
                disabled={uploadingFiles.length > 0}
                className={cn(
                  "flex cursor-pointer flex-col items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-8 text-center transition-colors",
                  "hover:border-foreground/30 hover:bg-accent/40",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  dragging && "border-foreground/40 bg-accent/60",
                )}
              >
                {uploadingFiles.length > 0 ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className="h-5 w-5 text-muted-foreground" />
                )}
                <span className="text-sm">
                  {uploadingFiles.length > 0
                    ? "Uploading…"
                    : "Drop a file or click to browse"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Images, PDF, Word, Excel, or CSV — up to{" "}
                  {formatBytes(MAX_ATTACHMENT_BYTES)} per file
                </span>
              </button>

              {uploadingFiles.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {uploadingFiles.map((file) => (
                    <li
                      key={file.id}
                      className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5"
                    >
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="truncate text-sm font-medium">
                          {file.name}
                        </span>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-primary transition-[width]"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs text-muted-foreground">
                        {file.progress}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ATTACHMENT_ACCEPT}
                className="hidden"
                onChange={(event) => {
                  submitFiles(event.target.files);
                  // Reset so re-picking the same file still fires onChange.
                  event.target.value = "";
                }}
              />
            </>
          )}

          {attachments.length === 0 ? (
            <EmptyState
              icon={Paperclip}
              title="No attachments yet"
              description={
                canCreate
                  ? `Drop a file above to attach it to this ${workItemId ? "work item" : "project"}.`
                  : `No files have been attached to this ${workItemId ? "work item" : "project"}.`
              }
            />
          ) : (
            <ul className="flex flex-col gap-1.5">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex items-center gap-2 rounded-md border border-border px-3 py-2.5"
                >
                  <AttachmentThumbnail
                    workspaceSlug={workspaceSlug}
                    projectId={projectId}
                    attachment={attachment}
                    onPreview={() => setPreviewAttachment(attachment)}
                  />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {attachment.fileName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatBytes(attachment.sizeBytes)}
                      {attachment.uploader
                        ? ` · ${uploaderName(attachment.uploader)}`
                        : ""}
                      {` · ${formatDate(attachment.createdAt)}`}
                    </span>
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    aria-label={`Download ${attachment.fileName}`}
                    onClick={() => handleDownload(attachment)}
                    disabled={downloadingId === attachment.id}
                  >
                    {downloadingId === attachment.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>

                  {canDelete && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${attachment.fileName}`}
                      onClick={() => remove.mutate(attachment.id)}
                      disabled={remove.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </QueryState>

      <AttachmentPreviewDialog
        workspaceSlug={workspaceSlug}
        projectId={projectId}
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </section>
  );
}
