"use client";

import * as React from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { toast } from "@/lib/toast/toast-store";
import { Button } from "@/components/ui/button";
import { QueryState } from "@/components/shared/query-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { SortableTaskCard, TaskCardView } from "@/components/projects/task-card";
import { TaskPanel } from "@/components/projects/task-panel";
import { useTasks, useReorderTasks, type TaskPlacement } from "@/lib/api/hooks/use-tasks";
import { useTicketStatuses } from "@/lib/api/hooks/use-ticket-statuses";
import { useProjectModules } from "@/lib/api/hooks/use-projects";
import type { Task, TaskStatusRef, TicketStatus } from "@/lib/api/types";

/**
 * Column key for tasks with no status. Seed tasks land here when a workspace
 * has no default ticket status, so the board has to show them somewhere.
 */
const UNASSIGNED = "__unassigned__";

interface BoardColumnDef {
  id: string;
  name: string;
  color?: string | null;
  /** False for the Unassigned bucket — see below. */
  droppable: boolean;
  statusRef?: TaskStatusRef;
}

/**
 * Which column a task belongs in. A status the workspace no longer has falls
 * back to the Unassigned bucket rather than vanishing — the board renders
 * `columns`, so an unrecognised id would otherwise hide the card entirely.
 */
function columnIdFor(task: Task, known: Set<string>): string {
  if (task.statusId && known.has(task.statusId)) return task.statusId;
  return UNASSIGNED;
}

interface TaskBoardProps {
  workspaceSlug: string;
  projectId: string;
  canCreate: boolean;
  canUpdate: boolean;
  /** The project type provisions plans, so tasks must name a module. */
  requiresModule: boolean;
}

/**
 * Jira-style board: one column per workspace ticket status, cards dragged
 * between them to change status.
 *
 * Columns come from GET /ticket-statuses rather than the statuses embedded in
 * tasks, because the task payload omits `order` and `color` — so an empty
 * column would otherwise be invisible and column order unknowable.
 */
