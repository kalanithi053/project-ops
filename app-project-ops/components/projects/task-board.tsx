"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDraggable,
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
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Filter, GripVertical, Plus, Search, X } from "lucide-react";
import * as React from "react";

import {
  SortableTaskCard,
  TaskCardView,
} from "@/components/projects/task-card";
import { CopyWorkItemLink } from "@/components/projects/copy-work-item-link";
import { MultiSelectField } from "@/components/shared/multi-select-field";
import { QueryState } from "@/components/shared/query-state";
import { SelectField } from "@/components/shared/select-field";
import { TableSkeleton } from "@/components/shared/skeletons";
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
  SheetTrigger,
} from "@/components/ui/sheet";
import { useIncidents, useUpdateIncident } from "@/lib/api/hooks/use-incidents";
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
  Incident,
  Task,
  TaskStatusRef,
  TicketStatus,
} from "@/lib/api/types";
import { taskBoardSyncKey } from "@/lib/tasks/tab-sync";
import { toast } from "@/lib/toast/toast-store";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

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

function columnIdForIncident(
  incident: Incident,
  known: Set<string>,
): string {
  return incident.statusId && known.has(incident.statusId)
    ? incident.statusId
    : UNASSIGNED;
}

interface TaskBoardProps {
  workspaceSlug: string;
  projectId: string;
  canCreate: boolean;
  canUpdate: boolean;
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
}: TaskBoardProps) {
  const statusesQuery = useTicketStatuses(workspaceSlug);
  const modulesQuery = useProjectModules(workspaceSlug, projectId);
  const membersQuery = useWorkspaceMembers(workspaceSlug);
  const reorder = useReorderTasks(workspaceSlug, projectId);
  const updateIncident = useUpdateIncident(workspaceSlug, projectId);
  const [activeItem, setActiveItem] = React.useState<
    { type: "task"; item: Task } | { type: "incident"; item: Incident } | null
  >(null);
  const [search, setSearch] = React.useState("");
  const [moduleIds, setModuleIds] = React.useState<string[]>([]);
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>([]);
  const [statusId, setStatusId] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [appliedFilters, setAppliedFilters] = React.useState<TaskListFilters>(
    {},
  );

  const tasksQuery = useTasks(workspaceSlug, projectId, appliedFilters);
  const incidentsQuery = useIncidents(
    workspaceSlug,
    projectId,
    appliedFilters.assigneeIds ?? [],
  );
  const refetchTasks = tasksQuery.refetch;
  const refetchIncidents = incidentsQuery.refetch;
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
        user.email;
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
      refetchIncidents();
      refetchModules();
    }

    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [
    projectId,
    refetchIncidents,
    refetchModules,
    refetchTasks,
    workspaceSlug,
  ]);

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
      tasks.some((task) => columnIdFor(task, knownStatusIds) === UNASSIGNED) ||
      (incidentsQuery.data ?? []).some(
        (incident) => columnIdForIncident(incident, knownStatusIds) === UNASSIGNED,
      )
    ) {
      base.unshift({
        id: UNASSIGNED,
        name: "No status",
        droppable: false,
      });
    }
    return base;
  }, [statuses, tasks, knownStatusIds, incidentsQuery.data]);
  const router = useRouter();
  const grouped = React.useMemo(() => {
    const map = new Map<string, { tasks: Task[]; incidents: Incident[] }>();
    for (const column of columns) map.set(column.id, { tasks: [], incidents: [] });
    for (const task of tasks) {
      map.get(columnIdFor(task, knownStatusIds))?.tasks.push(task);
    }
    for (const incident of incidentsQuery.data ?? []) {
      map.get(columnIdForIncident(incident, knownStatusIds))?.incidents.push(incident);
    }
    for (const { tasks: columnTasks } of map.values()) {
      columnTasks.sort((a, b) => a.position - b.position);
    }
    return map;
  }, [columns, incidentsQuery.data, knownStatusIds, statuses, tasks]);

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

    const incident = (incidentsQuery.data ?? []).find((item) => item.id === id);
    setActiveItem(incident ? { type: "incident", item: incident } : null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setActiveItem(null);
    if (!over || !canUpdate) return;

    const activeId = String(active.id);
    const draggedTask = tasks.find((task) => task.id === activeId);
    const draggedIncident = (incidentsQuery.data ?? []).find(
      (incident) => incident.id === activeId,
    );
    if (!draggedTask && !draggedIncident) return;

    const overId = String(over.id);

    // `over` is either a column (dropped on empty space) or another card.
    const overTask = tasks.find((task) => task.id === overId);
    const overIncident = (incidentsQuery.data ?? []).find(
      (incident) => incident.id === overId,
    );
    const targetColumn = overTask
      ? columnIdFor(overTask, knownStatusIds)
      : overIncident
        ? columnIdForIncident(overIncident, knownStatusIds)
        : overId;

    const target = columns.find((column) => column.id === targetColumn);
    if (!target) return;
    if (draggedIncident) {
      if (!target.statusRef || target.id === draggedIncident.statusId) return;
      updateIncident.mutate(
        { id: draggedIncident.id, dto: { statusId: target.id } },
        {
          onSuccess: () =>
            toast.success("Incident moved", `${draggedIncident.title} → ${target.name}`),
        },
      );
      return;
    }

    const dragged = draggedTask;
    if (!dragged) return;
    const sourceColumn = columnIdFor(dragged, knownStatusIds);
    if (!target.droppable && targetColumn !== sourceColumn) return;

    const siblings = (grouped.get(targetColumn)?.tasks ?? []).filter(
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

  function openTaskTab(path: string) {
    router.push(path);
  }

  const isLoading =
    tasksQuery.isLoading || statusesQuery.isLoading || incidentsQuery.isLoading;

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Board</h2>
          <p className="text-sm text-muted-foreground">
            Your assigned tasks and incidents.
          </p>
        </div>
      </div>
      <QueryState
        isLoading={isLoading}
        isError={
          tasksQuery.isError || statusesQuery.isError || incidentsQuery.isError
        }
        error={tasksQuery.error ?? statusesQuery.error ?? incidentsQuery.error}
        onRetry={() => {
          tasksQuery.refetch();
          statusesQuery.refetch();
          incidentsQuery.refetch();
        }}
        skeleton={<TableSkeleton columns={4} rows={4} />}
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveItem(null)}
        >
          <div className="mb-4 flex items-center justify-between gap-3">
            <Sheet>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Filter className="h-4 w-4" />
                  Filters
                  {filtersActive && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                      {tasks.length}
                    </span>
                  )}
                </Button>
              </SheetTrigger>
              <SheetContent side="right" size="md">
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
              <span className="text-xs text-muted-foreground">
                {tasks.length} matching work items
              </span>
            )}
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                tasks={grouped.get(column.id)?.tasks ?? []}
                incidents={grouped.get(column.id)?.incidents ?? []}
                moduleNames={moduleNames}
                dragDisabled={filtersActive}
                canCreate={canCreate && column.droppable}
                canUpdate={canUpdate}
                workspaceSlug={workspaceSlug}
                projectId={projectId}
                onCreate={() =>
                  openTaskTab(
                    `/${workspaceSlug}/projects/${projectId}/tasks/new?statusId=${encodeURIComponent(column.id)}`,
                  )
                }
                onOpenTask={(task) =>
                  openTaskTab(
                    `/${workspaceSlug}/projects/${projectId}/tasks/${task.id}`,
                  )
                }
                onOpenIncident={(incident) =>
                  openTaskTab(
                    `/${workspaceSlug}/projects/${projectId}/incidents/${incident.id}`,
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
            ) : activeItem?.type === "incident" ? (
              <IncidentCard incident={activeItem.item} overlay />
            ) : null}
          </DragOverlay>
        </DndContext>
      </QueryState>
    </>
  );
}

