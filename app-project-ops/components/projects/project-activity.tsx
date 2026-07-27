"use client";

import * as React from "react";
import { CirclePlus, PencilLine, UserPlus } from "lucide-react";

import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/format";
import type { ProjectMember, Task } from "@/lib/api/types";

type ActivityKind = "task-created" | "task-updated" | "member-joined";

interface ActivityEvent {
  key: string;
  at: number;
  kind: ActivityKind;
  label: string;
  detail?: string;
  /** Set once a batch of identical events has been folded into this one. */
  count?: number;
}

const ICON: Record<ActivityKind, typeof CirclePlus> = {
  "task-created": CirclePlus,
  "task-updated": PencilLine,
  "member-joined": UserPlus,
};

/** Timestamps within this window are treated as the same batch. */
const BATCH_WINDOW_MS = 60_000;

/** A task counts as edited only if it changed well after being created. */
const EDIT_THRESHOLD_MS = 2_000;

function timeOf(value?: string | null): number {
  if (!value) return 0;
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Collapses a run of same-kind events that happened together into one line.
 *
 * Provisioning writes every seeded task in one go, so without this the feed
 * would be ninety identical "created" rows and nothing else would be visible.
 */
function collapse(events: ActivityEvent[]): ActivityEvent[] {
  const out: ActivityEvent[] = [];

  for (const event of events) {
    const previous = out[out.length - 1];
    const sameBatch =
      previous &&
      previous.kind === event.kind &&
      previous.detail === event.detail &&
      Math.abs(previous.at - event.at) < BATCH_WINDOW_MS;

    if (!sameBatch) {
      out.push({ ...event });
      continue;
    }

    const count = (previous.count ?? 1) + 1;
    Object.assign(previous, {
      count,
      label:
        event.kind === "task-created"
          ? `${count} tasks created`
          : `${count} tasks updated`,
    });
  }

  return out;
}

/** Recent changes in a project, newest first. */
export function ProjectActivity({
  tasks,
  members,
  moduleNames,
  limit = 8,
}: {
  tasks: Task[];
  members: ProjectMember[];
  /** moduleInstanceId -> module name, for grouping task events. */
  moduleNames: Map<string, string>;
  limit?: number;
}) {
  const events = React.useMemo(() => {
    const raw: ActivityEvent[] = [];

    for (const task of tasks) {
      const created = timeOf(task.createdAt as string | undefined);
      const updated = timeOf(task.updatedAt as string | undefined);
      const moduleName = task.moduleInstanceId
        ? moduleNames.get(task.moduleInstanceId)
        : undefined;

      if (updated - created > EDIT_THRESHOLD_MS) {
        raw.push({
          key: `${task.id}-u`,
          at: updated,
          kind: "task-updated",
          label: `${task.prefix ?? task.name} updated`,
          detail: moduleName,
        });
      } else if (created) {
        raw.push({
          key: `${task.id}-c`,
          at: created,
          kind: "task-created",
          label: `${task.prefix ?? task.name} created`,
          detail: moduleName,
        });
      }
    }

    for (const member of members) {
      const joined = timeOf(member.joinedAt);
      if (!joined) continue;
      raw.push({
        key: `${member.id}-j`,
        at: joined,
        kind: "member-joined",
        label: `${member.user?.username ?? "Someone"} joined the project`,
      });
    }

    raw.sort((a, b) => b.at - a.at);
    return collapse(raw).slice(0, limit);
  }, [tasks, members, moduleNames, limit]);

  if (events.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing has happened in this project yet.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {events.map((event, index) => {
        const Icon = ICON[event.kind];
        return (
          <li key={event.key} className="flex flex-col">
            {index > 0 && <Separator className="my-3" />}
            <div className="flex items-start gap-3">
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm">{event.label}</span>
                {event.detail && (
                  <span className="truncate text-xs text-muted-foreground">
                    {event.detail}
                  </span>
                )}
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatDate(new Date(event.at).toISOString())}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
