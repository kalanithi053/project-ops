"use client";

import { Loader2, Square, Timer } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useMyRunningTimer, useStopTimer } from "@/lib/api/hooks/use-time-logs";
import { formatElapsedTime } from "@/lib/format";
import { useTenant } from "@/lib/tenant/tenant-context";

/**
 * Always-visible header widget for the caller's running timer — shown
 * regardless of which page they're on, since a timer can be left running
 * while browsing elsewhere. Mirrors TimeLogTimerButton's stop flow (notes
 * dialog, same mutation) but sources its workspace/project/work-item ids
 * from the running timer itself rather than the current route.
 */
export function TimerHeaderWidget() {
  const { tenant } = useTenant();
  const { data: running } = useMyRunningTimer(tenant.slug);

  const stopTimer = useStopTimer(
    running?.workspaceSlug ?? "",
    running?.projectId ?? "",
    running?.workItemId ?? "",
  );

  const [stopDialogOpen, setStopDialogOpen] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const label = running ? running.workItem.prefix ?? running.workItem.name : "";

  // Swap the tab title for "<prefix> · <elapsed>" while a timer is running,
  // restoring whatever was there once it stops.
  const previousTitleRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (running?.startTime) {
      if (previousTitleRef.current === null) {
        previousTitleRef.current = document.title;
      }
      document.title = `${label} · ${formatElapsedTime(running.startTime, now)}`;
    } else if (previousTitleRef.current !== null) {
      document.title = previousTitleRef.current;
      previousTitleRef.current = null;
    }
  }, [running, now, label]);

  if (!running?.startTime) return null;

  function confirmStop() {
    stopTimer.mutate(
      { notes: notes.trim() || undefined },
      {
        onSuccess: () => {
          setStopDialogOpen(false);
          setNotes("");
        },
      },
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="destructive"
        size="sm"
        className="gap-1.5"
        disabled={stopTimer.isPending}
        onClick={() => setStopDialogOpen(true)}
        aria-label={`Stop timer on ${label}`}
      >
        {stopTimer.isPending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Square className="h-3.5 w-3.5" />
        )}
        <Timer className="hidden h-3.5 w-3.5 sm:block" />
        <span className="hidden max-w-[10rem] truncate sm:inline">{label}</span>
        <span className="tabular-nums">{formatElapsedTime(running.startTime, now)}</span>
      </Button>

      <Dialog
        open={stopDialogOpen}
        onOpenChange={(open) => !stopTimer.isPending && setStopDialogOpen(open)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Stop timer</DialogTitle>
            <DialogDescription>
              Add a note about what you worked on, or leave it blank.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
            {running.workItem.prefix && (
              <span className="shrink-0 rounded bg-background px-1.5 py-0.5 text-xs font-medium text-muted-foreground">
                {running.workItem.prefix}
              </span>
            )}
            <span className="truncate font-medium text-foreground">
              {running.workItem.name}
            </span>
          </div>
          <Textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="What did you work on?"
            rows={3}
            autoFocus
          />
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStopDialogOpen(false)}
              disabled={stopTimer.isPending}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={confirmStop}
              disabled={stopTimer.isPending}
            >
              {stopTimer.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Stop timer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
