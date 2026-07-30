"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCheck, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { TourStep } from "@/lib/tour/tour-config";

interface TourStepCardProps {
  step: TourStep;
  stepIndex: number;
  stepCount: number;
  /** Target bounding rect, or null for the centered welcome/finish cards. */
  rect: DOMRect | null;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
}

const CARD_WIDTH = 320;
const EST_CARD_HEIGHT = 210;
const GAP = 16;
const VIEWPORT_MARGIN = 16;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

/** Picks a side near the target that fits the viewport, flipping if the preferred side would overflow. */
function computePosition(rect: DOMRect, placement: TourStep["placement"] = "bottom") {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let side = placement;
  if (side === "right" && rect.right + GAP + CARD_WIDTH > vw - VIEWPORT_MARGIN) {
    side = rect.left - GAP - CARD_WIDTH > VIEWPORT_MARGIN ? "left" : "bottom";
  }
  if (side === "left" && rect.left - GAP - CARD_WIDTH < VIEWPORT_MARGIN) {
    side = rect.right + GAP + CARD_WIDTH < vw - VIEWPORT_MARGIN ? "right" : "bottom";
  }
  if (side === "bottom" && rect.bottom + GAP + EST_CARD_HEIGHT > vh - VIEWPORT_MARGIN) {
    side = "top";
  }
  if (side === "top" && rect.top - GAP - EST_CARD_HEIGHT < VIEWPORT_MARGIN) {
    side = "bottom";
  }

  if (side === "left" || side === "right") {
    return {
      top: clamp(rect.top, VIEWPORT_MARGIN, vh - EST_CARD_HEIGHT - VIEWPORT_MARGIN),
      left: side === "right" ? rect.right + GAP : rect.left - GAP - CARD_WIDTH,
    };
  }

  return {
    top: side === "bottom" ? rect.bottom + GAP : rect.top - GAP - EST_CARD_HEIGHT,
    left: clamp(rect.left, VIEWPORT_MARGIN, vw - CARD_WIDTH - VIEWPORT_MARGIN),
  };
}

export function TourStepCard({
  step,
  stepIndex,
  stepCount,
  rect,
  onNext,
  onBack,
  onSkip,
}: TourStepCardProps) {
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === stepCount - 1;
  const centered = !rect;
  const position = rect ? computePosition(rect, step.placement) : null;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      initial={{ opacity: 0, scale: 0.96, y: centered ? 8 : 0 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: "spring", stiffness: 340, damping: 30 }}
      style={
        centered
          ? undefined
          : { position: "fixed", top: position!.top, left: position!.left, width: CARD_WIDTH }
      }
      className={cn(
        "pointer-events-auto relative z-[210] w-80 rounded-lg border border-border bg-popover p-5 text-popover-foreground shadow-lg",
        centered && "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
      )}
    >
      <button
        type="button"
        onClick={onSkip}
        aria-label="Skip tour"
        className="absolute right-3 top-3 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="mb-3 flex items-center gap-1.5">
        {Array.from({ length: stepCount }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "h-1 flex-1 rounded-full transition-colors",
              i <= stepIndex ? "bg-primary" : "bg-muted",
            )}
          />
        ))}
      </div>

      <p className="mb-1 text-xs font-medium text-muted-foreground">
        Step {stepIndex + 1} of {stepCount}
      </p>
      <h3 className="mb-1.5 pr-4 text-base font-semibold text-foreground">{step.title}</h3>
      <p className="mb-5 text-sm text-muted-foreground">{step.body}</p>

      <div className="flex items-center justify-between gap-2">
        {!isLast ? (
          <Button variant="ghost" size="sm" onClick={onSkip} className="text-muted-foreground">
            Skip tour
          </Button>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-3.5 w-3.5" />
              Back
            </Button>
          )}
          <Button size="sm" onClick={onNext}>
            {isLast ? (
              <>
                Finish
                <CheckCheck className="h-3.5 w-3.5" />
              </>
            ) : (
              <>
                Next
                <ArrowRight className="h-3.5 w-3.5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
