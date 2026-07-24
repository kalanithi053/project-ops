import * as React from "react";
import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Minimal checkbox built on a native <input> (no Radix dependency, in
 * keeping with the app's small primitive set). The real box is a styled
 * sibling; the input stays visually hidden but fully accessible and
 * focusable.
 */
const Checkbox = React.forwardRef<
  HTMLInputElement,
  Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">
>(({ className, ...props }, ref) => {
  return (
    <span className="relative inline-flex h-4 w-4 items-center justify-center">
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[4px] border border-input bg-background transition-colors",
          "checked:border-primary checked:bg-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      />
      <Check className="pointer-events-none absolute h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100" />
    </span>
  );
});
Checkbox.displayName = "Checkbox";

export { Checkbox };
