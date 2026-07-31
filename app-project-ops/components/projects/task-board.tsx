"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  pointerWithin,
  rectIntersection,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Plus, Search, X } from "lucide-react";
import * as React from "react";

import { CreateWorkItemMenu } from "@/components/projects/create-work-item-menu";
import {
  SortableTaskCard,
  TaskCardView,
} from "@/components/projects/task-card";
import { MultiSelectField } from "@/components/shared/multi-select-field";
import { QueryState } from "@/components/shared/query-state";
import { SelectField } from "@/components/shared/select-field";
import { BoardSkeleton } from "@/components/shared/skeletons";
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
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { useProjectModules } from "@/lib/api/hooks/use-projects";
import {
  useReorderTasks,
  useTasks,
  type TaskListFilters,
  type TaskPlacement,
} from "@/lib/api/hooks/use-tasks";
import { useTicketStatuses } from "@/lib/api/hooks/use-ticket-statuses";
import type {
  Task,
  TaskStatusRef,
  TicketStatus,
  WorkType,
  WorkTypeCategory,
} from "@/lib/api/types";
import { taskBoardSyncKey } from "@/lib/tasks/tab-sync";
import { toast } from "@/lib/toast/toast-store";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

/**
 * dnd-kit's own recommended multi-container fallback chain: a precise
 * pointer-in-rect check first, falling back to broader rect intersection,
 * falling back to nearest-corner — precise near column edges without going
 * erratic in the sparser cases pointerWithin alone can miss.
 */
const collisionDetectionStrategy: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  if (pointerCollisions.length > 0) return pointerCollisions;
  const rectCollisions = rectIntersection(args);
  if (rectCollisions.length > 0) return rectCollisions;
  return closestCorners(args);
};

/**
 * Column key for tasks with no status. Seed tasks land here when a workspace
 * has no default ticket status, so the board has to show them somewhere.
 */
const UNASSIGNED = "__unassigned__";

/**
 * `position` is a gap-based (fractional-indexing) value, not a dense index —
 * inserting between two rows assigns their midpoint. Widely spaced so a
 * column can absorb a long run of drags into the same spot before its
 * neighbors' gap shrinks below `MIN_POSITION_GAP` and a rebalance is needed.
 */
