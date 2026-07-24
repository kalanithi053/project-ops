"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

interface OtpInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  autoFocus?: boolean;
  /** Render digits as password dots (for a numeric PIN/password). */
  mask?: boolean;
  "aria-label"?: string;
}

/**
 * Reusable segmented one-time-code input. Renders `length` single-digit
 * boxes with auto-advance, backspace-to-previous, arrow navigation, and
 * full paste support. Numeric-only. Controlled via a single string value
 * so callers just track one piece of state.
 */
export function OtpInput({
  length = 4,
  value,
  onChange,
  onComplete,
  disabled,
  invalid,
  autoFocus,
  mask = false,
  "aria-label": ariaLabel = "Verification code digit",
}: OtpInputProps) {
  const inputs = React.useRef<Array<HTMLInputElement | null>>([]);

  const digits = React.useMemo(() => {
    const chars = value.replace(/\D/g, "").slice(0, length).split("");
    while (chars.length < length) chars.push("");
    return chars;
  }, [value, length]);

  function commit(next: string[]) {
    const joined = next.join("").slice(0, length);
    onChange(joined);
    // `join` collapses empty slots, so a full-length result means every
    // box is filled. (Don't use `includes("")` here — it's always true.)
    if (joined.length === length) onComplete?.(joined);
  }

  function handleChange(index: number, raw: string) {
    const char = raw.replace(/\D/g, "").slice(-1);
    const next = digits.slice();
    next[index] = char;
    commit(next);
    if (char && index < length - 1) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(
    index: number,
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Backspace") {
      event.preventDefault();
      const next = digits.slice();
      if (next[index]) {
        next[index] = "";
        commit(next);
      } else if (index > 0) {
        next[index - 1] = "";
        commit(next);
        inputs.current[index - 1]?.focus();
      }
    } else if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      inputs.current[index - 1]?.focus();
    } else if (event.key === "ArrowRight" && index < length - 1) {
      event.preventDefault();
      inputs.current[index + 1]?.focus();
    }
  }

  function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, length);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    if (pasted.length === length) onComplete?.(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputs.current[focusIndex]?.focus();
  }

  return (
    <div className="flex gap-2 sm:gap-3">
      {digits.map((digit, index) => (
        <input
          // Fixed-length control; index keys are stable here.
          key={index}
          ref={(element) => {
            inputs.current[index] = element;
          }}
          value={digit}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          type={mask ? "password" : "text"}
          inputMode="numeric"
          autoComplete={mask ? "off" : index === 0 ? "one-time-code" : "off"}
          maxLength={1}
          disabled={disabled}
          aria-invalid={invalid || undefined}
          aria-label={`${ariaLabel} ${index + 1}`}
          autoFocus={autoFocus && index === 0}
          className={cn(
            "h-12 w-12 rounded-md border border-input bg-background text-center text-lg font-semibold shadow-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            "disabled:cursor-not-allowed disabled:opacity-50",
            "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20",
          )}
        />
      ))}
    </div>
  );
}
