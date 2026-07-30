const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/** Current local calendar date as the value expected by an HTML date input. */
export function todayDateInput(now = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Earliest date a member may log time against, given the workspace's
 * time-log preferences — as the value expected by an HTML date input, or
 * `undefined` when there's no lower bound. Mirrors the backend's
 * `assertLogDateAllowed` (see api-project-ops time-logs.service.ts).
 */
export function minLoggableDate(preferences?: {
  allowPastTimeLog: boolean;
  pastTimeLogLimitValue: number | null;
  pastTimeLogLimitUnit: "day" | "week" | "month";
}): string | undefined {
  if (!preferences) return undefined;
  if (!preferences.allowPastTimeLog) return todayDateInput();
  if (!preferences.pastTimeLogLimitValue) return undefined;

  const cutoff = new Date();
  const value = preferences.pastTimeLogLimitValue;
  if (preferences.pastTimeLogLimitUnit === "week") {
    cutoff.setDate(cutoff.getDate() - value * 7);
  } else if (preferences.pastTimeLogLimitUnit === "month") {
    cutoff.setMonth(cutoff.getMonth() - value);
  } else {
    cutoff.setDate(cutoff.getDate() - value);
  }
  return todayDateInput(cutoff);
}

/**
 * Format a date string as "18 July 2026".
 *
 * Parses the calendar parts directly (from a `YYYY-MM-DD` or ISO string)
 * rather than going through locale/timezone APIs, so the output is
 * deterministic and identical on server and client (no hydration drift).
 * Returns `fallback` for empty/unparseable input.
 */
export function formatDate(value?: string | null, fallback = "—"): string {
  if (!value) return fallback;

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match) {
    const year = match[1];
    const month = MONTHS[Number(match[2]) - 1];
    const day = Number(match[3]);
    if (month) return `${day} ${month} ${year}`;
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    const dateFormat = useThemeStore.getState().dateFormat;
    const day = dateFormat === "utc" ? date.getUTCDate() : date.getDate();
    const month = MONTHS[
      dateFormat === "utc" ? date.getUTCMonth() : date.getMonth()
    ];
    const year = dateFormat === "utc" ? date.getUTCFullYear() : date.getFullYear();
    return `${day} ${month} ${year}`;
  }

  return value;
}

/** Minutes as "1h 30m" (or just "2h" / "45m" when one part is zero). */
export function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours && mins) return `${hours}h ${mins}m`;
  if (hours) return `${hours}h`;
  return `${mins}m`;
}

/** A full ISO timestamp as local "09:30". */
export function formatTimeOfDay(value?: string | null, fallback = "—"): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export function formatDateTime(value?: string | null, fallback = "—"): string {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value, fallback);

  const dateFormat = useThemeStore.getState().dateFormat;
  const hours = String(dateFormat === "utc" ? date.getUTCHours() : date.getHours()).padStart(2, "0");
  const minutes = String(dateFormat === "utc" ? date.getUTCMinutes() : date.getMinutes()).padStart(2, "0");
  return `${formatDate(value, fallback)} · ${hours}:${minutes} ${dateFormat === "utc" ? "UTC" : "Local"}`;
}
import { useThemeStore } from "@/lib/store/theme-store";
