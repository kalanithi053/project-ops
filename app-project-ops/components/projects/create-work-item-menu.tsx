"use client";

import { AlertTriangle, Bug, ListChecks, Loader2 } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkTypes } from "@/lib/api/hooks/use-work-types";
import type { WorkType, WorkTypeCategory } from "@/lib/api/types";

const CATEGORY_ICON: Record<WorkTypeCategory, typeof ListChecks> = {
  task: ListChecks,
  incident: AlertTriangle,
  bug: Bug,
};

/**
 * Dropdown shown from a "create work item" trigger: lists the workspace's
 * active WorkTypes (task/incident/bug/…) so one can be chosen before
 * navigating to the create page with it pre-selected.
 */
export function CreateWorkItemMenu({
  workspaceSlug,
  onSelect,
  align = "end",
  children,
}: {
  workspaceSlug: string;
  onSelect: (workType: WorkType) => void;
  align?: "start" | "end";
  children: React.ReactNode;
}) {
  const { data: workTypes, isLoading } = useWorkTypes(workspaceSlug);
  const activeTypes = (workTypes ?? []).filter((type) => type.isActive);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{children}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="min-w-48">
        {isLoading ? (
          <div className="flex items-center gap-2 px-2 py-1.5 text-sm text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading…
          </div>
        ) : activeTypes.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No work types configured
          </div>
        ) : (
          activeTypes.map((type) => {
            const Icon = CATEGORY_ICON[type.category] ?? ListChecks;
            return (
              <DropdownMenuItem
                key={type.id}
                onSelect={() => onSelect(type)}
                className="gap-2"
              >
                <Icon
                  className="h-4 w-4 shrink-0"
                  style={{ color: type.color ?? undefined }}
                />
                {type.name}
              </DropdownMenuItem>
            );
          })
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