function IncidentCard({
  incident,
  onOpen,
  disabled = false,
  overlay = false,
  copyUrl,
}: {
  incident: Incident;
  onOpen?: () => void;
  disabled?: boolean;
  overlay?: boolean;
  copyUrl?: string;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    isDragging,
  } = useDraggable({
    id: incident.id,
    data: { type: "incident" },
    disabled: overlay || disabled,
  });

  return (
    <article
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform) }}
      className={cn("group/title relative rounded-md border border-status-error/30 bg-card p-3 shadow-sm", isDragging && "opacity-40", overlay && "rotate-2 shadow-lg")}
    >
      <button
        type="button"
        onClick={onOpen}
        className="block w-full rounded-sm text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-status-error">
          <AlertTriangle className="h-3.5 w-3.5" />
          Incident
        </div>
        <p className="pr-4 text-sm font-medium leading-snug">{incident.title}</p>
        <span className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: incident.status.color ?? "var(--status-error)" }}
          />
          {incident.status.name}
        </span>
      </button>
      {copyUrl && !overlay && (
        <CopyWorkItemLink
          prefix="Incident"
          title={incident.title}
          url={copyUrl}
          className="absolute right-7 top-8"
        />
      )}
      {!overlay && !disabled && (
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Move ${incident.title}`}
          className="absolute right-1 top-2 rounded p-0.5 text-muted-foreground/40 hover:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
    </article>
  );
}

function BoardColumn({
  column,
  tasks,
  incidents,
  moduleNames,
  dragDisabled,
  canCreate,
  canUpdate,
  onCreate,
  onOpenTask,
  onOpenIncident,
  workspaceSlug,
  projectId,
}: {
  column: BoardColumnDef;
  tasks: Task[];
  incidents: Incident[];
  moduleNames: Map<string, string>;
  dragDisabled: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  onCreate: () => void;
  onOpenTask: (task: Task) => void;
  onOpenIncident: (incident: Incident) => void;
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
            {tasks.length + incidents.length}
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
        items={[...tasks.map((task) => task.id), ...incidents.map((incident) => incident.id)]}
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
              copyUrl={`/${workspaceSlug}/projects/${projectId}/tasks/${task.id}`}
            />
          ))}

          {incidents.map((incident) => (
            <IncidentCard
              key={incident.id}
              incident={incident}
              onOpen={() => onOpenIncident(incident)}
              disabled={dragDisabled || !canUpdate}
              copyUrl={`/${workspaceSlug}/projects/${projectId}/incidents/${incident.id}`}
            />
          ))}

          {tasks.length + incidents.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {column.droppable ? "Drop tasks here" : "Nothing here"}
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}
