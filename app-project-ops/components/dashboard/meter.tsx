import { cn } from "@/lib/utils";
import type { Tone } from "@/types/module";

const TONE_VAR: Record<Tone, string> = {
  success: "var(--status-success)",
  warning: "var(--status-warning)",
  error: "var(--status-error)",
  info: "var(--status-info)",
  neutral: "var(--status-neutral)",
  default: "var(--primary)",
  secondary: "var(--secondary)",
  outline: "var(--foreground)",
};

interface MeterProps {
  label: string;
  /** 0-100. Values outside that range are clamped for the bar's width only — `valueLabel` can still say "120%". */
  percent: number;
  tone?: Tone;
  valueLabel?: string;
  className?: string;
}

/** Thin labeled progress bar — the dashboard's per-project meter box and utilization card share this. */
export function Meter({ label, percent, tone = "info", valueLabel, className }: MeterProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        {valueLabel && <span className="shrink-0 whitespace-nowrap">{valueLabel}</span>}
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${clamped}%`, backgroundColor: TONE_VAR[tone] }}
        />
      </div>
    </div>
  );
}
