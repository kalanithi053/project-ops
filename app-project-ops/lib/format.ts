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

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    const year = match[1];
    const month = MONTHS[Number(match[2]) - 1];
    const day = Number(match[3]);
    if (month) return `${day} ${month} ${year}`;
  }

  const date = new Date(value);
  if (!Number.isNaN(date.getTime())) {
    return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
  }

  return value;
}
