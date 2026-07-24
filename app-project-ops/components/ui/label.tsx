import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Form field label. Kept as a plain <label> (no Radix dependency) to
 * stay in line with the app's minimal primitive set; associate it with
 * a control via the standard `htmlFor` attribute.
 */
const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          "text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
          className,
        )}
        {...props}
      />
    );
  },
);
Label.displayName = "Label";

export { Label };
