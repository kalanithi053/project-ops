import type { TimeLog } from "@/lib/api/types";
import { formatDate, formatTimeOfDay } from "@/lib/format";
import { getFullname } from "@/lib/utils";

export type TimeLogsExportFormat = "csv" | "xlsx";

const COLUMNS = [
  "Date",
  "User",
  "Work item",
  "Duration (hours)",
  "Start",
  "End",
  "Billing",
  "Notes",
];

/** Minutes as decimal hours, e.g. 90 -> "1.50". */
function minutesToHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

function buildRows(entries: TimeLog[]): string[][] {
  return entries.map((entry) => [
    formatDate(entry.date),
    getFullname(entry.user) ?? entry.user?.email ?? "",
    entry.workItem
      ? entry.workItem.prefix
        ? `${entry.workItem.prefix} - ${entry.workItem.name}`
        : entry.workItem.name
      : "",
    minutesToHours(entry.durationMinutes),
    formatTimeOfDay(entry.startTime, ""),
    formatTimeOfDay(entry.endTime, ""),
    entry.billingType,
    entry.notes ?? "",
  ]);
}

function buildSummary(
  entries: TimeLog[],
  extra: Array<[string, string]>,
): Array<[string, string]> {
  const totalMinutes = entries.reduce(
    (sum, entry) => sum + entry.durationMinutes,
    0,
  );
  return [...extra, ["Total hours logged", minutesToHours(totalMinutes)]];
}

function escapeCsv(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Minimal CSV writer — quotes/escapes only the handful of characters that
 * matter. `summary` renders as label/value lines above a blank separator row,
 * ahead of the column header and data rows.
 */
function toCsv(rows: string[][], summary: Array<[string, string]>): string {
  const summaryLines = summary.map(([label, value]) =>
    [label, value].map(escapeCsv).join(","),
  );
  const tableLines = [COLUMNS, ...rows].map((row) =>
    row.map(escapeCsv).join(","),
  );
  return [...summaryLines, "", ...tableLines].join("\r\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Excel opens an HTML table saved with a `.xls` extension and the
 * `application/vnd.ms-excel` MIME type directly as a spreadsheet — no
 * binary workbook library needed for a browser-side export.
 */
function toXlsHtml(rows: string[][], summary: Array<[string, string]>): string {
  const summaryRows = summary
    .map(
      ([label, value]) =>
        `<tr><td><b>${escapeHtml(label)}</b></td><td>${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const headerRow = `<tr>${COLUMNS.map((c) => `<th>${escapeHtml(c)}</th>`).join("")}</tr>`;
  const dataRows = rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`,
    )
    .join("");
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body><table>${summaryRows}<tr></tr>${headerRow}${dataRows}</table></body></html>`;
}

function triggerDownload(content: string, mimeType: string, filename: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * Exports already-loaded time-log entries as CSV or Excel, entirely in the
 * browser — every date/time column renders in the viewer's local time (the
 * same `formatDate`/`formatTimeOfDay` helpers the on-screen table uses), so
 * the file always matches what's on screen regardless of server timezone.
 */
export function exportTimeLogs(
  entries: TimeLog[],
  format: TimeLogsExportFormat,
  meta: { filenamePrefix: string; summary: Array<[string, string]> },
): void {
  const rows = buildRows(entries);
  const summary = buildSummary(entries, meta.summary);

  if (format === "xlsx") {
    triggerDownload(
      toXlsHtml(rows, summary),
      "application/vnd.ms-excel;charset=utf-8",
      `${meta.filenamePrefix}.xls`,
    );
  } else {
    triggerDownload(
      toCsv(rows, summary),
      "text/csv;charset=utf-8",
      `${meta.filenamePrefix}.csv`,
    );
  }
}
