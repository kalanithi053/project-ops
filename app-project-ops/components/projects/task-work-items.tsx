"use client";

import {
  AlertTriangle,
  BellRing,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Columns3,
  Filter,
  ListChecks,
  Plus,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { EmptyState } from "@/components/shared/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CopyWorkItemLink } from "@/components/projects/copy-work-item-link";
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
  DropdownMenuItem,
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
import {
  useIncidents,
  useNotifyIncidentAssignee,
} from "@/lib/api/hooks/use-incidents";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { useNotifyTaskAssignee, useTasks } from "@/lib/api/hooks/use-tasks";
import { useTicketStatuses } from "@/lib/api/hooks/use-ticket-statuses";
import { useMe } from "@/lib/api/hooks/use-users";
import { formatDate } from "@/lib/format";

const OPTIONAL_COLUMNS = [
  "type",
  "module",
  "assignee",
  "status",
  "startDate",
  "endDate",
] as const;
type OptionalColumn = (typeof OPTIONAL_COLUMNS)[number];
const COLUMN_LABELS: Record<OptionalColumn, string> = {
  type: "Type",
  module: "Module",
  assignee: "Assignee",
  status: "Status",
  startDate: "Start date",
  endDate: "End date",
};
const PAGE_SIZE = 20;
const WORK_TYPE_OPTIONS = [
  { value: "task", label: "Task" },
  { value: "incident", label: "Incident" },
];

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
  canCreateIncident,
}: {
  workspaceSlug: string;
  projectId: string;
  canCreate: boolean;
  canCreateIncident: boolean;
}) {
  const router = useRouter();
  const { data: me } = useMe();
  const [assigneeIds, setAssigneeIds] = React.useState<string[]>([]);
  const [keyword, setKeyword] = React.useState("");
  const [debouncedKeyword, setDebouncedKeyword] = React.useState("");
  const [workTypes, setWorkTypes] = React.useState<string[]>([]);
  const [moduleIds, setModuleIds] = React.useState<string[]>([]);
  const [statusIds, setStatusIds] = React.useState<string[]>([]);
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [page, setPage] = React.useState(1);
  const columnStorageKey = `project-ops:work-items-columns:${workspaceSlug}:${projectId}`;
  const [visibleColumns, setVisibleColumns] = React.useState<OptionalColumn[]>(() => {
    if (typeof window === "undefined") return [...OPTIONAL_COLUMNS];
    try {
      const stored = window.localStorage.getItem(columnStorageKey);
      const values: unknown = stored ? JSON.parse(stored) : null;
      if (Array.isArray(values)) {
        const columns = values.filter(
          (value): value is OptionalColumn =>
            typeof value === "string" && OPTIONAL_COLUMNS.includes(value as OptionalColumn),
        );
        return [
          ...columns,
          ...(columns.includes("startDate") ? [] : (["startDate"] as OptionalColumn[])),
          ...(columns.includes("endDate") ? [] : (["endDate"] as OptionalColumn[])),
        ] as OptionalColumn[];
      }
    } catch {}
    return [...OPTIONAL_COLUMNS];
  });
  const initializedAssignee = React.useRef(false);
  React.useEffect(() => {
    if (!initializedAssignee.current && me?.id) {
      setAssigneeIds([me.id]);
      initializedAssignee.current = true;
    }
  }, [me?.id]);
  React.useEffect(() => {
    try {
      window.localStorage.setItem(columnStorageKey, JSON.stringify(visibleColumns));
    } catch {}
  }, [columnStorageKey, visibleColumns]);
  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedKeyword(keyword), 350);
    return () => window.clearTimeout(timer);
  }, [keyword]);
  const statusesQuery = useTicketStatuses(workspaceSlug);
  const defaultOpenStatusIds = React.useMemo(
    () => [
      ...(statusesQuery.data ?? [])
        .filter((status) => status.category !== "done")
        .map((status) => status.id),
    ],
    [statusesQuery.data],
  );
  const selectedStatusIds =
    statusIds.length > 0 ? statusIds : defaultOpenStatusIds;
  const taskFilters = React.useMemo(
    () => ({
      ...(assigneeIds.length ? { assigneeIds } : {}),
      ...(debouncedKeyword.trim() ? { search: debouncedKeyword.trim() } : {}),
      ...(moduleIds.length ? { moduleInstanceIds: moduleIds } : {}),
      ...(startDate ? { startDate } : {}),
      ...(endDate ? { endDate } : {}),
      ...(selectedStatusIds.length
        ? { statusIds: selectedStatusIds }
        : {}),
    }),
    [
      assigneeIds,
      debouncedKeyword,
      endDate,
      moduleIds,
      selectedStatusIds,
      startDate,
    ],
  );
  const tasksQuery = useTasks(workspaceSlug, projectId, taskFilters);
  const incidentsQuery = useIncidents(workspaceSlug, projectId, assigneeIds);
  const notifyTask = useNotifyTaskAssignee(workspaceSlug, projectId);
  const notifyIncident = useNotifyIncidentAssignee(workspaceSlug, projectId);
  const [nudgingId, setNudgingId] = React.useState<string | null>(null);
  const modulesQuery = useProjectModules(workspaceSlug, projectId);
  const membersQuery = useWorkspaceMembers(workspaceSlug);
  const moduleNames = React.useMemo(() => {
    const names = new Map<string, string>();
    for (const instance of modulesQuery.data ?? []) {
      names.set(instance.id, instance.module.name);
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
  const incidents = React.useMemo(
    () => incidentsQuery.data ?? [],
    [incidentsQuery.data],
  );
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
              user.email || "Unknown user",
          };
        })
        .filter((option) => Boolean(option.value)),
    [membersQuery.data],
  );
  const assigneeNames = React.useMemo(
    () => new Map(assigneeOptions.map((option) => [option.value, option.label])),
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
    const query = keyword.trim().toLowerCase();
    return [
      ...(workTypes.length === 0 || workTypes.includes("task")
        ? tasks
            .filter((task) =>
              !query || `${task.prefix ?? ""} ${task.name}`.toLowerCase().includes(query),
            )
            .map((task) => ({
              type: "Task" as const,
              item: task,
              date: task.updatedAt ?? task.createdAt ?? "",
            }))
        : []),
      ...(workTypes.length === 0 || workTypes.includes("incident")
        ? incidents
            .filter((incident) => {
              const matchesKeyword =
                !query || incident.title.toLowerCase().includes(query);
              const matchesStatus =
                selectedStatusIds.length === 0 ||
                selectedStatusIds.includes(incident.statusId);
              return matchesKeyword && matchesStatus && !startDate && !endDate;
            })
            .map((incident) => ({
              type: "Incident" as const,
              item: incident,
              date: incident.updatedAt ?? incident.createdAt,
            }))
        : []),
    ].sort((left, right) => right.date.localeCompare(left.date));
  }, [endDate, incidents, keyword, selectedStatusIds, startDate, tasks, workTypes]);
  const columnVisible = (column: OptionalColumn) => visibleColumns.includes(column);
  const pageCount = Math.max(1, Math.ceil(workItems.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const paginatedWorkItems = workItems.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
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
    setStatusIds([]);
    setStartDate("");
    setEndDate("");
    setAssigneeIds(me?.id ? [me.id] : []);
  }

  return (
      <section className="flex flex-col gap-4">
        <div className="sticky top-[6rem] z-20 -mx-4 flex flex-col gap-4 border-b border-border bg-background px-4 py-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Work items</h2>
              <p className="text-sm text-muted-foreground">Your assigned tasks and incidents.</p>
            </div>
            {(canCreate || canCreateIncident) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button">
                    <Plus className="h-4 w-4" />
                    Work item
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canCreate && <DropdownMenuItem onSelect={() => router.push(`/${workspaceSlug}/projects/${projectId}/tasks/new`)}>Task</DropdownMenuItem>}
                  {canCreateIncident && <DropdownMenuItem onSelect={() => router.push(`/${workspaceSlug}/projects/${projectId}/incidents/new`)}>Incident</DropdownMenuItem>}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                <Filter className="h-4 w-4" />
                Filters
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              size="md"
              className="data-[state=open]:duration-200"
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
                  <Input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="Filter by keyword" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Type
                  <MultiSelectField
                    aria-label="Filter by work-item type"
                    options={WORK_TYPE_OPTIONS}
                    values={workTypes}
                    onValuesChange={setWorkTypes}
                    placeholder="All types"
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Assignees
                  <MultiSelectField aria-label="Filter by assignees" options={assigneeFilterOptions} values={assigneeIds} onValuesChange={setAssigneeIds} placeholder="Assignee" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  States
                  <MultiSelectField aria-label="Filter by states" options={statusOptions} values={selectedStatusIds} onValuesChange={setStatusIds} placeholder="Open items" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Areas
                  <MultiSelectField aria-label="Filter by areas" options={moduleOptions} values={moduleIds} onValuesChange={setModuleIds} placeholder="Area" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  Start date
                  <Input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} aria-label="Filter by start date" />
                </label>
                <label className="flex flex-col gap-1.5 text-sm font-medium">
                  End date
                  <Input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} aria-label="Filter by end date" />
                </label>
              </SheetBody>
              <SheetFooter>
                <Button type="button" variant="ghost" onClick={clearFilters}>
                  <X className="h-3.5 w-3.5" />
                  Reset filters
                </Button>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
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
          </div>
        </div>

        <QueryState
          isLoading={tasksQuery.isLoading || incidentsQuery.isLoading || modulesQuery.isLoading || statusesQuery.isLoading}
          isError={tasksQuery.isError || incidentsQuery.isError || modulesQuery.isError || statusesQuery.isError}
          error={tasksQuery.error ?? incidentsQuery.error ?? modulesQuery.error ?? statusesQuery.error}
          onRetry={() => {
            tasksQuery.refetch();
            incidentsQuery.refetch();
            modulesQuery.refetch();
            statusesQuery.refetch();
          }}
          skeleton={<TableSkeleton columns={6} rows={6} />}
        >
        {workItems.length === 0 ? (
          <EmptyState
            icon={ListChecks}
            title="No work items"
            description="No tasks or incidents match this assignee."
            action={
              canCreate || canCreateIncident ? <Button type="button" onClick={() => router.push(`/${workspaceSlug}/projects/${projectId}/tasks/new`)}><Plus className="h-4 w-4" />Create task</Button> : undefined
            }
          />
        ) : (
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background shadow-sm">
              <TableRow>
                {columnVisible("type") && <TableHead>Type</TableHead>}
                <TableHead>Work item</TableHead>
                {columnVisible("module") && <TableHead>Module</TableHead>}
                {columnVisible("assignee") && <TableHead>Assignee</TableHead>}
                {columnVisible("status") && <TableHead>Status</TableHead>}
                {columnVisible("startDate") && <TableHead>Start date</TableHead>}
                {columnVisible("endDate") && <TableHead>End date</TableHead>}
                <TableHead className="w-24 text-right">Nudge</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedWorkItems.map(({ type, item }) => (
                <TableRow key={`${type}-${item.id}`}>
                  {columnVisible("type") && (
                    <TableCell className="text-xs font-medium text-muted-foreground">
                      {type === "Task" ? <ListChecks className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                    </TableCell>
                  )}
                  <TableCell>
                    {type === "Task" ? (
                      <div className="group/title flex items-center gap-1">
                        <button
                          type="button"
                          className="text-left font-medium hover:text-primary hover:underline"
                          onClick={() =>
                            router.push(
                              `/${workspaceSlug}/projects/${projectId}/tasks/${item.id}`,
                            )
                          }
                        >
                          {item.prefix ? `${item.prefix} · ` : ""}
                          {item.name}
                        </button>
                        <CopyWorkItemLink
                          prefix={item.prefix ?? "Task"}
                          title={item.name}
                          url={`/${workspaceSlug}/projects/${projectId}/tasks/${item.id}`}
                        />
                      </div>
                    ) : (
                      <div className="group/title flex items-center gap-1">
                        <button
                          type="button"
                          className="text-left font-medium hover:text-primary hover:underline"
                          onClick={() =>
                            router.push(
                              `/${workspaceSlug}/projects/${projectId}/incidents/${item.id}`,
                            )
                          }
                        >
                          {item.title}
                        </button>
                        <CopyWorkItemLink
                          prefix="Incident"
                          title={item.title}
                          url={`/${workspaceSlug}/projects/${projectId}/incidents/${item.id}`}
                        />
                      </div>
                    )}
                  </TableCell>
                  {columnVisible("module") && <TableCell>{type === "Task" && item.moduleInstanceId ? moduleNames.get(item.moduleInstanceId) ?? "—" : "—"}</TableCell>}
                  {columnVisible("assignee") && (() => {
                    const assigneeName =
                      assigneeNames.get(item.assigneeId ?? "") ?? "Unassigned";
                    return (
                      <TableCell>
                        <span className="inline-flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[9px]">
                              {item.assigneeId ? initials(assigneeName) : "—"}
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
                              type === "Task"
                                ? item.status?.color ?? "var(--status-neutral)"
                                : item.status.color ?? "var(--status-neutral)",
                          }}
                          aria-hidden
                        />
                        <span>
                          {type === "Task"
                            ? item.status?.name ?? "No status"
                            : item.status.name}
                        </span>
                      </span>
                    </TableCell>
                  )}
                  {columnVisible("startDate") && (
                    <TableCell>{type === "Task" ? formatDate(item.startDate) : "—"}</TableCell>
                  )}
                  {columnVisible("endDate") && (
                    <TableCell>{type === "Task" ? formatDate(item.dueDate) : "—"}</TableCell>
                  )}
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!item.assigneeId || nudgingId === item.id}
                      title={item.assigneeId ? "Email the assignee" : "This item has no assignee"}
                      onClick={() => {
                        setNudgingId(item.id);
                        (type === "Task" ? notifyTask : notifyIncident).mutate(
                          item.id,
                          { onSettled: () => setNudgingId(null) },
                        );
                      }}
                    >
                      <BellRing className="h-3.5 w-3.5" />
                      Nudge
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {workItems.length > PAGE_SIZE && (
          <div className="flex items-center justify-between gap-3 px-1 text-sm text-muted-foreground">
            <span>
              {(currentPage - 1) * PAGE_SIZE + 1}–
              {Math.min(currentPage * PAGE_SIZE, workItems.length)} of {workItems.length}
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
      </section>
  );
}
