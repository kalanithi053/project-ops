"use client";

import * as React from "react";
import { Loader2, Play, Square, Timer } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SelectField, type SelectOption } from "@/components/shared/select-field";
import { EmptyState } from "@/components/shared/empty-state";
import {
  useMyRunningTimer,
  useStartTimer,
  useStopTimer,
} from "@/lib/api/hooks/use-time-logs";
import { formatElapsedTime } from "@/lib/format";
import type { MyOpenWorkItem } from "@/lib/api/types";

interface QuickTimeLogCardProps {
  workspaceSlug: string;
  items: MyOpenWorkItem[];
  isLoading: boolean;
}

/**
 * Starts/stops a timer against one of the caller's own open work items,
 * right from the dashboard. Deliberately timer-only, no manual duration
 * entry — that flow already lives on the work item's own page; this is the
 * "quick" one-click entry point. A note-less stop is fine here; adding
 * notes still goes through the work item page or the header widget's stop
 * dialog.
 */
export function QuickTimeLogCard({
  workspaceSlug,
  items,
  isLoading,
}: QuickTimeLogCardProps) {
  const [workItemId, setWorkItemId] = React.useState("");
  const { data: running } = useMyRunningTimer(workspaceSlug);

  const selected = items.find((item) => item.id === workItemId);
  const startTimer = useStartTimer(
    workspaceSlug,
    selected?.project.id ?? "",
    workItemId,
  );
  const stopTimer = useStopTimer(
    running?.workspaceSlug ?? workspaceSlug,
    running?.projectId ?? "",
    running?.workItemId ?? "",
  );

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const options: SelectOption[] = items.map((item) => ({
    value: item.id,
    label: item.prefix ? `${item.prefix} · ${item.name}` : item.name,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick time log</CardTitle>
        <CardDescription>Start a timer on one of your open items</CardDescription>
      </CardHeader>
      <CardContent>
        {running ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
              {running.workItem.prefix && (
                <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                  {running.workItem.prefix}
                </span>
              )}
              <span className="truncate font-medium text-foreground">
                {running.workItem.name}
              </span>
              {running.startTime && (
                <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
                  {formatElapsedTime(running.startTime, now)}
                </span>
              )}
            </div>
            <Button
              type="button"
              variant="destructive"
              onClick={() => stopTimer.mutate({})}
              disabled={stopTimer.isPending}
              className="w-full sm:w-auto"
            >
              {stopTimer.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Stop timer
            </Button>
          </div>
        ) : !isLoading && items.length === 0 ? (
          <EmptyState
            title="No open items"
            description="Time can only be logged against a work item assigned to you."
            icon={Timer}
            className="py-8"
          />
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="quick-log-work-item">Work item</Label>
              <SelectField
                id="quick-log-work-item"
                options={options}
                value={workItemId}
                onValueChange={setWorkItemId}
                placeholder={isLoading ? "Loading…" : "Select a work item"}
                disabled={isLoading}
              />
            </div>
            <Button
              type="button"
              onClick={() => startTimer.mutate()}
              disabled={!workItemId || startTimer.isPending}
              className="w-full sm:w-auto"
            >
              {startTimer.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Start timer
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
