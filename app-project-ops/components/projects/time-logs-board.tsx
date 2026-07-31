"use client";

import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Columns3,
  List as ListIcon,
} from "lucide-react";
import * as React from "react";

import { TimeLogsGridView } from "@/components/projects/time-logs-grid-view";
import { TimeLogsListView } from "@/components/projects/time-logs-list-view";
import { groupEntries, toDateInput } from "@/components/projects/time-logs-utils";
import {
  RANGE_MODE_OPTIONS,
  type RangeMode,
  type TimeLogsRange,
} from "@/components/projects/use-time-logs-range";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryState } from "@/components/shared/query-state";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TimeLog } from "@/lib/api/types";

type ViewMode = "grid" | "list";
type GroupBy = "user" | "project";

/**
 * Toolbar + grid/list Time Logs UI shared by the workspace-wide board
 * (`TimeLogsWorkspace`, every project pooled) and the per-project board
 * (`ProjectTimeLogsBoard`, one project only). The caller owns data-fetching
 * (its `range` and `userId` feed the query) and hands over the resolved
 * `entries` plus the rosters used to build the grid's grouping.
 */
export function TimeLogsBoard({
  workspaceSlug,
  range,
  userId,
  onUserIdChange,
  members,
  projectRoster,
  entries,
  isLoading,
  isError,
  error,
  onRetry,
  title,
  description,
  headerAction,
  showProject = true,
}: {
  workspaceSlug: string;
  range: TimeLogsRange;
  userId: string;
  onUserIdChange: (id: string) => void;
  members: Array<{ id: string; name: string }>;
  projectRoster: Array<{ id: string; name: string }>;
  entries: TimeLog[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  onRetry: () => void;
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
  /** Off on the per-project Time Logs page — every entry is already this one project. */
  showProject?: boolean;
}) {
  const [view, setView] = React.useState<ViewMode>("grid");
  const [groupBy, setGroupBy] = React.useState<GroupBy>("user");

  const userOptions: SelectOption[] = React.useMemo(
    () => [
      { value: "", label: "Everyone" },
      ...members.map((member) => ({ value: member.id, label: member.name })),
    ],
    [members],
  );

  const topRoster = groupBy === "user" ? members : projectRoster;

  const groups = React.useMemo(
    () => groupEntries(entries, groupBy, topRoster),
    [entries, groupBy, topRoster],
  );

  return (
    <section className="flex flex-col gap-4">
      {(title || headerAction) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            {title && <h2 className="text-lg font-semibold">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {headerAction}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-1">
          <SelectField
            aria-label="Range mode"
            options={RANGE_MODE_OPTIONS}
            value={range.rangeMode}
            onValueChange={(value) => range.setRangeMode(value as RangeMode)}
            className="w-28"
          />

          {range.rangeMode === "range" ? (
            <>
              <Input
                type="date"
                aria-label="Range start"
                value={toDateInput(range.customRange.start)}
                max={toDateInput(range.customRange.end)}
                onChange={(event) => range.setRangeStart(event.target.value)}
                className="w-auto"
              />
              <span className="text-muted-foreground">–</span>
              <Input
                type="date"
                aria-label="Range end"
                value={toDateInput(range.customRange.end)}
                min={toDateInput(range.customRange.start)}
                onChange={(event) => range.setRangeEnd(event.target.value)}
                className="w-auto"
              />
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Previous"
                onClick={() => range.step(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[11rem] text-center text-sm font-medium">
                {range.rangeLabel}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Next"
                onClick={() => range.step(1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}

          <Button type="button" variant="ghost" size="sm" onClick={range.goToToday}>
            <CalendarClock className="h-3.5 w-3.5" />
            Today
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === "grid" && showProject && (
            <SelectField
              aria-label="Group by"
              options={[
                { value: "user", label: "View by User" },
                { value: "project", label: "View by Project" },
              ]}
              value={groupBy}
              onValueChange={(value) => setGroupBy(value as GroupBy)}
              className="w-44"
            />
          )}
          <SelectField
            aria-label="Filter by user"
            options={userOptions}
            value={userId}
            onValueChange={onUserIdChange}
            placeholder="Everyone"
            className="w-44"
          />
          <div className="inline-flex items-center rounded-md border border-border p-0.5">
            <Button
              type="button"
              variant={view === "list" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={view === "list"}
              onClick={() => setView("list")}
            >
              <ListIcon className="h-4 w-4" />
              List
            </Button>
            <Button
              type="button"
              variant={view === "grid" ? "secondary" : "ghost"}
              size="sm"
              aria-pressed={view === "grid"}
              onClick={() => setView("grid")}
            >
              <Columns3 className="h-4 w-4" />
              Grid
            </Button>
          </div>
        </div>
      </div>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={onRetry}
        skeleton={<TableSkeleton columns={7} rows={6} />}
      >
        {entries.length === 0 ? (
          <EmptyState
            icon={CalendarClock}
            title="No time logged"
            description="Nothing was logged in this range yet."
          />
        ) : view === "grid" ? (
          <TimeLogsGridView
            workspaceSlug={workspaceSlug}
            groups={groups}
            dates={range.dates}
            groupBy={groupBy}
            showProjectLevel={showProject}
          />
        ) : (
          <TimeLogsListView
            workspaceSlug={workspaceSlug}
            entries={entries}
            showProject={showProject}
          />
        )}
      </QueryState>
    </section>
  );
}
