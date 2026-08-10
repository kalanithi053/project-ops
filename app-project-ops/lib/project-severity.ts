import type { Tone } from "@/types/module";

/** How close a project is to (or past) its due date — drives the dashboard card's badge. */
export type ProjectSeverity = "overdue" | "due_soon" | "on_track" | "no_due_date";

const DUE_SOON_WINDOW_DAYS = 7;

export const PROJECT_SEVERITY_LABELS: Record<ProjectSeverity, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  on_track: "On track",
  no_due_date: "No due date",
};

export const PROJECT_SEVERITY_TONES: Record<ProjectSeverity, Tone> = {
  overdue: "error",
  due_soon: "warning",
  on_track: "success",
  no_due_date: "neutral",
};

/** Classifies a project's health from its `endDate` relative to now. */
export function projectSeverity(
  endDate?: string | null,
  now = new Date(),
): ProjectSeverity {
  if (!endDate) return "no_due_date";
  const due = new Date(endDate);
  if (Number.isNaN(due.getTime())) return "no_due_date";
  if (due.getTime() < now.getTime()) return "overdue";
  const daysUntilDue = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return daysUntilDue <= DUE_SOON_WINDOW_DAYS ? "due_soon" : "on_track";
}
