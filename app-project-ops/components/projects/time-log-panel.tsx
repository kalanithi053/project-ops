"use client";

import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { TimeLogFormSheet } from "@/components/projects/time-log-form-sheet";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import { useDeleteTimeLog, useWorkItemTimeLogs } from "@/lib/api/hooks/use-time-logs";
import { useMe } from "@/lib/api/hooks/use-users";
import {
  formatDate,
  formatDurationMinutes,
  formatTimeOfDay,
} from "@/lib/format";
import type { TimeLog } from "@/lib/api/types";

function formatPeriod(entry: TimeLog): string {
  if (!entry.startTime || !entry.endTime) return "—";
  return `${formatTimeOfDay(entry.startTime)} - ${formatTimeOfDay(entry.endTime)}`;
}

/** A work item's own time-log history — the "Time Logs" tab in both editors. */
export function TimeLogPanel({
  workspaceSlug,
  projectId,
  workItemId,
  canLog,
}: {
  workspaceSlug: string;
  projectId: string;
  workItemId: string;
  /** Only the item's assignee may add/edit/delete entries. */
  canLog: boolean;
}) {
  const { data: me } = useMe();
  const { data, isLoading } = useWorkItemTimeLogs(
    workspaceSlug,
    projectId,
    workItemId,
  );
  const { data: settings } = useWorkspaceSettings(workspaceSlug);
  const canAddManually =
    canLog && settings?.preferences.allowManualTimeLog !== false;
  const deleteEntry = useDeleteTimeLog(workspaceSlug, projectId, workItemId);
  const [dialogEntry, setDialogEntry] = React.useState<
    TimeLog | null | undefined
  >(undefined);
  // Bumped on every open so the sheet remounts (and re-seeds its fields) even
  // when re-opening the same "add" or "edit this entry" target twice in a row.
  const [openSession, setOpenSession] = React.useState(0);

  function openSheet(entry: TimeLog | null) {
    setDialogEntry(entry);
    setOpenSession((current) => current + 1);
  }

  const entries = data?.entries ?? [];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {entries.length} {entries.length === 1 ? "entry" : "entries"} logged
        </p>
        {canAddManually && (
          <Button type="button" size="sm" onClick={() => openSheet(null)}>
            <Plus className="h-4 w-4" />
            Add time log
          </Button>
        )}
      </div>

      {!isLoading &&
        (entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No time logged"
            description={
              canAddManually
                ? "Add a manual entry or start the timer above."
                : canLog
                  ? "Start the timer above."
                  : "Nothing logged on this item yet."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const isOwn = entry.userId === me?.id;
                return (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>
                      {[entry.user.firstName, entry.user.lastName]
                        .filter(Boolean)
                        .join(" ") || entry.user.email}
                    </TableCell>
                    <TableCell>
                      {formatDurationMinutes(entry.durationMinutes)}
                    </TableCell>
                    <TableCell>{formatPeriod(entry)}</TableCell>
                    <TableCell className="capitalize">
                      {entry.billingType === "billable"
                        ? "Billable"
                        : "Non-billable"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entry.notes || "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {isOwn && (
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Edit time log"
                            onClick={() => openSheet(entry)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            aria-label="Delete time log"
                            onClick={() => deleteEntry.mutate(entry.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ))}

      {canLog && (
        <TimeLogFormSheet
          key={`${dialogEntry?.id ?? "new"}-${openSession}`}
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          workItemId={workItemId}
          entry={dialogEntry}
          open={dialogEntry !== undefined}
          onOpenChange={(open) => {
            if (!open) setDialogEntry(undefined);
          }}
        />
      )}
    </div>
  );
}
