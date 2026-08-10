"use client";

import {
  AlertTriangle,
  BellRing,
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Filter,
  Kanban,
  List,
  ListChecks,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CopyWorkItemLink } from "@/components/projects/copy-work-item-link";
import {
  CATEGORY_ICON,
  CreateWorkItemMenu,
} from "@/components/projects/create-work-item-menu";
import { TaskBoard } from "@/components/projects/task-board";
import { QueryState } from "@/components/shared/query-state";
import { MultiSelectField } from "@/components/shared/multi-select-field";
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useProjectModules } from "@/lib/api/hooks/use-projects";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import {
  useNotifyTaskAssignee,
  useTasks,
  type TaskListFilters,
} from "@/lib/api/hooks/use-tasks";
import { useTicketStatuses } from "@/lib/api/hooks/use-ticket-statuses";
import { useMe } from "@/lib/api/hooks/use-users";
import { useWorkTypes } from "@/lib/api/hooks/use-work-types";
import { formatDate } from "@/lib/format";
import type { Task, WorkType, WorkTypeCategory } from "@/lib/api/types";

type WorkItemsView = "list" | "kanban";

/** Top-level work-item-type filter, shown as buttons next to the header. */
const TYPE_CATEGORY_TABS: Array<{
  value: WorkTypeCategory;
  label: string;
  icon: typeof ListChecks;
}> = [
  { value: "task", label: "Task", icon: ListChecks },
  { value: "bug", label: "Bug", icon: Bug },
  { value: "incident", label: "Incident", icon: AlertTriangle },
];

const OPTIONAL_COLUMNS = [
  "type",
  "assignee",
  "status",
  "startDate",
  "endDate",
] as const;
type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];
const COLUMN_LABELS: Record<OptionalColumn, string> = {
  type: "Type",
  assignee: "Assignee",
  status: "Status",
  startDate: "Start date",
  endDate: "End date",
};

const BUG_KEY = "__bug__";
const INCIDENT_KEY = "__incident__";
const NO_MODULE_KEY = "__none__";
// A well-formed but unassignable UUID v4 — sent as the module-instance
// filter when a Hub/Plan/Area combination has no overlap, so the backend
// query still runs (consistent loading state) but correctly returns zero
// rows instead of the "no filter" behavior an empty array would trigger.
const NO_MATCH_SENTINEL = "00000000-0000-4000-8000-000000000000";

/** Intersects every *active* (non-empty) id list; `null` means unrestricted. */
function intersectActive(lists: string[][]): string[] | null {
  const active = lists.filter((list) => list.length > 0);
  if (active.length === 0) return null;
  return active.reduce((acc, list) => {
    const set = new Set(list);
    return acc.filter((id) => set.has(id));
  });
}

/** A module's group-header label, e.g. "Professional - Workflows". */
interface ModuleLabel {
  name: string;
  planName?: string;
}

/**
 * One collapsible List-view section per module, labelled "{Plan} - {Module}"
 * — plus leading "Bugs"/"Incidents" buckets (those categories never carry a
 * module) and a trailing catch-all, by work-item-type name, for anything
 * else without one (e.g. plain tasks on a non-plan-provisioned project type).
 */
interface ModuleGroup {
  key: string;
  name: string;
  rows: Array<{ type: "Task"; item: Task; date: string }>;
}

function groupByModule(
  rows: Array<{ type: "Task"; item: Task; date: string }>,
  moduleLabels: Map<string, ModuleLabel>,
  moduleOrder: string[],
): ModuleGroup[] {
  const buckets = new Map<string, ModuleGroup["rows"]>();
  const bucketNames = new Map<string, string>();

  for (const row of rows) {
    const category = row.item.workItemType?.category;
    const key = row.item.moduleInstanceId
      ? row.item.moduleInstanceId
      : category === "bug"
        ? BUG_KEY
        : category === "incident"
          ? INCIDENT_KEY
          : (row.item.workItemType?.name ?? NO_MODULE_KEY);
    if (!bucketNames.has(key)) {
      bucketNames.set(key, row.item.workItemType?.name ?? "No module");
    }
    const bucket = buckets.get(key);
    if (bucket) bucket.push(row);
    else buckets.set(key, [row]);
  }

  const orderedKeys = [
    ...(buckets.has(BUG_KEY) ? [BUG_KEY] : []),
    ...(buckets.has(INCIDENT_KEY) ? [INCIDENT_KEY] : []),
    ...moduleOrder.filter((id) => buckets.has(id)),
    ...Array.from(buckets.keys()).filter(
      (key) =>
        key !== BUG_KEY && key !== INCIDENT_KEY && !moduleOrder.includes(key),
    ),
  ];

  return orderedKeys.map((key) => {
    const label = moduleLabels.get(key);
    const name = label
      ? label.planName
        ? `${label.planName} - ${label.name}`
        : label.name
      : (bucketNames.get(key) ?? "—");
    return { key, name, rows: buckets.get(key) ?? [] };
  });
}
const PAGE_SIZE = 20;