const POSITION_GAP = 1000;
/** Below this gap between two neighbors, insert-by-midpoint has no room left — rebalance the column instead. */
const MIN_POSITION_GAP = 1;

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
  /** Only tasks whose WorkType category matches are shown on the board. */
  typeCategory: WorkTypeCategory;
  /**
   * Called after a work type is chosen from a column's "+" dropdown —
   * lets the caller navigate to the create page with both the type and
   * this column's status pre-selected.
   */
  onCreate?: (statusId: string, workType: WorkType) => void;
  /** The filters Sheet's trigger lives in the parent header, next to the
   * list/kanban switch, so its open state is controlled from there. */
  filtersOpen: boolean;
  onFiltersOpenChange: (open: boolean) => void;
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
  typeCategory,
  onCreate,
  filtersOpen,
  onFiltersOpenChange,
}: TaskBoardProps) {
  const statusesQuery = useTicketStatuses(workspaceSlug);
  const modulesQuery = useProjectModules(workspaceSlug, projectId);
  const membersQuery = useWorkspaceMembers(workspaceSlug);
  const reorder = useReorderTasks(workspaceSlug, projectId);
  const [activeItem, setActiveItem] = React.useState<{
    type: "task";
    item: Task;
  } | null>(null);
  const [search, setSearch] = React.useState("");
  const [moduleIds, setModuleIds] = React.useState<string[]>([]);
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>([]);
  const [statusId, setStatusId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [appliedFilters, setAppliedFilters] = React.useState<TaskListFilters>(
    {},
  );

  const taskListFilters = React.useMemo(
    () => ({ ...appliedFilters, category: typeCategory }),
    [appliedFilters, typeCategory],
  );
  const tasksQuery = useTasks(workspaceSlug, projectId, taskListFilters);

  const refetchTasks = tasksQuery.refetch;
  const refetchModules = modulesQuery.refetch;

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

  const moduleOptions = React.useMemo(
    () =>
      (modulesQuery.data ?? []).map((instance) => ({
        value: instance.id,
        label: instance.module.name,
      })),
    [modulesQuery.data],
  );

  const assigneeOptions = React.useMemo(() => {
    const users = new Map<string, string>();
    for (const member of membersQuery.data ?? []) {
      if (member.status === "removed") continue;
      const user = member.user ?? member;
      if (!user.id) continue;
      const name =
        [user.firstName, user.lastName].filter(Boolean).join(" ") ||
        user.username ||
        user.email?.split("@")[0];
      if (name) users.set(user.id, name);
    }
    for (const task of tasks) {
      for (const assignment of task.assignees ?? []) {
        users.set(assignment.user.id, assignment.user.username);
      }
    }
    return [
      { value: "", label: "All assignees" },
      ...Array.from(users, ([value, label]) => ({ value, label })).sort(
        (a, b) => a.label.localeCompare(b.label),
      ),
    ];
  }, [membersQuery.data, tasks]);

  const statusOptions = React.useMemo(
    () => [
      { value: "", label: "All statuses" },
      { value: UNASSIGNED, label: "No status" },
      ...statuses.map((status) => ({ value: status.id, label: status.name })),
    ],
    [statuses],
  );

  const filtersActive = Object.keys(appliedFilters).length > 0;
  const hasDraftFilters = Boolean(
    search ||
    moduleIds.length ||
    assigneeIds.length ||
    statusId ||
    startDate ||
    endDate,
  );

  React.useEffect(() => {
    const syncKey = taskBoardSyncKey(workspaceSlug, projectId);
    function handleStorage(event: StorageEvent) {
      if (event.key !== syncKey) return;
      refetchTasks();
      refetchModules();
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [projectId, refetchModules, refetchTasks, workspaceSlug]);

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
    if (
      tasks.some((task) => columnIdFor(task, knownStatusIds) === UNASSIGNED)
    ) {
      base.unshift({
        id: UNASSIGNED,
        name: "No status",
        droppable: false,
      });
    }
    return base;
  }, [statuses, tasks, knownStatusIds]);
  const router = useRouter();
  const grouped = React.useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const column of columns) map.set(column.id, []);
    for (const task of tasks) {
      map.get(columnIdFor(task, knownStatusIds))?.push(task);
    }

    for (const columnTasks of map.values()) {
      columnTasks.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [columns, knownStatusIds, statuses, tasks]);

  function clearFilters() {
    setSearch("");
    setModuleIds([]);
    setAssigneeIds([]);
    setStatusId("");
    setStartDate("");
    setEndDate("");
    setAppliedFilters({});
  }

  function applyFilters() {
    setAppliedFilters({
      ...(search.trim() ? { search: search.trim() } : {}),
      ...(moduleIds.length ? { moduleInstanceIds: moduleIds } : {}),
      ...(assigneeIds.length ? { assigneeIds } : {}),
      ...(statusId ? { statusId } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
    });
    onFiltersOpenChange(false);
  }

  const sensors = useSensors(
    // A small activation distance keeps a plain click on the card working as
    // "open task" instead of starting a drag.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const id = String(event.active.id);
    const task = tasks.find((item) => item.id === id);
    if (task) return setActiveItem({ type: "task", item: task });
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);
    if (!over || !canUpdate) return;

    const activeId = String(active.id);
    const draggedTask = tasks.find((task) => task.id === activeId);
    if (!draggedTask) return;

    const overId = String(over.id);

    // `over` is either a column (dropped on empty space) or another card.
    const overTask = tasks.find((task) => task.id === overId);
    const targetColumn = overTask
      ? columnIdFor(overTask, knownStatusIds)
      : overId;

    const target = columns.find((column) => column.id === targetColumn);
    if (!target) return;

    const dragged = draggedTask;
    if (!dragged) return;
    const sourceColumn = columnIdFor(dragged, knownStatusIds);
    if (!target.droppable && targetColumn !== sourceColumn) return;

    const siblings = (grouped.get(targetColumn) ?? []).filter(
      (task) => task.id !== dragged.id,
    );

    let insertAt = siblings.length;
    if (overTask) {
      const index = siblings.findIndex((task) => task.id === overTask.id);
      if (index !== -1) insertAt = index;
    }

    const movedColumn = targetColumn !== sourceColumn;
    const statusFields = movedColumn
      ? { statusId: targetColumn, status: target.statusRef ?? null }
      : {};

    // Gap-based positions: the dragged card's new value only ever needs to
    // sit between its new neighbors, so a drag is normally a single PATCH —
    // not a renumber of the whole column (previously up to N requests for
    // an N-card column, which is what made dragging out of a large column
    // like "New" fire dozens of calls).
    const prevSibling = siblings[insertAt - 1];
    const nextSibling = siblings[insertAt];
    const prevPos =
      prevSibling?.position ??
      (nextSibling ? nextSibling.position - POSITION_GAP * 2 : 0);
    const nextPos =
      nextSibling?.position ??
      (prevSibling ? prevSibling.position + POSITION_GAP * 2 : POSITION_GAP);

    let placements: TaskPlacement[];
    if (nextPos - prevPos > MIN_POSITION_GAP) {
      const newPosition = (prevPos + nextPos) / 2;
      // Picked up and dropped back in the same spot — dnd-kit still fires
      // onDragEnd for this, but there's nothing to persist.
      if (!movedColumn && Math.abs(newPosition - dragged.position) < 0.01) {
        return;
      }
      placements = [{ id: dragged.id, position: newPosition, ...statusFields }];
    } else {
      // No room left between these two neighbors — most often because nothing
      // in this column has ever been spaced out (every seeded row defaults to
      // position 0). Rebalance just this column with fresh, widely-spaced
      // values; every drag into or within it afterwards has room again.
      const rebalanced = [...siblings];
      rebalanced.splice(insertAt, 0, dragged);
      placements = rebalanced.map((task, index) => ({
        id: task.id,
        position: index * POSITION_GAP,
        ...(task.id === dragged.id ? statusFields : {}),
      }));
    }

    reorder.reorder(placements, {
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

  function openTaskTab(path: string) {
    router.push(path);
  }

  const isLoading = tasksQuery.isLoading || statusesQuery.isLoading;

  return (
    <>
      <QueryState
        isLoading={isLoading}
        isError={tasksQuery.isError || statusesQuery.isError}
        error={tasksQuery.error ?? statusesQuery.error}
        onRetry={() => {
          tasksQuery.refetch();
          statusesQuery.refetch();
        }}
        skeleton={<BoardSkeleton columns={4} cardsPerColumn={4} />}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetectionStrategy}
          modifiers={[restrictToWindowEdges]}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveItem(null)}
        >
          <>
            <Sheet open={filtersOpen} onOpenChange={onFiltersOpenChange}>
              <SheetContent
                side="right"
                size="md"
                className="data-[state=open]:duration-150 data-[state=closed]:duration-150"
              >
                <SheetHeader>
                  <SheetTitle>Filter work items</SheetTitle>
                  <SheetDescription>
                    Refine the board using the project task API.
                  </SheetDescription>
                </SheetHeader>
                <SheetBody>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Search name or prefix
                    <span className="relative block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search tasks"
                        className="pl-9"
                      />
                    </span>
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Module
                    <MultiSelectField
                      aria-label="Filter by modules"
                      options={moduleOptions}
                      values={moduleIds}
                      onValuesChange={setModuleIds}
                      placeholder="All modules"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Assignees
                    <MultiSelectField
                      aria-label="Filter by assignees"
                      options={assigneeOptions.slice(1)}
                      values={assigneeIds}
                      onValuesChange={setAssigneeIds}
                      placeholder="All assignees"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Status
                    <SelectField
                      aria-label="Filter by status"
                      options={statusOptions}
                      value={statusId}
                      onValueChange={setStatusId}
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    Start date from
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(event) => setStartDate(event.target.value)}
                      aria-label="Start date from"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5 text-sm font-medium">
                    End date until
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(event) => setEndDate(event.target.value)}
                      aria-label="End date until"
                    />
                  </label>
                </SheetBody>
                <SheetFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={clearFilters}
                    disabled={!filtersActive && !hasDraftFilters}
                  >
                    <X className="h-3.5 w-3.5" />
                    Clear filters
                  </Button>
                  <Button type="button" onClick={applyFilters}>
                    <Search className="h-3.5 w-3.5" />
                    Search
                  </Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>
            {filtersActive && (
              <div className="fixed bottom-4 right-4 z-30 rounded-full border border-border bg-popover px-3 py-1.5 text-xs text-muted-foreground shadow-lg">
                {tasks.length} matching work items
              </div>
            )}
          </>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                tasks={grouped.get(column.id) ?? []}
                moduleNames={moduleNames}
                dragDisabled={filtersActive}
                canCreate={canCreate && column.droppable}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                onCreate={(workType) =>
                  onCreate
                    ? onCreate(column.id, workType)
                    : openTaskTab(
                        `/${workspaceSlug}/projects/${projectId}/work-items/new?statusId=${encodeURIComponent(column.id)}&workItemTypeId=${encodeURIComponent(workType.id)}`,
                      )
                }
                onOpenTask={(task) =>
                  openTaskTab(
                    `/${workspaceSlug}/projects/${projectId}/work-items/${task.id}`,
                  )
                }
              />
            ))}
          </div>

          {/* The lifted card follows the cursor while the original stays dimmed. */}
          <DragOverlay>
            {activeItem?.type === "task" ? (
              <TaskCardView
                task={activeItem.item}
                moduleName={
                  activeItem.item.moduleInstanceId
                    ? moduleNames.get(activeItem.item.moduleInstanceId)
                    : undefined
                }
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      </QueryState>
    </>
  );
}

function BoardColumn({
  column,
  tasks,
  moduleNames,
  dragDisabled,
  canCreate,
  onCreate,
  onOpenTask,
  workspaceSlug,
  projectId,
}: {
  column: BoardColumnDef;
  tasks: Task[];
  moduleNames: Map<string, string>;
  dragDisabled: boolean;
  canCreate: boolean;
  onCreate: (workType: WorkType) => void;
  onOpenTask: (task: Task) => void;
  workspaceSlug: string;
  projectId: string;
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
          <CreateWorkItemMenu
            workspaceSlug={workspaceSlug}
            onSelect={onCreate}
            align="start"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              aria-label={`Add work item to ${column.name}`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </CreateWorkItemMenu>
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
              disabled={dragDisabled}
              copyUrl={`/${workspaceSlug}/projects/${projectId}/work-items/${task.id}`}
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
