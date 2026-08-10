"use client";

import Link from "next/link";
import { ListChecks } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/skeletons";
import { WorkItemInsightTitle } from "@/components/dashboard/work-item-insight-row";
import type { PriorityItem } from "@/lib/api/types";

interface PriorityItemsCardProps {
  workspaceSlug: string;
  items: PriorityItem[];
  isLoading: boolean;
}

/**
 * "Priority work items" — the signed-in user's own open items, most urgent
 * priority first. Backs GET /work-items/priority.
 */
export function PriorityItemsCard({
  workspaceSlug,
  items,
  isLoading,
}: PriorityItemsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Priority work items</CardTitle>
        <CardDescription>
          Your open high-priority and urgent items, most urgent first
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing open"
            description="You have no open work items assigned to you."
            icon={ListChecks}
            className="py-8"
          />
        ) : (
          <ul className="flex flex-col">
            {items.map((item, index) => (
              <li key={item.id}>
                {index > 0 && <Separator className="my-3" />}
                <Link
                  href={`/${workspaceSlug}/projects/${item.project.id}/work-items/${item.id}`}
                  className="flex items-start justify-between gap-3 rounded-md -mx-1 px-1 py-0.5 transition-colors hover:bg-accent"
                >
                  <WorkItemInsightTitle item={item} />
                  {item.priority && (
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{
                          backgroundColor: item.priority.color ?? "var(--status-neutral)",
                        }}
                        aria-hidden
                      />
                      {item.priority.name}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
