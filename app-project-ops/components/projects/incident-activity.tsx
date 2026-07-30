"use client";

import {
  CirclePlus,
  History,
  Loader2,
  MessageSquare,
  PencilLine,
  RefreshCw,
  Timer,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useIncidentActivity } from "@/lib/api/hooks/use-incidents";
import type { IncidentActivityEntry } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function iconForAction(action: IncidentActivityEntry["action"]) {
  switch (action) {
    case "created":
      return CirclePlus;
    case "comment_added":
      return MessageSquare;
    case "status_changed":
      return RefreshCw;
    case "time_logged":
      return Timer;
    default:
      return PencilLine;
  }
}

export function IncidentActivity({
  workspaceSlug,
  projectId,
  incidentId,
}: {
  workspaceSlug: string;
  projectId: string;
  incidentId: string;
}) {
  const activity = useIncidentActivity(workspaceSlug, projectId, incidentId);

  return (
    <section className="border-t border-border pt-4" aria-labelledby="incident-activity-heading">
      <div className="mb-3 flex items-center justify-between">
        <h2
          id="incident-activity-heading"
          className="inline-flex items-center gap-2 text-sm font-semibold"
        >
          <History className="h-4 w-4 text-muted-foreground" />
          Activity
        </h2>
        {activity.data && (
          <span className="text-xs text-muted-foreground">
            {activity.data.length} {activity.data.length === 1 ? "event" : "events"}
          </span>
        )}
      </div>

      {activity.isLoading ? (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading activity…
        </div>
      ) : activity.isError ? (
        <div className="flex items-center justify-between gap-3 rounded-md border border-dashed border-border p-3">
          <p className="text-sm text-muted-foreground">
            Activity could not be loaded.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => activity.refetch()}
          >
            Retry
          </Button>
        </div>
      ) : activity.data?.length ? (
        <ol className="flex flex-col">
          {activity.data.map((entry, index) => {
            const Icon = iconForAction(entry.action);
            return (
              <li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
                {index < activity.data.length - 1 && (
                  <span
                    className="absolute bottom-0 left-3.5 top-7 w-px bg-border"
                    aria-hidden
                  />
                )}
                <Avatar className="relative z-10 h-7 w-7 border border-border bg-background">
                  <AvatarFallback className="text-[10px]">
                    {initials(entry.actor) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className="text-sm leading-5">{entry.description}</p>
                  <time
                    dateTime={entry.createdAt}
                    className="mt-0.5 block text-xs text-muted-foreground"
                  >
                    {formatDateTime(entry.createdAt)}
                  </time>
                </div>
                <Icon
                  className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-muted-foreground">
          No activity has been recorded for this incident.
        </p>
      )}
    </section>
  );
}
