import { TimeLogPastLimitUnit, WorkspacePreference } from '@prisma/client';

/** Resolved shape used by both the settings bundle and time-log validation. */
export interface TimeLogPreferences {
  allowManualTimeLog: boolean;
  allowPastTimeLog: boolean;
  pastTimeLogLimitValue: number | null;
  pastTimeLogLimitUnit: TimeLogPastLimitUnit;
}

/** Applied when a workspace has never saved its preferences (no row yet). */
export const DEFAULT_TIME_LOG_PREFERENCES: TimeLogPreferences = {
  allowManualTimeLog: true,
  allowPastTimeLog: false,
  pastTimeLogLimitValue: null,
  pastTimeLogLimitUnit: TimeLogPastLimitUnit.day,
};

/** Merges a possibly-missing `WorkspacePreference` row over the defaults. */
export function resolveTimeLogPreferences(
  row: WorkspacePreference | null,
): TimeLogPreferences {
  if (!row) return DEFAULT_TIME_LOG_PREFERENCES;
  return {
    allowManualTimeLog: row.allowManualTimeLog,
    allowPastTimeLog: row.allowPastTimeLog,
    pastTimeLogLimitValue: row.pastTimeLogLimitValue,
    pastTimeLogLimitUnit: row.pastTimeLogLimitUnit,
  };
}

/** `date` moved `value` units into the past (month uses calendar semantics). */
export function subtractUnit(
  date: Date,
  value: number,
  unit: TimeLogPastLimitUnit,
): Date {
  const result = new Date(date);
  if (unit === TimeLogPastLimitUnit.week) {
    result.setDate(result.getDate() - value * 7);
  } else if (unit === TimeLogPastLimitUnit.month) {
    result.setMonth(result.getMonth() - value);
  } else {
    result.setDate(result.getDate() - value);
  }
  return result;
}
