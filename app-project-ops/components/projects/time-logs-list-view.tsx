"use client";

import { ChevronDown, ChevronRight, FolderKanban, ListChecks } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { CATEGORY_ICON } from "@/components/projects/create-work-item-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { groupByDate, initials } from "@/components/projects/time-logs-utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { TimeLog } from "@/lib/api/types";
import {
  formatDate,
  formatDurationMinutes,
  formatTimeOfDay,
} from "@/lib/format";
import { getFullname } from "@/lib/utils";

function formatPeriod(entry: TimeLog): string {
  if (!entry.startTime || !entry.endTime) return "—";
  return `${formatTimeOfDay(entry.startTime)} - ${formatTimeOfDay(entry.endTime)}`;
}

/**
 * Flat entry list grouped by day (newest first), each group collapsible
 * with its own daily total — the "list" counterpart to the grid view, for
 * scanning individual log entries rather than totals per person/project.
 */
export function TimeLogsListView({
  workspaceSlug,
  entries,
  showProject = true,
}: {
  workspaceSlug: string;
  entries: TimeLog[];
  /** Hidden on the per-project Time Logs page, where every row is the same project. */
  showProject?: boolean;
}) {
  const groups = React.useMemo(() => groupByDate(entries), [entries]);
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const columnCount = showProject ? 7 : 6;

  function toggle(date: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-28">ID</TableHead>
          <TableHead>Log Title</TableHead>
          <TableHead>User</TableHead>
          {showProject && <TableHead>Project</TableHead>}
          <TableHead>Daily Log Hours</TableHead>
          <TableHead>Time Period</TableHead>
          <TableHead>Notes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => {
          const expanded = !collapsed.has(group.date);
          return (
            <React.Fragment key={group.date}>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableCell colSpan={columnCount}>
                  <button
                    type="button"
                    onClick={() => toggle(group.date)}
                    className="flex w-full items-center gap-1.5 text-left font-semibold"
                  >
                    {expanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    {formatDate(group.date)}
                    <span className="ml-auto text-sm font-normal text-muted-foreground">
                      {formatDurationMinutes(group.totalMinutes)}
                    </span>
                  </button>
                </TableCell>
              </TableRow>

              {expanded &&
                group.entries.map((entry) => {
                  const Icon =
                    CATEGORY_ICON[
                      entry.workItem?.workItemType
                        ?.category as keyof typeof CATEGORY_ICON
                    ] ?? ListChecks;
                  return (
                    <TableRow key={entry.id}>
                      <TableCell className="text-muted-foreground">
                        {entry.workItem?.prefix ?? "—"}
                      </TableCell>
                      <TableCell>
                        <span className="flex min-w-0 items-center gap-1.5">
                          <Icon
                            className="h-3.5 w-3.5 shrink-0"
                            style={{
                              color:
                                entry.workItem?.workItemType?.color ??
                                undefined,
                            }}
                          />
                          {entry.workItem ? (
                            <Link
                              href={`/${workspaceSlug}/projects/${entry.projectId}/work-items/${entry.workItem.id}`}
                              className="truncate text-primary hover:underline"
                            >
                              {entry.workItem.name}
                            </Link>
                          ) : (
                            <span className="truncate">—</span>
                          )}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const userName =
                            getFullname(entry.user) ?? entry.user?.email ?? "—";
                          return (
                            <span className="flex min-w-0 items-center gap-1.5">
                              <Avatar className="h-5 w-5 shrink-0">
                                <AvatarFallback className="text-[10px]">
                                  {initials(userName)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="truncate">{userName}</span>
                            </span>
                          );
                        })()}
                      </TableCell>
                      {showProject && (
                        <TableCell>
                          {entry.project ? (
                            <Link
                              href={`/${workspaceSlug}/projects/${entry.project.id}`}
                              className="flex items-center gap-1.5 text-primary hover:underline"
                            >
                              <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                              {entry.project.name}
                            </Link>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      )}
                      <TableCell>
                        {formatDurationMinutes(entry.durationMinutes)}
                      </TableCell>
                      <TableCell>{formatPeriod(entry)}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {entry.notes || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </React.Fragment>
          );
        })}
      </TableBody>
    </Table>
  );
}
