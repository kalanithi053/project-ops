import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border text-foreground",
        success:
          "border-transparent bg-status-success-bg text-status-success",
        warning:
          "border-transparent bg-status-warning-bg text-status-warning",
        error: "border-transparent bg-status-error-bg text-status-error",
        info: "border-transparent bg-status-info-bg text-status-info",
        neutral:
          "border-transparent bg-status-neutral-bg text-status-neutral",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

/**
 * Status/label chip. Semantic variants (success/warning/error/info/neutral)
 * map to the centralized `--status-*` design tokens so status colors are
 * never hardcoded at the call site.
 */
function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
