"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";

import type { TourStep } from "@/lib/tour/tour-config";
import { TourStepCard } from "@/components/tour/tour-step-card";

interface TourOverlayProps {
  step: TourStep;
  stepIndex: number;
  stepCount: number;
  workspaceSlug?: string;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const WAIT_TIMEOUT_MS = 4000;
const SPOTLIGHT_PADDING = 6;

function isVisible(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findTarget(selector: string): HTMLElement | null {
  const matches = document.querySelectorAll<HTMLElement>(`[data-tour="${selector}"]`);
  for (const el of matches) {
    if (isVisible(el)) return el;
  }
  return null;
}

/** Resolves once a visible `[data-tour="selector"]` element exists, or null after `timeout`. */
function waitForElement(selector: string, timeout: number): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    const existing = findTarget(selector);
    if (existing) {
      resolve(existing);
      return;
    }

    const observer = new MutationObserver(() => {
      const el = findTarget(selector);
      if (el) {
        observer.disconnect();
        clearTimeout(timer);
        resolve(el);
      }
    });
    observer.observe(document.body, { childList: true, subtree: true, attributes: true });

    const timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeout);
  });
}

/**
 * Renders the full-viewport coach-mark experience for the current step: a
 * dimmed scrim with a spotlight cutout around the target element (or a
 * centered card for selector-less welcome/finish steps), plus the step
 * card itself. Handles navigating to the step's route, waiting for the
 * target to mount, and tracking its position across scroll/resize.
 */
export function TourOverlay({
  step,
  stepIndex,
  stepCount,
  workspaceSlug,
  onNext,
  onBack,
  onSkip,
}: TourOverlayProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [target, setTarget] = React.useState<HTMLElement | null>(null);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [ready, setReady] = React.useState(false);
  const onNextRef = React.useRef(onNext);
  const onBackRef = React.useRef(onBack);
  const onSkipRef = React.useRef(onSkip);
  React.useEffect(() => {
    onNextRef.current = onNext;
    onBackRef.current = onBack;
    onSkipRef.current = onSkip;
  });

  // Navigate to the step's route (if needed) and wait for its target to mount.
  React.useEffect(() => {
    // Resetting local state when `step.id` changes (not every render) is the
    // "synchronize with an external system" case Effects exist for — the new
    // target has to be located (possibly after a route change) before the
    // spotlight/card can show again, which can't be derived during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReady(false);
    setTarget(null);
    setRect(null);

    if (!step.selector) {
      setReady(true);
      return;
    }

    let cancelled = false;

    if (step.route && workspaceSlug) {
      const targetPath = `/${workspaceSlug}${step.route}`;
      if (pathname !== targetPath) router.push(targetPath);
    }

    waitForElement(step.selector, WAIT_TIMEOUT_MS).then((el) => {
      if (cancelled) return;
      if (!el) {
        console.warn(`[tour] target "${step.selector}" not found — skipping step`);
        onNextRef.current();
        return;
      }
      // An animated ("smooth") scroll here races the scroll-lock effect's
      // `body.style.overflow = "hidden"` below: locking overflow mid-animation
      // freezes the compositor's in-flight scroll offset, leaving the painted
      // frame (sticky header/sidebar included) stuck at a stale position even
      // though layout — and getBoundingClientRect — already reflect the final
      // scroll. An instant jump has no animation window for that to land in.
      el.scrollIntoView({ block: "center", behavior: "auto" });
      setTarget(el);
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
    // Re-run only when the step itself changes — `pathname`/`router` are read once per step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step.id]);

  // Track the target's position while it's visible.
  React.useLayoutEffect(() => {
    if (!target) return;

    function update() {
      setRect(target!.getBoundingClientRect());
    }
    update();

    const resizeObserver = new ResizeObserver(update);
    resizeObserver.observe(target);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [target]);

  // Lock page scroll and wire keyboard shortcuts while the tour is on screen.
  // Mounts once for the overlay's whole lifetime (empty deps) — reading
  // onNext/onBack/onSkip via refs instead of closing over them directly.
  //
  // Deliberately does NOT toggle `body.style.overflow`: the app shell's
  // header/sidebar are `position: sticky` against the document scroller, and
  // toggling that scroller's `overflow` around the scrollIntoView call above
  // leaves the browser's compositor holding a stale painted position for
  // those sticky layers — getBoundingClientRect reports the correct layout
  // immediately, but the frame stays visually wrong until something forces a
  // repaint. Blocking the scroll-producing input events instead (wheel,
  // touch, and scroll-relevant keys) locks scrolling without ever touching
  // `overflow`, so there's nothing for the compositor to desync.
  React.useEffect(() => {
    function preventScroll(event: Event) {
      event.preventDefault();
    }
    window.addEventListener("wheel", preventScroll, { passive: false });
    window.addEventListener("touchmove", preventScroll, { passive: false });

    const SCROLL_KEYS = new Set([
      "ArrowUp",
      "ArrowDown",
      "PageUp",
      "PageDown",
      "Home",
      "End",
      " ",
    ]);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onSkipRef.current();
      } else if (event.key === "ArrowRight" || event.key === "Enter") {
        event.preventDefault();
        onNextRef.current();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        onBackRef.current();
      } else if (SCROLL_KEYS.has(event.key)) {
        event.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("wheel", preventScroll);
      window.removeEventListener("touchmove", preventScroll);
      window.removeEventListener("keydown", onKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (typeof document === "undefined") return null;

  const isCentered = !step.selector;

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      <AnimatePresence>
        {isCentered ? (
          <motion.div
            key="centered-scrim"
            className="fixed inset-0 bg-black/60"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        ) : (
          ready &&
          rect && (
            <motion.div
              key="spotlight"
              className="pointer-events-none fixed rounded-md"
              style={{
                top: rect.top - SPOTLIGHT_PADDING,
                left: rect.left - SPOTLIGHT_PADDING,
                width: rect.width + SPOTLIGHT_PADDING * 2,
                height: rect.height + SPOTLIGHT_PADDING * 2,
              }}
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                boxShadow: [
                  "0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 2px var(--ring), 0 0 20px 2px var(--ring)",
                  "0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 5px var(--primary), 0 0 28px 6px var(--primary)",
                  "0 0 0 9999px rgba(0,0,0,0.6), 0 0 0 2px var(--ring), 0 0 20px 2px var(--ring)",
                ],
              }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 0.2 },
                boxShadow: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
              }}
            />
          )
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {ready && (
          <TourStepCard
            key={step.id}
            step={step}
            stepIndex={stepIndex}
            stepCount={stepCount}
            rect={isCentered ? null : rect}
            onNext={onNext}
            onBack={onBack}
            onSkip={onSkip}
          />
        )}
      </AnimatePresence>
    </div>,
    document.body,
  );
}
