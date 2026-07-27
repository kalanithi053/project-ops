"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { useToastStore, type Toast, type ToastVariant } from "@/lib/toast/toast-store";

const ICON: Record<ToastVariant, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const ACCENT: Record<ToastVariant, string> = {
  success: "text-status-success",
  error: "text-status-error",
  info: "text-status-info",
};

/**
 * Global toast host. Renders stacked alerts in the top-right corner
 * (100px from the top, clear of the app header), each sliding in from the
 * right and fading/sliding back out on dismiss. Fire toasts with
 * `toast.success/error/info`.
 */
export function Toaster() {
  const toasts = useToastStore((state) => state.toasts);

  return (
    <div
      className="pointer-events-none fixed right-4 top-[100px] z-[100] flex w-full max-w-sm flex-col gap-2 sm:right-6"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore((state) => state.dismiss);
  const Icon = ICON[toast.variant];

  React.useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), toast.duration);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, dismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 60, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.95, transition: { duration: 0.2 } }}
      transition={{ type: "spring", stiffness: 320, damping: 28 }}
      role="alert"
      className={cn(
        "pointer-events-auto flex w-full items-start gap-3 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-lg",
      )}
    >
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ACCENT[toast.variant])} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.description && (
          <p className="text-sm text-muted-foreground">{toast.description}</p>
        )}
      </div>
      <button
        type="button"
        onClick={() => dismiss(toast.id)}
        aria-label="Dismiss"
        className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}
