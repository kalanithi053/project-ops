import { Badge } from "@/components/ui/badge";
import type { Tone } from "@/types/module";

interface StatusBadgeProps {
  label: string;
  tone?: Tone;
}

/**
 * Thin wrapper over <Badge> for status columns. Keeps status → color
 * mapping declarative at the config layer (callers pass a `tone`) while
 * centralizing the chip rendering so every module's status cells look
 * identical.
 */
export function StatusBadge({ label, tone = "neutral" }: StatusBadgeProps) {
  return <Badge variant={tone}>{label}</Badge>;
}

/**
 * Resolve a value to a tone using a lookup map, with a safe fallback.
 * Handy inside column `cell` renderers: `toneFor(row.status, MAP)`.
 */
export function toneFor(
  value: string,
  map: Record<string, Tone>,
  fallback: Tone = "neutral",
): Tone {
  return map[value] ?? fallback;
}
