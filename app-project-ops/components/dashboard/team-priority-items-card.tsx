"use client";

import Link from "next/link";
import { Users } from "lucide-react";

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
import type { TeamPriorityItem } from "@/lib/api/types";

interface TeamPriorityItemsCardProps {
  workspaceSlug: string;
  items: TeamPriorityItem[];
  isLoading: boolean;
}

/**
 * "Team — priority work items" — every open high-priority/urgent item in
 * the workspace, across every assignee. Owner/Admin/Client only (backs
 * GET /work-items/priority/team); shown alongside, not instead of, the
 * caller's own personal <PriorityItemsCard>.
 */
export function TeamPriorityItemsCard({
  workspaceSlug,
  items,
  isLoading,
}: TeamPriorityItemsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team — priority work items</CardTitle>
        <CardDescription>
          Every open high-priority and urgent item across the team
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : items.length === 0 ? (
          <EmptyState
            title="Nothing open"
            description="No high-priority or urgent items are open across the team."
            icon={Users}
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
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {item.priority && (
                      <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
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
                    {item.assignee && (
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {item.assignee.name}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
