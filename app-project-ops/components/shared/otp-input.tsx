"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useAnimationControls,
} from "framer-motion";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

export type OtpStatus = "idle" | "loading" | "success" | "error";

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
  /**
   * Drives the input's own reaction: `loading` pulses the boxes while a
   * verification request is in flight, `success` morphs the row into a
   * spinning "wheel" that resolves into a glowing checkmark, `error`
   * shakes the row (in addition to the `invalid` border state).
   */
  status?: OtpStatus;
  "aria-label"?: string;
}

/**
 * Reusable segmented one-time-code input. Renders `length` single-digit
 * boxes with auto-advance, backspace-to-previous, arrow navigation, and
 * full paste support. Numeric-only. Controlled via a single string value
 * so callers just track one piece of state.
 *
 * `status` layers on top of that: each digit flashes a highlight as it's
 * filled, the row shakes on `error`, and `success` replaces the boxes
 * with a brief spinning-ring → glowing-checkmark confirmation. The
 * `<input>` nodes themselves are never remounted (stable `key={index}`)
 * so focus/auto-advance stays reliable regardless of typing speed —
 * the highlight is a separate, non-focusable overlay per box.
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
  status = "idle",
  "aria-label": ariaLabel = "Verification code digit",
}: OtpInputProps) {
  const inputs = React.useRef<Array<HTMLInputElement | null>>([]);
  const rowControls = useAnimationControls();
  const prevStatus = React.useRef(status);
  // Bumped per-box whenever that box transitions empty → filled, to key a
  // one-shot highlight flash without ever touching the <input>'s own key.
  const [pulseKeys, setPulseKeys] = React.useState<number[]>(() =>
    Array(length).fill(0),
  );

  React.useEffect(() => {
    if (status === "error" && prevStatus.current !== "error") {
      rowControls.start({
        x: [0, -7, 7, -5, 5, 0],
        transition: { duration: 0.4 },
      });
    }
    prevStatus.current = status;
  }, [status, rowControls]);

  const digits = React.useMemo(() => {
    const chars = value.replace(/\D/g, "").slice(0, length).split("");
    while (chars.length < length) chars.push("");
    return chars;
  }, [value, length]);

  function pulse(indices: number[]) {
    setPulseKeys((prev) => {
      const next = prev.slice();
      for (const index of indices) next[index] = (next[index] ?? 0) + 1;
      return next;
    });
  }

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
    if (char) {
      pulse([index]);
      if (index < length - 1) inputs.current[index + 1]?.focus();
    }
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
    pulse(pasted.split("").map((_, index) => index));
    if (pasted.length === length) onComplete?.(pasted);
    const focusIndex = Math.min(pasted.length, length - 1);
    inputs.current[focusIndex]?.focus();
  }

  return (
    <div className="relative flex min-h-12 items-center justify-center">
      <AnimatePresence mode="wait">
        {status === "success" ? (
          <VerifiedBadge key="success" />
        ) : (
          <motion.div
            key="entry"
            animate={rowControls}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.2 }}
            className="relative flex gap-2 sm:gap-3"
          >
            {status === "loading" && (
              <motion.div
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.15, 0.35, 0.15] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                className="pointer-events-none absolute -inset-2 rounded-xl bg-primary/15"
              />
            )}
            {digits.map((digit, index) => (
              <div key={index} className="relative">
                {/* One-shot highlight flash — a sibling overlay, never the
                    input itself, so focus/value state is never disturbed. */}
                <AnimatePresence>
                  {pulseKeys[index] > 0 && (
                    <motion.span
                      key={pulseKeys[index]}
                      aria-hidden
                      initial={{ opacity: 0.55, scale: 1 }}
                      animate={{ opacity: 0, scale: 1.35 }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                      className="pointer-events-none absolute inset-0 rounded-md bg-primary/40"
                    />
                  )}
                </AnimatePresence>
                <input
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
                    "relative h-12 w-12 rounded-md border border-input bg-background text-center text-lg font-semibold shadow-sm transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    "disabled:cursor-not-allowed disabled:opacity-50",
                    "aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/20",
                    digit && "border-primary/40",
                  )}
                />
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Success confirmation shown in place of the digit boxes: a ring spins
 * once like a wheel, then settles into a glowing checkmark with a
 * "Verified" label.
 */
function VerifiedBadge() {
  const [spun, setSpun] = React.useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-2 py-1"
    >
      <div className="relative flex h-12 w-12 items-center justify-center">
        {!spun && (
          <motion.div
            aria-hidden
            initial={{ rotate: 0, opacity: 1 }}
            animate={{ rotate: 300 }}
            transition={{ duration: 0.55, ease: "circOut" }}
            onAnimationComplete={() => setSpun(true)}
            className="absolute inset-0 rounded-full border-[3px] border-primary/25 border-t-primary"
          />
        )}
        <AnimatePresence>
          {spun && (
            <motion.div
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="relative flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground"
            >
              <motion.div
                aria-hidden
                animate={{ scale: [1, 1.35, 1], opacity: [0.5, 0, 0.5] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut" }}
                className="absolute inset-0 rounded-full bg-primary"
              />
              <Check className="relative z-10 h-6 w-6 stroke-[2.5]" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {spun && (
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-sm font-medium text-foreground"
          >
            Verified
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
