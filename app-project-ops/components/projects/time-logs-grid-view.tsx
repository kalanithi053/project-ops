"use client";

import { ChevronDown, ChevronRight, FolderKanban, ListChecks } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { CATEGORY_ICON } from "@/components/projects/create-work-item-menu";
import {
  initials,
  WEEKDAY_LABELS,
  type TaskGroup,
  type TopGroup,
} from "@/components/projects/time-logs-utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDurationMinutes } from "@/lib/format";

function UserLabel({ name, className }: { name: string; className?: string }) {
  return (
    <span className={`flex min-w-0 items-center gap-1.5 ${className ?? ""}`}>
      <Avatar className="h-5 w-5 shrink-0">
        <AvatarFallback className="text-[10px]">{initials(name)}</AvatarFallback>
      </Avatar>
      <span className="truncate">{name}</span>
    </span>
  );
}

/** Bar width relative to a full 8-hour day, so a glance shows relative load. */
const FULL_DAY_MINUTES = 8 * 60;

function cellMinutes(byDate: Map<string, number>, dateInput: string): number {
  return byDate.get(dateInput) ?? 0;
}

function Bar({ minutes, tone }: { minutes: number; tone: "top" | "sub" | "task" }) {
  if (minutes <= 0) return null;
  const width = Math.max(6, Math.min(100, (minutes / FULL_DAY_MINUTES) * 100));
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={
          tone === "top"
            ? "h-full bg-primary"
            : tone === "sub"
              ? "h-full bg-primary/70"
              : "h-full bg-primary/50"
        }
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function GridCell({
  minutes,
  tone,
}: {
  minutes: number;
  tone: "top" | "sub" | "task";
}) {
  return (
    <td className="min-w-[6.5rem] border-l border-border px-2 py-1.5 align-middle">
      <div className="flex flex-col gap-1">
        <span
          className={
            minutes > 0
              ? "text-xs font-medium"
              : "text-xs text-muted-foreground"
          }
        >
          {minutes > 0 ? formatDurationMinutes(minutes) : "—"}
        </span>
        <Bar minutes={minutes} tone={tone} />
      </div>
    </td>
  );
}

function ExpandToggle({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
      aria-label={expanded ? "Collapse" : "Expand"}
    >
      {expanded ? (
        <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function TaskRow({
  workspaceSlug,
  task,
  dateInputs,
  indentClassName,
}: {
  workspaceSlug: string;
  task: TaskGroup;
  dateInputs: string[];
  indentClassName: string;
}) {
  const Icon =
    CATEGORY_ICON[task.type.category as keyof typeof CATEGORY_ICON] ??
    ListChecks;
  return (
    <tr className="border-b border-border">
      <td className={`sticky left-0 z-10 bg-background py-1.5 pr-3 ${indentClassName}`}>
        <span className="flex min-w-0 items-center gap-1.5">
          <Icon
            className="h-3.5 w-3.5 shrink-0"
            style={{ color: task.type.color ?? undefined }}
          />
          <Link
            href={`/${workspaceSlug}/projects/${task.projectId}/work-items/${task.workItemId}`}
            className="truncate text-xs text-primary hover:underline"
          >
            {task.prefix ? `${task.prefix} · ` : ""}
            {task.name}
          </Link>
        </span>
      </td>
      {dateInputs.map((dateInput) => (
        <GridCell
          key={dateInput}
          minutes={cellMinutes(task.byDate, dateInput)}
          tone="task"
        />
      ))}
      <td className="border-l border-border px-2 py-1.5 text-xs sticky right-0 z-10 bg-background">
        {formatDurationMinutes(task.totalMinutes)}
      </td>
    </tr>
  );
}

/**
 * Hierarchical timesheet grid: top-level rows (a user or a project,
 * depending on `groupBy`) expand to their sub-groups (the other dimension),
 * which expand to the individual work items logged against them — dates
 * across the top, each cell the minutes logged in that cell's scope for
 * that day. Rows start expanded, matching the always-open state most
 * timesheet tools default to for a single visible date range.
 *
 * `showProjectLevel=false` (the per-project Time Logs page, where every
 * entry already belongs to the same one project) collapses that redundant
 * middle level — each "user" top row expands straight to its tasks.
 */
export function TimeLogsGridView({
  workspaceSlug,
  groups,
  dates,
  groupBy,
  showProjectLevel = true,
}: {
  workspaceSlug: string;
  groups: TopGroup[];
  dates: Date[];
  groupBy: "user" | "project";
  showProjectLevel?: boolean;
}) {
  const flattenProjectLevel = groupBy === "user" && !showProjectLevel;
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const dateInputs = React.useMemo(
    () =>
      dates.map((d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }),
    [dates],
  );

  function toggle(key: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const dayTotals = React.useMemo(
    () =>
      dateInputs.map((dateInput) =>
        groups.reduce((sum, top) => sum + cellMinutes(top.byDate, dateInput), 0),
      ),
    [groups, dateInputs],
  );
  const grandTotal = React.useMemo(
    () => groups.reduce((sum, top) => sum + top.totalMinutes, 0),
    [groups],
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 min-w-[16rem] border-b border-border bg-muted px-3 py-2 text-left font-medium">
              {groupBy === "user" ? "User" : "Project"}
            </th>
            {dates.map((date, i) => (
              <th
                key={dateInputs[i]}
                className="min-w-[6.5rem] border-b border-l border-border bg-muted px-2 py-2 text-left font-medium"
              >
                <div className="flex flex-col gap-0.5">
                  <span>
                    {date.getDate()}, {WEEKDAY_LABELS[date.getDay()]}
                  </span>
                  <span className="font-normal text-muted-foreground">
                    {formatDurationMinutes(dayTotals[i])}
                  </span>
                </div>
              </th>
            ))}
            <th className="min-w-[6.5rem] sticky right-0 z-10 border-b border-l border-border bg-muted px-2 py-2 text-left font-medium">
              <div className="flex flex-col gap-0.5">
                <span>Total</span>
                <span className="font-normal text-muted-foreground">
                  {formatDurationMinutes(grandTotal)}
                </span>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {groups.map((top) => {
            const topExpanded = !collapsed.has(top.key);
            return (
              <React.Fragment key={top.key}>
                <tr className="border-b border-border bg-muted/10">
                  <td className="sticky left-0 z-10 bg-background px-3 py-2">
                    <span className="flex items-center gap-1.5">
                      <ExpandToggle
                        expanded={topExpanded}
                        onToggle={() => toggle(top.key)}
                      />
                      {groupBy === "project" ? (
                        <Link
                          href={`/${workspaceSlug}/projects/${top.id}`}
                          className="flex min-w-0 items-center gap-1.5 truncate font-semibold text-primary hover:underline custor-pointer"
                        >
                          <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{top.name}</span>
                        </Link>
                      ) : (
                        <UserLabel name={top.name} className="font-semibold" />
                      )}
                    </span>
                  </td>
                  {dateInputs.map((dateInput) => (
                    <GridCell
                      key={dateInput}
                      minutes={cellMinutes(top.byDate, dateInput)}
                      tone="top"
                    />
                  ))}
                  <td className="border-l border-border px-2 py-1.5 font-semibold  sticky right-0 z-10 bg-background">
                    {formatDurationMinutes(top.totalMinutes)}
                  </td>
                </tr>

                {topExpanded && flattenProjectLevel &&
                  top.subGroups.flatMap((sub) => sub.tasks).map((task) => (
                    <TaskRow
                      key={task.key}
                      workspaceSlug={workspaceSlug}
                      task={task}
                      dateInputs={dateInputs}
                      indentClassName="pl-8"
                    />
                  ))}

                {topExpanded && !flattenProjectLevel &&
                  top.subGroups.map((sub) => {
                    const subExpanded = !collapsed.has(sub.key);
                    return (
                      <React.Fragment key={sub.key}>
                        <tr className="border-b border-border">
                          <td className="sticky left-0 z-10 bg-background py-1.5 pl-8 pr-3">
                            <span className="flex items-center gap-1.5">
                              <ExpandToggle
                                expanded={subExpanded}
                                onToggle={() => toggle(sub.key)}
                              />
                              {groupBy === "user" ? (
                                <Link
                                  href={`/${workspaceSlug}/projects/${sub.id}`}
                                  className="flex min-w-0 items-center gap-1.5 truncate text-[13px] font-medium text-primary hover:underline"
                                >
                                  <FolderKanban className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">{sub.name}</span>
                                </Link>
                              ) : (
                                <UserLabel
                                  name={sub.name}
                                  className="text-[13px] font-medium"
                                />
                              )}
                            </span>
                          </td>
                          {dateInputs.map((dateInput) => (
                            <GridCell
                              key={dateInput}
                              minutes={cellMinutes(sub.byDate, dateInput)}
                              tone="sub"
                            />
                          ))}
                          <td className="border-l border-border px-2 py-1.5 text-[13px] font-medium  sticky right-0 z-10 bg-background">
                            {formatDurationMinutes(sub.totalMinutes)}
                          </td>
                        </tr>

                        {subExpanded &&
                          sub.tasks.map((task) => (
                            <TaskRow
                              key={task.key}
                              workspaceSlug={workspaceSlug}
                              task={task}
                              dateInputs={dateInputs}
                              indentClassName="pl-14"
                            />
                          ))}
                      </React.Fragment>
                    );
                  })}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
