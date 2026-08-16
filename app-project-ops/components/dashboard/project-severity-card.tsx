"use client";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  PROJECT_SEVERITY_LABELS,
  PROJECT_SEVERITY_TONES,
  projectSeverity,
  type ProjectSeverity,
} from "@/lib/project-severity";

const CX = 110;
const CY = 110;
const RADIUS = 90;
const NEEDLE_LENGTH = 74;

/** Where the needle rests within each severity's zone (0 = safe/left, 100 = danger/right). */
const NEEDLE_PERCENT: Record<ProjectSeverity, number> = {
  on_track: 25,
  due_soon: 67,
  overdue: 96,
  no_due_date: 50,
};

/** Zone boundaries as cumulative percent, matching the severity thresholds' spirit. */
const ZONES: { from: number; to: number; tone: "success" | "warning" | "error" }[] = [
  { from: 0, to: 50, tone: "success" },
  { from: 50, to: 85, tone: "warning" },
  { from: 85, to: 100, tone: "error" },
];

const TONE_VAR: Record<"success" | "warning" | "error" | "neutral", string> = {
  success: "var(--status-success)",
  warning: "var(--status-warning)",
  error: "var(--status-error)",
  neutral: "var(--status-neutral)",
};

function polar(percent: number, radius: number) {
  const angleDeg = 180 - Math.max(0, Math.min(100, percent)) * 1.8;
  const rad = (angleDeg * Math.PI) / 180;
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) };
}

function zoneArcPath(from: number, to: number) {
  const start = polar(from, RADIUS);
  const end = polar(to, RADIUS);
  const largeArc = to - from > 100 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function daysFromNow(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const due = new Date(dateStr);
  if (Number.isNaN(due.getTime())) return null;
  return Math.round((due.getTime() - Date.now()) / 86_400_000);
}

function severityCaption(severity: ProjectSeverity, days: number | null): string {
  if (severity === "no_due_date" || days === null) return "No due date set";
  if (days === 0) return "Due today";
  return days > 0 ? `${days}d remaining` : `${Math.abs(days)}d overdue`;
}

interface ProjectSeverityCardProps {
  endDate?: string | null;
}

/**
 * "Project health" — a speedometer for how close this project is to (or
 * past) its due date, driven by the same classification used everywhere
 * else a project's severity shows up (lib/project-severity.ts).
 */
export function ProjectSeverityCard({ endDate }: ProjectSeverityCardProps) {
  const severity = projectSeverity(endDate);
  const needleTip = polar(NEEDLE_PERCENT[severity], NEEDLE_LENGTH);
  const days = daysFromNow(endDate);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project health</CardTitle>
        <CardDescription>
          How close this project is to its due date.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <svg viewBox="0 0 220 125" className="w-full max-w-[220px]" aria-hidden="true">
          {severity === "no_due_date" ? (
            <path
              d={zoneArcPath(0, 100)}
              fill="none"
              stroke={TONE_VAR.neutral}
              strokeWidth={14}
              strokeLinecap="round"
              opacity={0.5}
            />
          ) : (
            ZONES.map((zone) => (
              <path
                key={zone.tone}
                d={zoneArcPath(zone.from, zone.to)}
                fill="none"
                stroke={TONE_VAR[zone.tone]}
                strokeWidth={14}
                strokeLinecap="round"
              />
            ))
          )}
          <line
            x1={CX}
            y1={CY}
            x2={needleTip.x}
            y2={needleTip.y}
            stroke="var(--foreground)"
            strokeWidth={3}
            strokeLinecap="round"
          />
          <circle cx={CX} cy={CY} r={6} fill="var(--foreground)" />
        </svg>
        <div className="flex flex-col items-center gap-1.5">
          <Badge variant={PROJECT_SEVERITY_TONES[severity]}>
            {PROJECT_SEVERITY_LABELS[severity]}
          </Badge>
          <p className="text-xs text-muted-foreground">
            {severityCaption(severity, days)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
