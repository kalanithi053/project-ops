"use client";

import * as React from "react";

import {
  addDays,
  addMonths,
  datesInRange,
  endOfMonth,
  FULL_MONTHS,
  parseDateInput,
  shortLabel,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toDateInput,
} from "@/components/projects/time-logs-utils";

export type RangeMode = "day" | "week" | "month" | "range";

export interface TimeLogsRangeOption {
  value: RangeMode;
  label: string;
}

export const RANGE_MODE_OPTIONS: TimeLogsRangeOption[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "range", label: "Range" },
];

/**
 * Day/Week/Month/custom-Range date-window state shared by the workspace-wide
 * and per-project Time Logs boards. Exposes the resolved `dates` array plus
 * navigation (`step`, `goToToday`) and the Range mode's own start/end setters.
 */
export function useTimeLogsRange() {
  const [rangeMode, setRangeModeState] = React.useState<RangeMode>("week");
  const [anchorDate, setAnchorDate] = React.useState(() => startOfDay(new Date()));
  const [customRange, setCustomRange] = React.useState(() => {
    const today = startOfDay(new Date());
    return { start: today, end: today };
  });

  const dates = React.useMemo(() => {
    if (rangeMode === "day") return [anchorDate];
    if (rangeMode === "month") {
      return datesInRange(startOfMonth(anchorDate), endOfMonth(anchorDate));
    }
    if (rangeMode === "range") {
      return datesInRange(customRange.start, customRange.end);
    }
    const start = startOfWeek(anchorDate);
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [rangeMode, anchorDate, customRange]);

  const startDate = toDateInput(dates[0]);
  const endDate = toDateInput(dates[dates.length - 1]);

  const rangeLabel = React.useMemo(() => {
    if (rangeMode === "month") {
      return `${FULL_MONTHS[anchorDate.getMonth()]} ${anchorDate.getFullYear()}`;
    }
    if (rangeMode === "day") {
      return `${shortLabel(anchorDate)} ${anchorDate.getFullYear()}`;
    }
    const first = dates[0];
    const last = dates[dates.length - 1];
    return `${shortLabel(first)} – ${shortLabel(last)} ${last.getFullYear()}`;
  }, [rangeMode, anchorDate, dates]);

  function setRangeMode(mode: RangeMode) {
    if (mode === "range") {
      setCustomRange({ start: dates[0], end: dates[dates.length - 1] });
    }
    setRangeModeState(mode);
  }

  function step(direction: 1 | -1) {
    if (rangeMode === "day") setAnchorDate((d) => addDays(d, direction));
    else if (rangeMode === "month") setAnchorDate((d) => addMonths(d, direction));
    else setAnchorDate((d) => addDays(d, direction * 7));
  }

  function goToToday() {
    const today = startOfDay(new Date());
    setAnchorDate(today);
    setCustomRange({ start: today, end: today });
  }

  function setRangeStart(value: string) {
    const next = parseDateInput(value);
    setCustomRange((current) => ({
      start: next,
      end: current.end < next ? next : current.end,
    }));
  }

  function setRangeEnd(value: string) {
    const next = parseDateInput(value);
    setCustomRange((current) => ({
      start: current.start > next ? next : current.start,
      end: next,
    }));
  }

  return {
    rangeMode,
    setRangeMode,
    dates,
    startDate,
    endDate,
    rangeLabel,
    customRange,
    step,
    goToToday,
    setRangeStart,
    setRangeEnd,
  };
}

export type TimeLogsRange = ReturnType<typeof useTimeLogsRange>;