export function TaskBoard({
  workspaceSlug,
  projectId,
  canCreate,
  canUpdate,
  requiresModule,
}: TaskBoardProps) {
  const tasksQuery = useTasks(workspaceSlug, projectId);
  const statusesQuery = useTicketStatuses(workspaceSlug);
  const modulesQuery = useProjectModules(workspaceSlug, projectId);
  const reorder = useReorderTasks(workspaceSlug, projectId);

  const [activeTask, setActiveTask] = React.useState<Task | null>(null);
  const [editing, setEditing] = React.useState<Task | null>(null);
  const [creatingIn, setCreatingIn] = React.useState<string | null>(null);

  const tasks = React.useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const statuses = React.useMemo(
    () => statusesQuery.data ?? [],
    [statusesQuery.data],
  );

  /** moduleInstanceId -> module name, for the card's module chip. */
  const moduleNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const instance of modulesQuery.data ?? []) {
      map.set(instance.id, instance.module.name);
    }
    return map;
  }, [modulesQuery.data]);

  const knownStatusIds = React.useMemo(
    () => new Set(statuses.map((status) => status.id)),
    [statuses],
  );

  const columns = React.useMemo<BoardColumnDef[]>(() => {
    const ordered = [...statuses].sort((a, b) => a.order - b.order);
    const base: BoardColumnDef[] = ordered.map((status: TicketStatus) => ({
      id: status.id,
      name: status.name,
      color: status.color,
      droppable: true,
      statusRef: {
        id: status.id,
        name: status.name,
        category: status.category,
      },
    }));

    // Only surface the bucket when something is actually in it. It's not a
    // drop target: PATCH treats `statusId: null` as "no change", so the API
    // offers no way to move a task back out of a status.
    if (tasks.some((task) => columnIdFor(task, knownStatusIds) === UNASSIGNED)) {
      base.unshift({
        id: UNASSIGNED,
        name: "No status",
        droppable: false,
      });
    }
    return base;
  }, [statuses, tasks, knownStatusIds]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const column of columns) map.set(column.id, []);
    for (const task of tasks) {
      map.get(columnIdFor(task, knownStatusIds))?.push(task);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [columns, tasks, knownStatusIds]);

  const sensors = useSensors(
    // A small activation distance keeps a plain click on the card working as
    // "open task" instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((task) => task.id === event.active.id) ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveTask(null);
    if (!over || !canUpdate) return;

    const dragged = tasks.find((task) => task.id === active.id);
    if (!dragged) return;

    const sourceColumn = columnIdFor(dragged, knownStatusIds);
    const overId = String(over.id);

    // `over` is either a column (dropped on empty space) or another card.
    const overTask = tasks.find((task) => task.id === overId);
    const targetColumn = overTask
      ? columnIdFor(overTask, knownStatusIds)
      : overId;

    const target = columns.find((column) => column.id === targetColumn);
    if (!target) return;
    if (!target.droppable && targetColumn !== sourceColumn) return;

    const siblings = (grouped.get(targetColumn) ?? []).filter(
      (task) => task.id !== dragged.id,
    );

    let insertAt = siblings.length;
    if (overTask) {
      const index = siblings.findIndex((task) => task.id === overTask.id);
      if (index !== -1) insertAt = index;
    }

    const next = [...siblings];
    next.splice(insertAt, 0, dragged);

    const movedColumn = targetColumn !== sourceColumn;

    // Renumber the target column; only send rows that actually moved.
    const placements: TaskPlacement[] = next
      .map((task, index) => ({ task, index }))
      .filter(
        ({ task, index }) =>
          task.position !== index || (task.id === dragged.id && movedColumn),
      )
      .map(({ task, index }) => ({
        id: task.id,
        position: index,
        ...(task.id === dragged.id && movedColumn
          ? { statusId: targetColumn, status: target.statusRef ?? null }
          : {}),
      }));

    if (placements.length === 0) return;

    reorder.mutate(placements, {
      onSuccess: () => {
        // Only announce a real status change. A within-column reorder is
        // self-evident from the card landing where it was dropped, and
        // toasting it would be noise on every nudge.
        if (!movedColumn) return;
        toast.success(
          "Task moved",
          `${dragged.prefix ?? dragged.name} → ${target.name}`,
        );
      },
    });
  }

  const isLoading = tasksQuery.isLoading || statusesQuery.isLoading;

  return (
    <QueryState
      isLoading={isLoading}
      isError={tasksQuery.isError || statusesQuery.isError}
      error={tasksQuery.error ?? statusesQuery.error}
      onRetry={() => {
        tasksQuery.refetch();
        statusesQuery.refetch();
      }}
      skeleton={<TableSkeleton columns={4} rows={4} />}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setActiveTask(null)}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
          {columns.map((column) => (
            <BoardColumn
              key={column.id}
              column={column}
              tasks={grouped.get(column.id) ?? []}
              moduleNames={moduleNames}
              canCreate={canCreate && column.droppable}
              onCreate={() => setCreatingIn(column.id)}
              onOpenTask={setEditing}
            />
          ))}
        </div>

        {/* The lifted card follows the cursor while the original stays dimmed. */}
        <DragOverlay>
          {activeTask ? (
            <TaskCardView
              task={activeTask}
              moduleName={
                activeTask.moduleInstanceId
                  ? moduleNames.get(activeTask.moduleInstanceId)
                  : undefined
              }
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {(editing || creatingIn) && (
        <TaskPanel
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          task={editing}
          defaultStatusId={
            creatingIn && creatingIn !== UNASSIGNED ? creatingIn : undefined
          }
          requiresModule={requiresModule}
          canUpdate={canUpdate}
          onClose={() => {
            setEditing(null);
            setCreatingIn(null);
          }}
        />
      )}
    </QueryState>
  );
}

function BoardColumn({
  column,
  tasks,
  moduleNames,
  canCreate,
  onCreate,
  onOpenTask,
}: {
  column: BoardColumnDef;
  tasks: Task[];
  moduleNames: Map<string, string>;
  canCreate: boolean;
  onCreate: () => void;
  onOpenTask: (task: Task) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
    data: { type: "column" },
    disabled: !column.droppable,
  });

  return (
    <section
      aria-label={column.name}
      className="flex w-72 shrink-0 flex-col gap-2 rounded-lg bg-muted/40 p-2"
    >
      <header className="flex items-center justify-between gap-2 px-1 py-0.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{
              backgroundColor: column.color ?? "var(--status-neutral)",
            }}
            aria-hidden
          />
          <h3 className="truncate text-sm font-medium">{column.name}</h3>
          <span className="shrink-0 rounded-full bg-background px-1.5 text-xs text-muted-foreground">
            {tasks.length}
          </span>
        </div>
        {canCreate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={`Add task to ${column.name}`}
            onClick={onCreate}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </header>

      <SortableContext
        items={tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div
          ref={setNodeRef}
          className={cn(
            "flex min-h-24 max-h-[calc(100vh-22rem)] flex-col gap-2 overflow-y-auto rounded-md p-1 transition-colors",
            isOver && column.droppable && "bg-accent/60 ring-1 ring-ring/40",
          )}
        >
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              moduleName={
                task.moduleInstanceId
                  ? moduleNames.get(task.moduleInstanceId)
                  : undefined
              }
              onOpen={() => onOpenTask(task)}
            />
          ))}

          {tasks.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {column.droppable ? "Drop tasks here" : "Nothing here"}
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
