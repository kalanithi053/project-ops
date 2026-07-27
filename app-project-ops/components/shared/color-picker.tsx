"use client";

import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Palette offered in the picker. The first five are the colors the backend
 * seeds onto default statuses and priorities, so an untouched workspace
 * round-trips through this control unchanged.
 */
export const COLOR_SWATCHES = [
  "#94a3b8",
  "#3b82f6",
  "#f59e0b",
  "#22c55e",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
  "#0ea5e9",
  "#64748b",
  "#84cc16",
] as const;

const HEX_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** Whether a string is a `#rrggbb` color the API will accept. */
export function isValidHex(value: string): boolean {
  return HEX_PATTERN.test(value);
}

interface ColorPickerProps {
  value?: string | null;
  onChange: (value: string) => void;
  id?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

/**
 * Swatch grid plus a free hex field, in a popover behind a color chip.
 *
 * Colors are stored as `#rrggbb` strings rather than design tokens because
 * they're user-authored per workspace, so this is one of the few places that
 * legitimately renders a raw color value.
 */
export function ColorPicker({
  value,
  onChange,
  id,
  disabled,
  ...aria
}: ColorPickerProps) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState(value ?? "");

  const current = value ?? "";

  function commit(next: string) {
    onChange(next);
    setOpen(false);
  }

  // Seeding the hex field on open (rather than syncing it from `value` in an
  // effect) keeps the draft local to the editing session and avoids a
  // render cascade when the saved color changes underneath.
  function handleOpenChange(next: boolean) {
    if (next) setDraft(current);
    setOpen(next);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-label={aria["aria-label"] ?? "Pick a color"}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-md border border-input bg-background px-2.5 text-sm shadow-sm transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
        )}
      >
        <span
          className="h-3.5 w-3.5 shrink-0 rounded-full border border-border"
          style={{ backgroundColor: current || "transparent" }}
        />
        <span className={cn("font-mono text-xs", !current && "text-muted-foreground")}>
          {current || "None"}
        </span>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-56 p-3">
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-6 gap-1.5">
            {COLOR_SWATCHES.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={swatch}
                title={swatch}
                onClick={() => commit(swatch)}
                className="relative flex h-6 w-6 items-center justify-center rounded-md border border-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ backgroundColor: swatch }}
              >
                {current.toLowerCase() === swatch && (
                  <Check className="h-3.5 w-3.5 text-white drop-shadow" />
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                if (isValidHex(draft)) commit(draft.toLowerCase());
              }}
              placeholder="#3b82f6"
              aria-label="Hex color"
              aria-invalid={(draft !== "" && !isValidHex(draft)) || undefined}
              className="h-8 font-mono text-xs aria-[invalid=true]:border-destructive"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Pick a swatch or enter a hex code and press Enter.
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
