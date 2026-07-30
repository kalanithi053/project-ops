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
import {
  useStartTimer,
  useStopTimer,
  useWorkItemTimeLogs,
} from "@/lib/api/hooks/use-time-logs";

/** Elapsed time since `startTime` as "12:34" (or "1:02:34" past an hour). */
function formatElapsed(startTime: string, now: number): string {
  const totalSeconds = Math.max(
    0,
    Math.floor((now - new Date(startTime).getTime()) / 1000),
  );
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours > 0 ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}

/**
 * Start/stop toggle for the work item's own timer. Only rendered for the
 * item's assignee — the API enforces the same restriction, this just avoids
 * showing a button that would 403.
 */
export function TimeLogTimerButton({
  workspaceSlug,
  projectId,
  workItemId,
}: {
  workspaceSlug: string;
  projectId: string;
  workItemId: string;
}) {
  const { data } = useWorkItemTimeLogs(workspaceSlug, projectId, workItemId);
  const startTimer = useStartTimer(workspaceSlug, projectId, workItemId);
  const stopTimer = useStopTimer(workspaceSlug, projectId, workItemId);
  const running = data?.runningTimer;
  const [stopDialogOpen, setStopDialogOpen] = React.useState(false);
  const [notes, setNotes] = React.useState("");

  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const pending = startTimer.isPending || stopTimer.isPending;

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

  if (running?.startTime) {
    return (
      <>
        <Button
          type="button"
          variant="destructive"
          disabled={pending}
          onClick={() => setStopDialogOpen(true)}
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          Stop · {formatElapsed(running.startTime, now)}
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
                {stopTimer.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                Stop timer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      disabled={pending}
      onClick={() => startTimer.mutate()}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Timer className="h-4 w-4" />
      )}
      Start timer
    </Button>
  );
}
