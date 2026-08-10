"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

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
import type { AttentionItem, AttentionReason } from "@/lib/api/types";
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

interface AttentionItemsCardProps {
  workspaceSlug: string;
  items: AttentionItem[];
  isLoading: boolean;
}

/**
 * "Needs your attention" — the signed-in user's own overdue, due-soon, and
 * blocked work items. Backs GET /work-items/attention.
 */
export function AttentionItemsCard({
  workspaceSlug,
  items,
  isLoading,
}: AttentionItemsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs your attention</CardTitle>
        <CardDescription>
          Your work items that are overdue, due soon, or blocked
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <ListSkeleton rows={3} />
        ) : items.length === 0 ? (
          <EmptyState
            title="All clear"
            description="Nothing assigned to you needs attention right now."
            icon={AlertTriangle}
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
                  <Badge
                    variant={REASON_TONES[item.reason]}
                    className="shrink-0 whitespace-nowrap"
                  >
                    {REASON_LABELS[item.reason]}
                  </Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
