import type { TimeLog } from "@/lib/api/types";

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
export const FULL_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Local midnight for `date`, dropping the time-of-day component. */
export function startOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** The Sunday on/before `date`, at local midnight. */
export function startOfWeek(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

/** The 1st of the month containing `date`, at local midnight. */
export function startOfMonth(date: Date): Date {
  const start = startOfDay(date);
  start.setDate(1);
  return start;
}

/** The last day of the month containing `date`, at local midnight. */
export function endOfMonth(date: Date): Date {
  const start = startOfMonth(date);
  start.setMonth(start.getMonth() + 1);
  start.setDate(0);
  return start;
}

/** Add whole calendar months to `date`, anchored to the 1st to avoid month-length rollover. */
export function addMonths(date: Date, months: number): Date {
  const next = startOfMonth(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Every date from `start` to `end`, inclusive. */
export function datesInRange(start: Date, end: Date): Date[] {
  const dates: Date[] = [];
  const last = startOfDay(end);
  for (let cursor = startOfDay(start); cursor <= last; cursor = addDays(cursor, 1)) {
    dates.push(cursor);
  }
  return dates;
}

/** Parse a `YYYY-MM-DD` `<input type="date">` value as a local-midnight Date. */
export function parseDateInput(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function shortLabel(date: Date): string {
  return `${date.getDate()} ${SHORT_MONTHS[date.getMonth()]}`;
}

export function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

/** A work item's type, carried alongside every task-level group for its icon/color. */
export interface TaskGroupType {
  category?: string;
  color?: string | null;
}

/** Leaf row: one work item, with its per-day minutes across the visible range. */
export interface TaskGroup {
  key: string;
  workItemId: string;
  projectId: string;
  name: string;
  prefix?: string | null;
  type: TaskGroupType;
  totalMinutes: number;
  byDate: Map<string, number>;
}

/** Mid-level row: either a project (grouped under a user) or a user (grouped under a project). */
export interface SubGroup {
  key: string;
  id: string;
  name: string;
  totalMinutes: number;
  byDate: Map<string, number>;
  tasks: TaskGroup[];
}

/** Top-level row: a user or a project, each holding its own sub-groups. */
export interface TopGroup {
  key: string;
  id: string;
  name: string;
  totalMinutes: number;
  byDate: Map<string, number>;
  subGroups: SubGroup[];
}

function dateKey(entry: TimeLog): string {
  return entry.date.slice(0, 10);
}

function addMinutes(byDate: Map<string, number>, key: string, minutes: number) {
  byDate.set(key, (byDate.get(key) ?? 0) + minutes);
}

function sumMinutes(byDate: Map<string, number>): number {
  let total = 0;
  for (const minutes of byDate.values()) total += minutes;
  return total;
}

/**
 * Three-level grouping shared by the grid view's "View by User" and
 * "View by Project" modes: top level (user or project) -> sub level (the
 * other of the two) -> individual work item, each carrying its own
 * per-day minute totals so the grid can render every level's row without
 * re-scanning entries.
 *
 * `topRoster`/`subRosterName` seed every top-level row (even ones with no
 * entries this range) so, e.g., a member who logged nothing still shows a
 * blank row — matching the roster-driven behavior of the old team calendar.
 */
export function groupEntries(
  entries: TimeLog[],
  by: "user" | "project",
  topRoster: Array<{ id: string; name: string }>,
): TopGroup[] {
  const tops = new Map<string, TopGroup>();

  for (const { id, name } of topRoster) {
    tops.set(id, {
      key: id,
      id,
      name,
      totalMinutes: 0,
      byDate: new Map(),
      subGroups: [],
    });
  }

  for (const entry of entries) {
    const topId = by === "user" ? entry.userId : entry.projectId;
    if (!topId) continue;

    let top = tops.get(topId);
    if (!top) {
      const topName =
        by === "user"
          ? [entry.user.firstName, entry.user.lastName]
              .filter(Boolean)
              .join(" ") || entry.user.email
          : (entry.project?.name ?? "Unknown project");
      top = {
        key: topId,
        id: topId,
        name: topName,
        totalMinutes: 0,
        byDate: new Map(),
        subGroups: [],
      };
      tops.set(topId, top);
    }

    const subId = by === "user" ? entry.projectId : entry.userId;
    let sub = top.subGroups.find((s) => s.id === subId);
    if (!sub) {
      const subName =
        by === "user"
          ? (entry.project?.name ?? "Unknown project")
          : [entry.user.firstName, entry.user.lastName]
              .filter(Boolean)
              .join(" ") || entry.user.email;
      sub = {
        key: `${topId}:${subId}`,
        id: subId,
        name: subName,
        totalMinutes: 0,
        byDate: new Map(),
        tasks: [],
      };
      top.subGroups.push(sub);
    }

    const workItemId = entry.workItemId;
    let task = sub.tasks.find((t) => t.workItemId === workItemId);
    if (!task) {
      task = {
        key: `${sub.key}:${workItemId}`,
        workItemId,
        projectId: entry.projectId,
        name: entry.workItem?.name ?? "Untitled work item",
        prefix: entry.workItem?.prefix,
        type: {
          category: entry.workItem?.workItemType?.category,
          color: entry.workItem?.workItemType?.color,
        },
        totalMinutes: 0,
        byDate: new Map(),
      };
      sub.tasks.push(task);
    }

    const day = dateKey(entry);
    addMinutes(task.byDate, day, entry.durationMinutes);
    addMinutes(sub.byDate, day, entry.durationMinutes);
    addMinutes(top.byDate, day, entry.durationMinutes);
  }

  for (const top of tops.values()) {
    top.totalMinutes = sumMinutes(top.byDate);
    for (const sub of top.subGroups) {
      sub.totalMinutes = sumMinutes(sub.byDate);
      for (const task of sub.tasks) {
        task.totalMinutes = sumMinutes(task.byDate);
      }
      sub.tasks.sort((a, b) => b.totalMinutes - a.totalMinutes);
    }
    top.subGroups.sort((a, b) => b.totalMinutes - a.totalMinutes);
  }

  return Array.from(tops.values()).sort(
    (a, b) => b.totalMinutes - a.totalMinutes || a.name.localeCompare(b.name),
  );
}

export interface DateGroup {
  date: string;
  totalMinutes: number;
  entries: TimeLog[];
}

/** Flat entries bucketed by day, newest first, for the list view. */
export function groupByDate(entries: TimeLog[]): DateGroup[] {
  const byDate = new Map<string, TimeLog[]>();
  for (const entry of entries) {
    const key = dateKey(entry);
    const bucket = byDate.get(key);
    if (bucket) bucket.push(entry);
    else byDate.set(key, [entry]);
  }
  return Array.from(byDate.entries())
    .map(([date, dayEntries]) => ({
      date,
      entries: dayEntries,
      totalMinutes: dayEntries.reduce((sum, e) => sum + e.durationMinutes, 0),
    }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
