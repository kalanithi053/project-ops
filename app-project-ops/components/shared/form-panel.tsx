"use client";

import * as React from "react";

import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface FormPanelProps {
  title: string;
  description?: string;
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  /** Action buttons for the sticky footer. */
  footer: React.ReactNode;
  /** Panel width from `sm` up. Defaults to `md`. */
  size?: "sm" | "md" | "lg" | "xl";
  /** Blocks dismissal while a mutation is in flight. */
  busy?: boolean;
  children: React.ReactNode;
}

/**
 * Right-side editing panel: header, scrollable body, sticky footer.
 *
 * Every create/edit form in the app uses this instead of a centered modal —
 * a panel keeps the list or board it was opened from visible behind it, so
 * the edit reads as happening *to* something on screen rather than replacing
 * it. The panel is rendered only while mounted, so callers control
 * visibility by mounting/unmounting rather than passing `open`.
 */
export function FormPanel({
  title,
  description,
  onClose,
  onSubmit,
  footer,
  size = "md",
  busy = false,
  children,
}: FormPanelProps) {
  return (
    <Sheet open onOpenChange={(open) => !open && !busy && onClose()}>
      <SheetContent side="right" size={size}>
        <SheetHeader>
          <SheetTitle className="text-base">{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>

        <form
          onSubmit={onSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <SheetBody>{children}</SheetBody>
          <SheetFooter>{footer}</SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
