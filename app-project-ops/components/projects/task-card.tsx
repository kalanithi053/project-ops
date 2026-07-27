"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Boxes, CalendarDays, Clock, GripVertical } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatDate } from "@/lib/format";
import type { Task } from "@/lib/api/types";

/** Two-letter monogram for an assignee with no avatar image. */
function initials(username: string) {
  return username.slice(0, 2).toUpperCase();
}

/** Avatars shown before collapsing the rest into a "+N" chip. */
const MAX_VISIBLE_ASSIGNEES = 3;

/**
 * The visual card, with no drag or click wiring — shared between the
 * in-column sortable card and the <DragOverlay> copy, so the lifted card is
 * pixel identical to the one it left behind.
 */
export function TaskCardView({
  task,
  moduleName,
  overlay = false,
}: {
  task: Task;
  moduleName?: string;
  /** Renders the lifted copy inside <DragOverlay>. */
  overlay?: boolean;
}) {
  const overdue = task.dueDate ? new Date(task.dueDate) < new Date() : false;
  const assignees = task.assignees ?? [];

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md border border-border bg-card p-3 text-left shadow-sm transition-colors",
        overlay && "rotate-2 shadow-lg",
      )}
    >
      {task.prefix && (
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
          {task.prefix}
        </span>
      )}

      <p className="pr-4 text-sm font-medium leading-snug">{task.name}</p>

      {(task.priority ||
        moduleName ||
        task.dueDate ||
        task.etaHours != null ||
        assignees.length > 0) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-0.5">
          {task.priority && (
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{
                  backgroundColor: task.priority.color ?? "var(--status-neutral)",
                }}
                aria-hidden
              />
              {task.priority.name}
            </span>
          )}

          {moduleName && (
            <span className="inline-flex min-w-0 items-center gap-1 text-xs text-muted-foreground">
              <Boxes className="h-3 w-3 shrink-0" />
              <span className="truncate">{moduleName}</span>
            </span>
          )}

          {task.dueDate && (
            <span
              className={cn(
                "inline-flex items-center gap-1 text-xs",
                overdue ? "text-status-error" : "text-muted-foreground",
              )}
            >
              <CalendarDays className="h-3 w-3 shrink-0" />
              {formatDate(task.dueDate)}
            </span>
          )}

          {task.etaHours != null && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3 shrink-0" />
              {task.etaHours}h
            </span>
          )}

          {assignees.length > 0 && (
            <span className="ml-auto flex -space-x-1.5">
              {/* Overlapping avatars, capped so a heavily-shared task doesn't
                  push the card's other metadata off the row. */}
              {assignees.slice(0, MAX_VISIBLE_ASSIGNEES).map(({ user }) => (
                <Avatar
                  key={user.id}
                  className="h-5 w-5 ring-2 ring-card"
                  title={user.username}
                >
                  <AvatarFallback className="text-[10px]">
                    {initials(user.username)}
                  </AvatarFallback>
                </Avatar>
              ))}
              {assignees.length > MAX_VISIBLE_ASSIGNEES && (
                <span className="flex h-5 items-center rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground ring-2 ring-card">
                  +{assignees.length - MAX_VISIBLE_ASSIGNEES}
                </span>
              )}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A task card that participates in drag-and-drop.
 *
 * Two separate affordances, deliberately:
 *  - the card body is a real <button> that opens the task, so Enter opens it;
 *  - the grip carries dnd-kit's attributes and key handler, so Enter *there*
 *    starts a keyboard drag.
 *
 * Putting both on one element would make Enter ambiguous — dnd-kit's keyboard
 * sensor would claim it and the task could never be opened without a mouse.
 * Pointer dragging still works from anywhere on the card.
 */
export function SortableTaskCard({
  task,
  moduleName,
  onOpen,
}: {
  task: Task;
  moduleName?: string;
  onOpen: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: "task", statusId: task.statusId ?? null },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn("relative touch-none", isDragging && "opacity-40")}
      // Pointer listeners only — a 5px activation distance on the sensor
      // keeps a plain click falling through to the button below.
      {...listeners}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <TaskCardView task={task} moduleName={moduleName} />
      </button>

      <button
        type="button"
        aria-label={`Reorder ${task.name}`}
        className="absolute right-1 top-2 rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        {...attributes}
        // dnd-kit types its listener map as Record<string, Function>, so the
        // handler needs narrowing to attach to a typed element.
        onKeyDown={
          listeners?.onKeyDown as
            | React.KeyboardEventHandler<HTMLButtonElement>
            | undefined
        }
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
