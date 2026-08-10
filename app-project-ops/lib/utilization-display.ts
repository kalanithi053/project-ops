import type { ProjectUtilization } from "@/lib/api/types";
import type { Tone } from "@/types/module";

export interface MeterDisplay {
  label: string;
  percent: number;
  tone: Tone;
  valueLabel: string;
}

/** The project-status meter: % of work items done — always available. */
export function statusMeter(utilization: ProjectUtilization): MeterDisplay {
  const percent = utilization.statusPercentComplete;
  const tone: Tone = percent >= 100 ? "success" : percent >= 50 ? "info" : "neutral";
  return {
    label: "Work items",
    percent,
    tone,
    valueLabel: `${utilization.doneWorkItems}/${utilization.totalWorkItems} done`,
  };
}

/**
 * The schedule/budget meter — hours-budget progress for time_and_material
 * engagements, or date-window progress for fixed_budget/retainer ones.
 * Returns null when the project has neither (basis: 'none').
 */
export function scheduleMeter(utilization: ProjectUtilization): MeterDisplay | null {
  if (utilization.basis === "hours") {
    const percent = utilization.percentOfHoursUsed ?? 0;
    const tone: Tone = percent >= 100 ? "error" : percent >= 80 ? "warning" : "success";
    return {
      label: "Hours budget",
      percent,
      tone,
      valueLabel: `${utilization.loggedHours}h / ${utilization.estimatedHours}h`,
    };
  }

  if (utilization.basis === "date") {
    const percent = utilization.percentTimeElapsed ?? 0;
    const daysRemaining = utilization.daysRemaining ?? 0;
    const overdue = daysRemaining < 0;
    const tone: Tone = overdue ? "error" : percent >= 80 ? "warning" : "success";
    return {
      label: "Schedule",
      percent,
      tone,
      valueLabel: overdue ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d left`,
    };
  }

  return null;
}