function WorkItemTypeIcon({
  category,
  color,
  title,
}: {
  category?: string;
  color?: string | null;
  title?: string;
}) {
  const Icon =
    CATEGORY_ICON[category as keyof typeof CATEGORY_ICON] ?? ListChecks;
  return (
    <span title={title}>
      <Icon className="h-4 w-4" style={{ color: color ?? undefined }} />
    </span>
  );
}

function initials(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function TaskWorkItems({
  workspaceSlug,
  projectId,
  canCreate,
  canUpdate,
}: {
  workspaceSlug: string;
  projectId: string;
  canCreate: boolean;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const { data: me, isLoading: meLoading } = useMe();
  const viewStorageKey = `project-ops:work-items-view:${workspaceSlug}:${projectId}`;
  const [view, setView] = React.useState<WorkItemsView>(() => {
    if (typeof window === "undefined") return "list";
    return window.localStorage.getItem(viewStorageKey) === "kanban"
      ? "kanban"
      : "list";
  });
  const [typeCategory, setTypeCategory] =
    React.useState<WorkTypeCategory>("task");
  const [kanbanFiltersOpen, setKanbanFiltersOpen] = React.useState(false);
  const [listFiltersOpen, setListFiltersOpen] = React.useState(false);
  React.useEffect(() => {
    try {
      window.localStorage.setItem(viewStorageKey, view);
    } catch {}
  }, [viewStorageKey, view]);
  function goToCreate(workType: WorkType, statusId?: string) {
    const params = new URLSearchParams({ workItemTypeId: workType.id });
    if (statusId) params.set("statusId", statusId);
    router.push(
      `/${workspaceSlug}/projects/${projectId}/work-items/new?${params.toString()}`,
    );
  }
  // Draft value for the (closed) Filters sheet's Assignee field — seeded to
  // "@Me" when `me` is already cached. The default that actually drives the
  // tasks fetch is derived separately below, straight from `me`.
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>(() =>
    me?.id ? [me.id] : [],
  );
  const [keyword, setKeyword] = React.useState("");
  const [workTypes, setWorkTypes] = React.useState<string[]>([]);
  const [moduleIds, setModuleIds] = React.useState<string[]>([]);
  const [hubIds, setHubIds] = React.useState<string[]>([]);
  const [planIds, setPlanIds] = React.useState<string[]>([]);
  const [statusIds, setStatusIds] = React.useState<string[]>([]);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  // `null` means "no explicit filters applied yet" — the default (assigned to
  // me) is derived straight from `me` on every render instead of being
  // copied into state via an effect, so the very first tasks fetch already
  // carries the right assigneeIds instead of firing once without it and once
  // more a render later once an effect catches up.
  const [manualFilters, setManualFilters] = React.useState<TaskListFilters | null>(
    null,
  );
  const appliedFilters = React.useMemo<TaskListFilters>(
    () => manualFilters ?? (me?.id ? { assigneeIds: [me.id] } : {}),
    [manualFilters, me],
  );
  const [appliedWorkTypes, setAppliedWorkTypes] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);
  const [collapsedModules, setCollapsedModules] = React.useState<Set<string>>(
    new Set(),
  );
  function toggleModuleGroup(key: string) {
    setCollapsedModules((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  const columnStorageKey = `project-ops:work-items-columns:${workspaceSlug}:${projectId}`;
  const [visibleColumns, setVisibleColumns] = React.useState<OptionalColumn[]>(
    () => {
      if (typeof window === "undefined") return [...OPTIONAL_COLUMNS];
      try {
        const stored = window.localStorage.getItem(columnStorageKey);
        const values: unknown = stored ? JSON.parse(stored) : null;
        if (Array.isArray(values)) {
          const columns = values.filter(
            (value): value is OptionalColumn =>
              typeof value === "string" &&
              OPTIONAL_COLUMNS.includes(value as OptionalColumn),
          );
          return [
            ...columns,
            ...(columns.includes("startDate")
              ? []
              : (["startDate"] as OptionalColumn[])),
            ...(columns.includes("endDate")
              ? []
              : (["endDate"] as OptionalColumn[])),
          ] as OptionalColumn[];
        }
      } catch {}
      return [...OPTIONAL_COLUMNS];
    },
  );
  // Cosmetic only — pre-fills the (closed) Filters sheet's Assignee field
  // with "@Me" once `me` resolves. Doesn't touch `appliedFilters`/the tasks
  // fetch, which derive the same default reactively above.
  const assigneeDraftSeeded = React.useRef(Boolean(me?.id));
  React.useEffect(() => {
    if (!assigneeDraftSeeded.current && me?.id) {
      setAssigneeIds([me.id]);
      assigneeDraftSeeded.current = true;
    }
  }, [me?.id]);
  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        columnStorageKey,
        JSON.stringify(visibleColumns),
      );
    } catch {}
  }, [columnStorageKey, visibleColumns]);
  const statusesQuery = useTicketStatuses(workspaceSlug);
  const workTypesQuery = useWorkTypes(workspaceSlug);
  const workTypeOptions = React.useMemo(
    () =>
      (workTypesQuery.data ?? [])
        .filter((workType) => workType.isActive)
        .map((workType) => ({ value: workType.id, label: workType.name })),
    [workTypesQuery.data],
  );
  function applyFilters() {
    setAppliedWorkTypes(workTypes);
    // Hubs, Plans and Areas each narrow the result independently (AND across
    // filter types); multiple picks within one filter type are OR'd — see
    // intersectActive's doc comment. `null` means none of the three were
    // touched, so no module-based restriction applies at all.
    const moduleFilter = intersectActive([
      ...(moduleIds.length ? [moduleIds] : []),
      ...(hubIds.length ? [moduleIdsForHubs(hubIds)] : []),
      ...(planIds.length ? [moduleIdsForPlans(planIds)] : []),
    ]);
    setManualFilters({
      ...(assigneeIds.length ? { assigneeIds } : {}),
      ...(keyword.trim() ? { search: keyword.trim() } : {}),
      ...(moduleFilter !== null
        ? {
            moduleInstanceIds:
              moduleFilter.length > 0 ? moduleFilter : [NO_MATCH_SENTINEL],
          }
        : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(statusIds.length ? { statusIds } : {}),
    });
  }
  const taskListFilters = React.useMemo(
    () => ({ ...appliedFilters, category: typeCategory }),
    [appliedFilters, typeCategory],
  );
  const tasksQuery = useTasks(workspaceSlug, projectId, taskListFilters, {
    // Wait for `me` so the default (assigned-to-me) filter is already known
    // on the first request — otherwise it'd fetch once unfiltered, then
    // again a moment later once `me` resolves. Also skip entirely while the
    // Kanban view is active: TaskBoard runs its own independent tasks query,
    // so this one (feeding the List view) would just be a wasted fetch.
    enabled: view === "list" && Boolean(me?.id),
  });
  const notifyTask = useNotifyTaskAssignee(workspaceSlug, projectId);
  const [nudgingId, setNudgingId] = React.useState<string | null>(null);
  const modulesQuery = useProjectModules(workspaceSlug, projectId);
  const membersQuery = useWorkspaceMembers(workspaceSlug);
  const moduleLabels = React.useMemo(() => {
    const names = new Map<string, ModuleLabel>();
    for (const instance of modulesQuery.data ?? []) {
      names.set(instance.id, {
        name: instance.module.name,
        planName: instance.module.plan?.name,
      });
    }
    return names;
  }, [modulesQuery.data]);
  const moduleOptions = React.useMemo(
    () => [
      ...(modulesQuery.data ?? []).map((instance) => ({
        value: instance.id,
        label: instance.module.name,
      })),
    ],
    [modulesQuery.data],
  );
  const moduleOrder = React.useMemo(
    () => (modulesQuery.data ?? []).map((instance) => instance.id),
    [modulesQuery.data],
  );
  // Hubs/Plans aren't stored on a work item directly — they're derived from
  // its module's plan, so filtering by either one really means "any module
  // instance whose plan (or plan's hub) is in the selected set." These two
  // maps translate a Hub/Plan id filter into the equivalent moduleInstanceIds
  // the backend already knows how to filter by (see applyFilters below).
  /** Module instances whose plan's hub id is in `hubIds`. */
  function moduleIdsForHubs(hubIds: string[]): string[] {
    if (hubIds.length === 0) return [];
    const wanted = new Set(hubIds);
    return (modulesQuery.data ?? [])
      .filter((instance) => {
        const hubId = instance.module.plan?.hub?.id;
        return hubId !== undefined && wanted.has(hubId);
      })
      .map((instance) => instance.id);
  }

  /** Module instances whose plan id is in `planIds`. */
  function moduleIdsForPlans(planIds: string[]): string[] {
    if (planIds.length === 0) return [];
    const wanted = new Set(planIds);
    return (modulesQuery.data ?? [])
      .filter((instance) => {
        const planId = instance.module.plan?.id;
        return planId !== undefined && wanted.has(planId);
      })
      .map((instance) => instance.id);
  }
  const hubOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const instance of modulesQuery.data ?? []) {
      const hub = instance.module.plan?.hub;
      if (hub && !seen.has(hub.id)) seen.set(hub.id, hub.name);
    }
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [modulesQuery.data]);
  const planOptions = React.useMemo(() => {
    const seen = new Map<string, string>();
    for (const instance of modulesQuery.data ?? []) {
      const plan = instance.module.plan;
      if (!plan || seen.has(plan.id)) continue;
      seen.set(plan.id, plan.hub ? `${plan.hub.name} ${plan.name}`.trim() : plan.name);
    }
    return Array.from(seen, ([value, label]) => ({ value, label }));
  }, [modulesQuery.data]);
  const statusOptions = React.useMemo(
    () => [
      ...(statusesQuery.data ?? []).map((status) => ({
        value: status.id,
        label: status.name,
      })),
    ],
    [statusesQuery.data],
  );
  const tasks = React.useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);

  const assigneeOptions = React.useMemo(
    () =>
      (membersQuery.data ?? [])
        .filter((member) => member.status !== "removed")
        .map((member) => {
          const user = member.user ?? member;
          return {
            value: user.id ?? "",
            label:
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.username ||
              user.email?.split("@")[0] ||
              "Unknown user",
          };
        })
        .filter((option) => Boolean(option.value)),
    [membersQuery.data],
  );
  const assigneeNames = React.useMemo(
    () =>
      new Map(assigneeOptions.map((option) => [option.value, option.label])),
    [assigneeOptions],
  );
  const assigneeFilterOptions = React.useMemo(
    () =>
      assigneeOptions.map((option) => ({
        ...option,
        label: option.value === me?.id ? "@Me" : option.label,
      })),
    [assigneeOptions, me?.id],
  );
  const workItems = React.useMemo(() => {
    const query = (appliedFilters.search ?? "").trim().toLowerCase();
    // Removed-category items (e.g. the seeded "Removed" status) are noise in
    // the default view — hide them unless the user explicitly filtered by
    // status, in which case their pick wins.
    const hideRemoved = !appliedFilters.statusIds?.length;
    return [
      ...tasks
        .filter(
          (task) =>
            appliedWorkTypes.length === 0 ||
            appliedWorkTypes.includes(task.workItemTypeId ?? ""),
        )
        .filter((task) => !hideRemoved || task.status?.category !== "removed")
        .filter(
          (task) =>
            !query ||
            `${task.prefix ?? ""} ${task.name}`.toLowerCase().includes(query),
        )
        .map((task) => ({
          type: "Task" as const,
          item: task,
          date: task.updatedAt ?? task.createdAt ?? "",
        })),
    ].sort((left, right) => right.date.localeCompare(left.date));
  }, [appliedFilters.search, appliedFilters.statusIds, appliedWorkTypes, tasks]);
  const columnVisible = (column: OptionalColumn) =>
    visibleColumns.includes(column);
  const pageCount = Math.max(1, Math.ceil(workItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedWorkItems = workItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );
  const moduleGroups = React.useMemo(
    () => groupByModule(paginatedWorkItems, moduleLabels, moduleOrder),
    [paginatedWorkItems, moduleLabels, moduleOrder],
  );
  function toggleColumn(column: OptionalColumn) {
    setVisibleColumns((current) =>
      current.includes(column)
        ? current.filter((value) => value !== column)
        : [...current, column],
    );
  }
  function clearFilters() {
    setKeyword("");
    setWorkTypes([]);
    setModuleIds([]);
    setHubIds([]);
    setPlanIds([]);
    setStatusIds([]);
    setStartDate("");
    setEndDate("");
    setAssigneeIds(me?.id ? [me.id] : []);
    setAppliedWorkTypes([]);
    setManualFilters(null);
  }
  return (
    <section className="flex flex-col gap-4">
      <div className="sticky top-9 z-20 -mx-4 flex flex-col gap-4 bg-background px-4  sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-lg font-semibold">Work items</h2>
              <p className="text-sm text-muted-foreground">
                Your assigned tasks and incidents.
              </p>
            </div>
            <div className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5">
              {TYPE_CATEGORY_TABS.map(({ value, label, icon: Icon }) => (
                <Button
                  key={value}
                  type="button"
                  variant={typeCategory === value ? "secondary" : "ghost"}
                  size="sm"
                  aria-pressed={typeCategory === value}
                  onClick={() => {
                    setTypeCategory(value);
                    setPage(1);
                  }}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {view === "kanban" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setKanbanFiltersOpen(true)}
              >
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            )}
            {view === "list" && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline">
                      <Columns3 className="h-4 w-4" />
                      Columns
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {OPTIONAL_COLUMNS.map((column) => (
                      <DropdownMenuCheckboxItem
                        key={column}
                        checked={columnVisible(column)}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={() => toggleColumn(column)}
                      >
                        {COLUMN_LABELS[column]}
                      </DropdownMenuCheckboxItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Sheet open={listFiltersOpen} onOpenChange={setListFiltersOpen}>
                  <SheetTrigger asChild>
                    <Button type="button" variant="outline">
                      <Filter className="h-4 w-4" />
                      Filters
                    </Button>
                  </SheetTrigger>
                  <SheetContent
                    side="right"
                    size="md"
                    className="data-[state=open]:duration-150 data-[state=closed]:duration-150"
                  >
                    <SheetHeader>
                      <SheetTitle>Filter work items</SheetTitle>
                      <SheetDescription>
                        Choose the work items to show in the list.
                      </SheetDescription>
                    </SheetHeader>
                    <SheetBody>
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Keyword
                        <Input
                          value={keyword}
                          onChange={(event) => setKeyword(event.target.value)}
                          placeholder="Filter by keyword"
                        />
                      </label>

                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Assignees
                        <MultiSelectField
                          aria-label="Filter by assignees"
                          options={assigneeFilterOptions}
                          values={assigneeIds}
                          onValuesChange={setAssigneeIds}
                          placeholder="Assignee"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        States
                        <MultiSelectField
                          aria-label="Filter by states"
                          options={statusOptions}
                          values={statusIds}
                          onValuesChange={setStatusIds}
                          placeholder="All statuses"
                        />
                      </label>
                      {hubOptions.length > 0 && (
                        <label className="flex flex-col gap-1.5 text-sm font-medium">
                          Hubs
                          <MultiSelectField
                            aria-label="Filter by hubs"
                            options={hubOptions}
                            values={hubIds}
                            onValuesChange={setHubIds}
                            placeholder="Hub"
                          />
                        </label>
                      )}
                      {planOptions.length > 0 && (
                        <label className="flex flex-col gap-1.5 text-sm font-medium">
                          Plans
                          <MultiSelectField
                            aria-label="Filter by plans"
                            options={planOptions}
                            values={planIds}
                            onValuesChange={setPlanIds}
                            placeholder="Plan"
                          />
                        </label>
                      )}
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Areas
                        <MultiSelectField
                          aria-label="Filter by areas"
                          options={moduleOptions}
                          values={moduleIds}
                          onValuesChange={setModuleIds}
                          placeholder="Area"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        Start date
                        <Input
                          type="date"
                          value={startDate}
                          onChange={(event) => setStartDate(event.target.value)}
                          aria-label="Filter by start date"
                        />
                      </label>
                      <label className="flex flex-col gap-1.5 text-sm font-medium">
                        End date
                        <Input
                          type="date"
                          value={endDate}
                          onChange={(event) => setEndDate(event.target.value)}
                          aria-label="Filter by end date"
                        />
                      </label>
                    </SheetBody>
                    <SheetFooter>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={clearFilters}
                      >
                        <X className="h-3.5 w-3.5" />
                        Reset filters
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          applyFilters();
                          setListFiltersOpen(false);
                        }}
                      >
                        <Search className="h-3.5 w-3.5" />
                        Search
                      </Button>
                    </SheetFooter>
                  </SheetContent>
                </Sheet>
              </>
            )}
            <div className="inline-flex items-center rounded-md border border-border p-0.5">
              <Button
                type="button"
                variant={view === "list" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={view === "list"}
                onClick={() => setView("list")}
              >
                <List className="h-4 w-4" />
                List
              </Button>
              <Button
                type="button"
                variant={view === "kanban" ? "secondary" : "ghost"}
                size="sm"
                aria-pressed={view === "kanban"}
                onClick={() => setView("kanban")}
              >
                <Kanban className="h-4 w-4" />
                Kanban
              </Button>
            </div>
            {canCreate && (
              <CreateWorkItemMenu
                workspaceSlug={workspaceSlug}
                onSelect={(workType) => goToCreate(workType)}
              >
                <Button type="button">
                  <Plus className="h-4 w-4" />
                  Work item
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CreateWorkItemMenu>
            )}
          </div>
        </div>
      </div>

      {view === "kanban" ? (
        <TaskBoard
          workspaceSlug={workspaceSlug}
          projectId={projectId}
          canCreate={canCreate}
          canUpdate={canUpdate}
          typeCategory={typeCategory}
          onCreate={(statusId, workType) => goToCreate(workType, statusId)}
          filtersOpen={kanbanFiltersOpen}
          onFiltersOpenChange={setKanbanFiltersOpen}
        />
      ) : (
        <QueryState
          isLoading={
            meLoading ||
            tasksQuery.isLoading ||
            modulesQuery.isLoading ||
            statusesQuery.isLoading ||
            workTypesQuery.isLoading
          }
          isError={
            tasksQuery.isError ||
            modulesQuery.isError ||
            statusesQuery.isError ||
            workTypesQuery.isError
          }
          error={
            tasksQuery.error ??
            modulesQuery.error ??
            statusesQuery.error ??
            workTypesQuery.error
          }
          onRetry={() => {
            tasksQuery.refetch();
            modulesQuery.refetch();
            statusesQuery.refetch();
            workTypesQuery.refetch();
          }}
          skeleton={<TableSkeleton columns={6} rows={6} />}
        >
          {workItems.length === 0 ? (
            <EmptyState
              icon={ListChecks}
              title="No work items"
              description="No work items match this assignee."
              action={
                canCreate ? (
                  <CreateWorkItemMenu
                    workspaceSlug={workspaceSlug}
                    onSelect={(workType) => goToCreate(workType)}
                    align="start"
                  >
                    <Button type="button">
                      <Plus className="h-4 w-4" />
                      Create work item
                    </Button>
                  </CreateWorkItemMenu>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
                <TableRow>
                  {columnVisible("type") && <TableHead>Type</TableHead>}
                  <TableHead>Work item</TableHead>
                  {columnVisible("assignee") && <TableHead>Assignee</TableHead>}
                  {columnVisible("status") && <TableHead>Status</TableHead>}
                  {columnVisible("startDate") && (
                    <TableHead>Start date</TableHead>
                  )}
                  {columnVisible("endDate") && <TableHead>End date</TableHead>}
                  <TableHead className="w-24 text-right">Nudge</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {moduleGroups.map((group) => {
                  const groupExpanded = !collapsedModules.has(group.key);
                  return (
                    <React.Fragment key={group.key}>
                      <TableRow className="bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={2 + visibleColumns.length}>
                          <button
                            type="button"
                            onClick={() => toggleModuleGroup(group.key)}
                            className="flex w-full items-center gap-1.5 text-left font-semibold"
                          >
                            {groupExpanded ? (
                              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                            {group.name}
                            <span className="ml-auto text-sm font-normal text-muted-foreground">
                              {group.rows.length}{" "}
                              {group.rows.length === 1 ? "item" : "items"}
                            </span>
                          </button>
                        </TableCell>
                      </TableRow>

                      {groupExpanded &&
                        group.rows.map(({ type, item }) => (
                          <TableRow key={`${type}-${item.id}`}>
                            {columnVisible("type") && (
                              <TableCell className="text-xs font-medium text-muted-foreground">
                                <WorkItemTypeIcon
                                  category={item.workItemType?.category}
                                  color={item.workItemType?.color}
                                  title={item.workItemType?.name}
                                />
                              </TableCell>
                            )}
                            <TableCell>
                              {
                                <div className="group/title flex items-center gap-1">
                                  <button
                                    type="button"
                                    className="text-left font-medium hover:text-primary hover:underline"
                                    onClick={() =>
                                      router.push(
                                        `/${workspaceSlug}/projects/${projectId}/work-items/${item.id}`,
                                      )
                                    }
                                  >
                                    {item.prefix ? `${item.prefix} · ` : ""}
                                    {item.name}
                                  </button>
                                  <CopyWorkItemLink
                                    prefix={item.prefix ?? "Task"}
                                    title={item.name}
                                    url={`/${workspaceSlug}/projects/${projectId}/work-items/${item.id}`}
                                  />
                                </div>
                              }
                            </TableCell>
                            {columnVisible("assignee") &&
                              (() => {
                                const assigneeName =
                                  assigneeNames.get(item.assigneeId ?? "") ??
                                  "Unassigned";
                                return (
                                  <TableCell>
                                    <span className="inline-flex items-center gap-2">
                                      <Avatar className="h-6 w-6">
                                        <AvatarFallback className="text-[9px]">
                                          {item.assigneeId
                                            ? initials(assigneeName)
                                            : "—"}
                                        </AvatarFallback>
                                      </Avatar>
                                      <span>{assigneeName}</span>
                                    </span>
                                  </TableCell>
                                );
                              })()}
                            {columnVisible("status") && (
                              <TableCell>
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className="h-2 w-2 shrink-0 rounded-full"
                                    style={{
                                      backgroundColor:
                                        item.status?.color ??
                                        "var(--status-neutral)",
                                    }}
                                    aria-hidden
                                  />
                                  <span>
                                    {item.status?.name ?? "No status"}
                                  </span>
                                </span>
                              </TableCell>
                            )}
                            {columnVisible("startDate") && (
                              <TableCell>
                                {type === "Task"
                                  ? formatDate(item.startDate)
                                  : "—"}
                              </TableCell>
                            )}
                            {columnVisible("endDate") && (
                              <TableCell>
                                {type === "Task"
                                  ? formatDate(item.dueDate)
                                  : "—"}
                              </TableCell>
                            )}
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={
                                  !item.assigneeId || nudgingId === item.id
                                }
                                title={
                                  item.assigneeId
                                    ? "Email the assignee"
                                    : "This item has no assignee"
                                }
                                onClick={() => {
                                  setNudgingId(item.id);
                                  notifyTask.mutate(item.id, {
                                    onSettled: () => setNudgingId(null),
                                  });
                                }}
                              >
                                <BellRing className="h-3.5 w-3.5" />
                                Nudge
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {workItems.length > PAGE_SIZE && (
            <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
              <span>
                {(currentPage - 1) * PAGE_SIZE + 1}–
                {Math.min(currentPage * PAGE_SIZE, workItems.length)} of{" "}
                {workItems.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <span className="px-2 text-xs">
                  Page {currentPage} of {pageCount}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={currentPage === pageCount}
                  onClick={() =>
                    setPage((current) => Math.min(pageCount, current + 1))
                  }
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </QueryState>
      )}
    </section>
  );
}
