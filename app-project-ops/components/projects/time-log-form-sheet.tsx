"use client";

import * as React from "react";

import { SelectField } from "@/components/shared/select-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import {
  useCreateTimeLog,
  useUpdateTimeLog,
} from "@/lib/api/hooks/use-time-logs";
import type { TimeLog, TimeLogBillingType } from "@/lib/api/types";
import { minLoggableDate, todayDateInput } from "@/lib/format";

const BILLING_OPTIONS: { value: TimeLogBillingType; label: string }[] = [
  { value: "billable", label: "Billable" },
  { value: "non_billable", label: "Non-billable" },
];

function toDateInput(value?: string | null): string {
  return value ? value.slice(0, 10) : "";
}

function toTimeInput(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

/** Add/edit form for a manual time log entry — shared by the work item panel
 * and the project-level Time Logs tab. */
export function TimeLogFormSheet({
  workspaceSlug,
  projectId,
  workItemId,
  entry,
  open,
  onOpenChange,
}: {
  workspaceSlug: string;
  projectId: string;
  workItemId: string;
  /** Present when editing an existing entry; null/undefined when adding one. */
  entry?: TimeLog | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const create = useCreateTimeLog(workspaceSlug, projectId, workItemId);
  const update = useUpdateTimeLog(workspaceSlug, projectId, workItemId);
  const { data: settings } = useWorkspaceSettings(workspaceSlug);
  const minDate = minLoggableDate(settings?.preferences);
  const isEdit = Boolean(entry);

  // Initial values only — the parent remounts this component (via a `key`
  // keyed to the target entry) each time it's opened, so there's no stale
  // state to reset once it's already mounted.
  const [date, setDate] = React.useState(() =>
    entry ? toDateInput(entry.date) : todayDateInput(),
  );
  const [duration, setDuration] = React.useState(() =>
    entry ? String(entry.durationMinutes) : "",
  );
  const [usePeriod, setUsePeriod] = React.useState(() =>
    Boolean(entry?.startTime && entry?.endTime),
  );
  const [startTime, setStartTime] = React.useState(() =>
    toTimeInput(entry?.startTime),
  );
  const [endTime, setEndTime] = React.useState(() => toTimeInput(entry?.endTime));
  const [billingType, setBillingType] = React.useState<TimeLogBillingType>(
    () => entry?.billingType ?? "billable",
  );
  const [notes, setNotes] = React.useState(() => entry?.notes ?? "");
  const [error, setError] = React.useState<string | null>(null);

  const pending = create.isPending || update.isPending;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!date) return setError("Choose a date.");
    if (minDate && date < minDate) {
      return setError(`You can't log time before ${minDate}.`);
    }
    if (usePeriod && (!startTime || !endTime)) {
      return setError("Set both a start and an end time.");
    }
    if (!usePeriod && (!duration || Number(duration) < 1)) {
      return setError("Enter a duration of at least 1 minute.");
    }

    const dto = {
      date,
      billingType,
      notes: notes.trim() || undefined,
      ...(usePeriod
        ? {
            startTime: new Date(`${date}T${startTime}`).toISOString(),
            endTime: new Date(`${date}T${endTime}`).toISOString(),
          }
        : { durationMinutes: Number(duration) }),
    };

    if (isEdit && entry) {
      update.mutate(
        { id: entry.id, dto },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      create.mutate(dto, { onSuccess: () => onOpenChange(false) });
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" size="md">
        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <SheetHeader>
            <SheetTitle>{isEdit ? "Edit time log" : "Add time log"}</SheetTitle>
            <SheetDescription>
              Log time worked on this item, manually or with an exact period.
            </SheetDescription>
          </SheetHeader>
          <SheetBody>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Date
              <Input
                type="date"
                value={date}
                min={minDate}
                onChange={(event) => setDate(event.target.value)}
              />
            </label>

            {!usePeriod && (
              <label className="flex flex-col gap-1.5 text-sm font-medium">
                Duration (minutes)
                <Input
                  type="number"
                  min={1}
                  value={duration}
                  onChange={(event) => setDuration(event.target.value)}
                  placeholder="30"
                />
              </label>
            )}

            <label className="flex items-center justify-between text-sm font-medium">
              Set start &amp; end time
              <Switch checked={usePeriod} onCheckedChange={setUsePeriod} />
            </label>

            {usePeriod && (
              <div className="grid grid-cols-2 gap-3">
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Start time
                  <Input
                    type="time"
                    value={startTime}
                    onChange={(event) => setStartTime(event.target.value)}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  End time
                  <Input
                    type="time"
                    value={endTime}
                    onChange={(event) => setEndTime(event.target.value)}
                  />
                </label>
              </div>
            )}

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Billing type
              <SelectField
                aria-label="Billing type"
                options={BILLING_OPTIONS}
                value={billingType}
                onValueChange={(value) =>
                  setBillingType(value as TimeLogBillingType)
                }
              />
            </label>

            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Notes
              <Textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="What did you work on?"
                rows={3}
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </SheetBody>
          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : isEdit ? "Save changes" : "Add"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
