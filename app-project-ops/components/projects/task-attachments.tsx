"use client";

import * as React from "react";
import { Download, FileText, Loader2, Paperclip, Trash2, Upload } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast/toast-store";
import {
  MAX_ATTACHMENT_BYTES,
  downloadAttachment,
  formatBytes,
  useDeleteAttachment,
  useTaskAttachments,
  useUploadAttachment,
} from "@/lib/api/hooks/use-attachments";

interface TaskAttachmentsProps {
  workspaceSlug: string;
  projectId: string;
  taskId: string;
  canUpdate: boolean;
}

/**
 * Documents attached to a task, with a drop zone for adding more.
 *
 * Uploads and deletes commit immediately rather than waiting for the panel's
 * Save — a file transfer isn't something to hold in local form state, and
 * discarding the form shouldn't silently orphan an uploaded file.
 */
export function TaskAttachments({
  workspaceSlug,
  projectId,
  taskId,
  canUpdate,
}: TaskAttachmentsProps) {
  const { data, isLoading } = useTaskAttachments(
    workspaceSlug,
    projectId,
    taskId,
  );
  const upload = useUploadAttachment(workspaceSlug, projectId, taskId);
  const remove = useDeleteAttachment(workspaceSlug, projectId, taskId);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const attachments = data ?? [];

  function submitFiles(files: FileList | null) {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      // Checked here as well as server-side so an oversized file fails
      // instantly instead of after a long upload.
      if (file.size > MAX_ATTACHMENT_BYTES) {
        toast.error(
          "File too large",
          `${file.name} is ${formatBytes(file.size)} — the limit is ${formatBytes(MAX_ATTACHMENT_BYTES)}.`,
        );
        continue;
      }
      upload.mutate(file);
    }
  }

  async function handleDownload(attachment: { id: string; fileName: string }) {
    setDownloadingId(attachment.id);
    try {
      await downloadAttachment(workspaceSlug, projectId, taskId, attachment);
    } catch {
      toast.error("Download failed", attachment.fileName);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-sm font-medium">
          <Paperclip className="h-4 w-4" />
          Attachments
          {attachments.length > 0 && (
            <span className="text-muted-foreground">({attachments.length})</span>
          )}
        </span>
        {isLoading && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {attachments.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex items-center gap-2 rounded-md border border-border px-2.5 py-2"
            >
              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{attachment.fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {formatBytes(attachment.sizeBytes)}
                  {attachment.uploader
                    ? ` · ${attachment.uploader.username}`
                    : ""}
                  {` · ${formatDate(attachment.createdAt)}`}
                </span>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label={`Download ${attachment.fileName}`}
                onClick={() => handleDownload(attachment)}
                disabled={downloadingId === attachment.id}
              >
                {downloadingId === attachment.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
              </Button>

              {canUpdate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove ${attachment.fileName}`}
                  onClick={() => remove.mutate(attachment.id)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canUpdate && (
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
            disabled={upload.isPending}
            className={cn(
              "flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed border-border px-3 py-4 text-center transition-colors",
              "hover:border-foreground/30 hover:bg-accent/40",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-60",
              dragging && "border-foreground/40 bg-accent/60",
            )}
          >
            {upload.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <Upload className="h-4 w-4 text-muted-foreground" />
            )}
            <span className="text-sm">
              {upload.isPending ? "Uploading…" : "Drop a file or click to browse"}
            </span>
            <span className="text-xs text-muted-foreground">
              Up to {formatBytes(MAX_ATTACHMENT_BYTES)} per file
            </span>
          </button>

          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(event) => {
              submitFiles(event.target.files);
              // Reset so re-picking the same file still fires onChange.
              event.target.value = "";
            }}
          />
        </>
      )}

      {!canUpdate && attachments.length === 0 && (
        <p className="text-sm text-muted-foreground">No files attached.</p>
      )}
    </div>
  );
}
