"use client";

import { Clock, Download, Filter, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { QueryState } from "@/components/shared/query-state";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProjectMembers } from "@/lib/api/hooks/use-project-members";
import {
  downloadTimeLogsCsv,
  useProjectTimeLogs,
} from "@/lib/api/hooks/use-time-logs";
import type { TimeLog, TimeLogFilters } from "@/lib/api/types";
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
 * Filterable time-log table for a single project. Shared by the project
 * tab route and the workspace-level time-log page, which picks the project
 * for it.
 */
export function TimeLogsView({
  workspaceSlug,
  projectId,
  sticky = false,
  projectSelector,
}: {
  workspaceSlug: string;
  projectId: string;
  /** Pins the filter bar below the project tab layout's header, matching that route's other tabs. */
  sticky?: boolean;
  /** Rendered next to the section title — lets a page-level project picker live in this view's header. */
  projectSelector?: React.ReactNode;
}) {
  const { data: members } = useProjectMembers(workspaceSlug, projectId);

  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [userId, setUserId] = React.useState("");
  const [appliedFilters, setAppliedFilters] = React.useState<TimeLogFilters>(
    {},
  );
  const [exporting, setExporting] = React.useState(false);

  const timeLogsQuery = useProjectTimeLogs(
    workspaceSlug,
    projectId,
    appliedFilters,
  );
  const entries = React.useMemo(
    () => timeLogsQuery.data ?? [],
    [timeLogsQuery.data],
  );

  const memberOptions: SelectOption[] = React.useMemo(
    () => [
      { value: "", label: "Everyone" },
      ...(members ?? [])
        .filter((member) => member.status !== "removed" && member.user?.id)
        .map((member) => ({
          value: String(member.user?.id),
          label: getFullname(member.user) ?? member.user?.email ?? "Unknown",
        })),
    ],
    [members],
  );

  function applyFilters() {
    setAppliedFilters({
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(userId ? { userId } : {}),
    });
  }

  function clearFilters() {
    setStartDate("");
    setEndDate("");
    setUserId("");
    setAppliedFilters({});
  }

  async function handleExport() {
    setExporting(true);
    try {
      await downloadTimeLogsCsv(workspaceSlug, projectId, appliedFilters);
    } finally {
      setExporting(false);
    }
  }

  const totalMinutes = entries.reduce(
    (sum, entry) => sum + entry.durationMinutes,
    0,
  );

  const consolidatedByUser = React.useMemo(() => {
    const totals = new Map<
      string,
      { userId: string; label: string; minutes: number }
    >();
    for (const entry of entries) {
      const existing = totals.get(entry.userId);
      if (existing) {
        existing.minutes += entry.durationMinutes;
        continue;
      }
      const label =
        [entry.user.firstName, entry.user.lastName].filter(Boolean).join(" ") ||
        entry.user.email;
      totals.set(entry.userId, {
        userId: entry.userId,
        label,
        minutes: entry.durationMinutes,
      });
    }
    return Array.from(totals.values()).sort((a, b) => b.minutes - a.minutes);
  }, [entries]);

  return (
    <section className="flex flex-col gap-4">
      <div
        className={
          sticky
            ? "sticky top-4 z-20 -mx-4 flex flex-col gap-4  bg-background px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
            : "flex flex-col gap-4"
        }
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Time Logs</h2>
            <p className="text-sm text-muted-foreground">
              Every hour logged across this project&apos;s work items.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {projectSelector}
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              disabled={exporting || entries.length === 0}
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting…" : "Export CSV"}
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Start date
            <Input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            End date
            <Input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            User
            <SelectField
              aria-label="Filter by user"
              options={memberOptions}
              value={userId}
              onValueChange={setUserId}
              placeholder="Everyone"
              className="w-48"
            />
          </label>
          <Button type="button" size="sm" onClick={applyFilters}>
            <Filter className="h-4 w-4" />
            Apply
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" />
            Clear
          </Button>
        </div>
      </div>

      <QueryState
        isLoading={timeLogsQuery.isLoading}
        isError={timeLogsQuery.isError}
        error={timeLogsQuery.error}
        onRetry={() => timeLogsQuery.refetch()}
        skeleton={<TableSkeleton columns={7} rows={6} />}
      >
        {entries.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="No time logged"
            description="Nothing matches these filters yet."
          />
        ) : (
          <>
            {consolidatedByUser.length > 1 && (
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
                <p className="text-sm font-medium">Consolidated hours</p>
                <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                  {consolidatedByUser.map((row) => (
                    <p
                      key={row.userId}
                      className="text-sm text-muted-foreground"
                    >
                      <span className="font-medium text-foreground">
                        {row.label}
                      </span>{" "}
                      · {formatDurationMinutes(row.minutes)}
                    </p>
                  ))}
                </div>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Work item</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Billing</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    <TableCell>
                      {[entry.user.firstName, entry.user.lastName]
                        .filter(Boolean)
                        .join(" ") || entry.user.email}
                    </TableCell>
                    <TableCell>
                      {entry.workItem ? (
                        <Link
                          href={`/${workspaceSlug}/projects/${projectId}/work-items/${entry.workItem.id}`}
                          className="hover:underline"
                        >
                          {entry.workItem.prefix
                            ? `${entry.workItem.prefix} · `
                            : ""}
                          {entry.workItem.name}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDurationMinutes(entry.durationMinutes)}
                    </TableCell>
                    <TableCell>{formatPeriod(entry)}</TableCell>
                    <TableCell>
                      {entry.billingType === "billable"
                        ? "Billable"
                        : "Non-billable"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate">
                      {entry.notes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="text-sm text-muted-foreground">
              Total: {formatDurationMinutes(totalMinutes)} across{" "}
              {entries.length} {entries.length === 1 ? "entry" : "entries"}
            </p>
          </>
        )}
      </QueryState>
    </section>
  );
}
