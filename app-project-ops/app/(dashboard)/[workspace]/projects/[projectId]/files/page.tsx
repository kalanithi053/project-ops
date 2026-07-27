"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Download, FileText, Loader2, Paperclip } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { QueryState } from "@/components/shared/query-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDate } from "@/lib/format";
import { toast } from "@/lib/toast/toast-store";
import {
  downloadAttachment,
  formatBytes,
  useProjectAttachments,
} from "@/lib/api/hooks/use-attachments";

/**
 * Every document attached anywhere in the project.
 *
 * Uploading happens on the task the file belongs to — a document is always
 * evidence for some piece of work — so this view is a read-and-download
 * rollup rather than a second place to add files.
 */
export default function ProjectFilesPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();

  const attachmentsQuery = useProjectAttachments(workspace, projectId);
  const [downloadingId, setDownloadingId] = React.useState<string | null>(null);

  const attachments = attachmentsQuery.data ?? [];
  const totalBytes = attachments.reduce(
    (sum, attachment) => sum + attachment.sizeBytes,
    0,
  );

  async function handleDownload(attachment: (typeof attachments)[number]) {
    if (!attachment.task) return;
    setDownloadingId(attachment.id);
    try {
      await downloadAttachment(
        workspace,
        projectId,
        attachment.task.id,
        attachment,
      );
    } catch {
      toast.error("Download failed", attachment.fileName);
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold tracking-tight">Files</h2>
        <p className="text-sm text-muted-foreground">
          Documents attached to this project&apos;s tasks. Add files from the
          task they belong to.
          {attachments.length > 0 &&
            ` ${attachments.length} file${attachments.length === 1 ? "" : "s"}, ${formatBytes(totalBytes)} total.`}
        </p>
      </div>

      <QueryState
        isLoading={attachmentsQuery.isLoading}
        isError={attachmentsQuery.isError}
        error={attachmentsQuery.error}
        onRetry={() => attachmentsQuery.refetch()}
        skeleton={<TableSkeleton columns={4} rows={3} />}
      >
        {attachments.length === 0 ? (
          <EmptyState
            icon={Paperclip}
            title="No files yet"
            description="Open a task on the board and attach a document to see it here."
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead className="w-48">Task</TableHead>
                    <TableHead className="w-32">Uploaded by</TableHead>
                    <TableHead className="w-32">Date</TableHead>
                    <TableHead className="w-20 text-right">Download</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attachments.map((attachment) => (
                    <TableRow key={attachment.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          <div className="flex min-w-0 flex-col">
                            <span className="truncate font-medium">
                              {attachment.fileName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatBytes(attachment.sizeBytes)}
                            </span>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {attachment.task ? (
                          <Badge variant="secondary" className="font-normal">
                            {attachment.task.prefix ?? attachment.task.name}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {attachment.uploader?.username ?? "—"}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatDate(attachment.createdAt)}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
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
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </QueryState>
    </div>
  );
}
