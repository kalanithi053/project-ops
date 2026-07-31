"use client";

import * as React from "react";
import { motion, type Variants } from "framer-motion";
import { ArrowLeft, ArrowRight, CheckCheck, Sparkles, X } from "lucide-react";

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

/** Card-level entrance (scale/opacity) also drives the staggered reveal of its children below. */
function cardVariants(centered: boolean): Variants {
  return {
    hidden: { opacity: 0, scale: 0.96, y: centered ? 8 : 0 },
    visible: {
      opacity: 1,
      scale: 1,
      y: 0,
      transition: {
        type: "spring",
        stiffness: 340,
        damping: 30,
        staggerChildren: 0.06,
        delayChildren: 0.08,
      },
    },
    exit: { opacity: 0, scale: 0.96, transition: { duration: 0.15 } },
  };
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

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
  const Icon = step.icon ?? Sparkles;
  const progressPct = ((stepIndex + 1) / stepCount) * 100;

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-label={step.title}
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={cardVariants(centered)}
      style={
        centered
          ? undefined
          : { position: "fixed", top: position!.top, left: position!.left, width: CARD_WIDTH }
      }
      className={cn(
        "pointer-events-auto relative z-[210] w-80 overflow-hidden rounded-lg border border-border bg-popover p-5 text-popover-foreground shadow-lg",
        centered && "fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
      )}
    >
      {centered && (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 22% 12%, color-mix(in oklch, var(--primary) 22%, transparent), transparent 65%)",
          }}
          aria-hidden
        />
      )}

      <button
        type="button"
        onClick={onSkip}
        aria-label="Skip tour"
        className="absolute right-3 top-3 z-10 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>

      <motion.div variants={itemVariants} className="relative mb-4 flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <motion.span
            className="flex items-center justify-center"
            animate={
              isLast || step.id === "welcome" || step.id === "project-welcome"
                ? { rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }
                : undefined
            }
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          >
            <Icon className="h-5 w-5" />
          </motion.span>
        </span>
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-ring"
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
          />
        </div>
      </motion.div>

      <motion.p variants={itemVariants} className="relative mb-1 text-xs font-medium text-muted-foreground">
        Step {stepIndex + 1} of {stepCount}
      </motion.p>
      <motion.h3 variants={itemVariants} className="relative mb-1.5 pr-4 text-base font-semibold text-foreground">
        {step.title}
      </motion.h3>
      <motion.p variants={itemVariants} className="relative mb-5 text-sm text-muted-foreground">
        {step.body}
      </motion.p>

      <motion.div variants={itemVariants} className="relative flex items-center justify-between gap-2">
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
      </motion.div>
    </motion.div>
  );
}
