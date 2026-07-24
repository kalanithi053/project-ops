import type { LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

interface PageHeaderProps {
  title: string;
  description?: string;
  primaryAction?: { label: string; icon?: LucideIcon };
}

/**
 * Standard module header: title + description on the left, an optional
 * primary action on the right. Driven by config so every module's
 * heading block is laid out identically.
 */
export function PageHeader({
  title,
  description,
  primaryAction,
}: PageHeaderProps) {
  const ActionIcon = primaryAction?.icon;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {primaryAction && (
        <Button className="w-full sm:w-auto">
          {ActionIcon && <ActionIcon className="h-4 w-4" />}
          {primaryAction.label}
        </Button>
      )}
    </div>
  );
}
