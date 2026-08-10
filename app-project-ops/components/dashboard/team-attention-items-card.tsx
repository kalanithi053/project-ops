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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/empty-state";
import { ListSkeleton } from "@/components/shared/skeletons";
import { WorkItemInsightTitle } from "@/components/dashboard/work-item-insight-row";
import type { AttentionReason, TeamAttentionItem } from "@/lib/api/types";
import type { Tone } from "@/types/module";

const REASON_LABELS: Record<AttentionReason, string> = {
  overdue: "Overdue",
  due_soon: "Due soon",
  blocked: "Blocked",
};

const REASON_TONES: Record<AttentionReason, Tone> = {
  overdue: "error",
  due_soon: "warning",
  blocked: "neutral",
};

interface TeamAttentionItemsCardProps {
  workspaceSlug: string;
  items: TeamAttentionItem[];
  isLoading: boolean;
}

/**
 * "Team — needs attention" — every work item in the workspace that's
 * overdue, due soon, or blocked, across every assignee. Owner/Admin/Client
 * only (backs GET /work-items/attention/team); shown alongside, not instead
 * of, the caller's own personal <AttentionItemsCard>.
 */
export function TeamAttentionItemsCard({
  workspaceSlug,
  items,
  isLoading,
}: TeamAttentionItemsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Team — needs attention</CardTitle>
        <CardDescription>
          Every overdue, due-soon, or blocked item across the team
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : items.length === 0 ? (
          <EmptyState
            title="All clear"
            description="Nothing across the team needs attention right now."
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
                    <Badge
                      variant={REASON_TONES[item.reason]}
                      className="whitespace-nowrap"
                    >
                      {REASON_LABELS[item.reason]}
                    </Badge>
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
