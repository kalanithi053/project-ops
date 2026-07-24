"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { FolderKanban, Loader2, Plus } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { StatsGrid } from "@/components/shared/stats-grid";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SelectField, type SelectOption } from "@/components/shared/select-field";
import { QueryState } from "@/components/shared/query-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { useCreateProject, useProjects } from "@/lib/api/hooks/use-projects";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { useProjectTypes } from "@/lib/api/hooks/use-project-types";
import { usePlans } from "@/lib/api/hooks/use-plans";
import { useMe } from "@/lib/api/hooks/use-users";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";
import { formatDate } from "@/lib/format";
import type {
  CreateProjectDto,
  Me,
  Project,
  ProjectType,
  WorkspaceMember,
} from "@/lib/api/types";
import type { ColumnDef, Tone } from "@/types/module";

/** Small rotating palette so distinct (dynamic) project types read apart. */
const TONE_CYCLE: Tone[] = ["info", "warning", "success", "neutral"];

function toneForType(typeId: string | undefined, types: ProjectType[]): Tone {
  if (!typeId) return "neutral";
  const index = types.findIndex((t) => String(t.id) === typeId);
  return TONE_CYCLE[index % TONE_CYCLE.length] ?? "neutral";
}

function daysBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / 86_400_000));
}

function fullName(person: {
  firstName?: string;
  lastName?: string;
}): string {
  return [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
}

/** Resolve a username to a first + last name using members + the current user. */
function resolveName(
  username: string,
  members: WorkspaceMember[],
  me: Me | undefined,
): string {
  if (me?.username === username) return fullName(me) || username;
  const match = members.find(
    (m) => (m.user?.username ?? m.username) === username,
  );
  const user = match?.user ?? match;
  return (user && fullName(user)) || username;
}

/**
 * Best-effort display of a project's owner/creator as a full name. Reads
 * whichever owner-ish field the API returns, mapping a username to first
 * + last name; returns null when no owner info is present.
 */
function ownerName(
  project: Project,
  members: WorkspaceMember[],
  me: Me | undefined,
): string | null {
  const candidates = [
    project.createdBy,
    project.owner,
    project.ownerUsername,
    project.createdByUsername,
    project.user,
    project.author,
  ];
  for (const raw of candidates) {
    if (!raw) continue;
    if (typeof raw === "string") return resolveName(raw, members, me);
    if (typeof raw === "object") {
      const record = raw as Record<string, unknown>;
      const full = fullName({
        firstName: record.firstName as string | undefined,
        lastName: record.lastName as string | undefined,
      });
      if (full) return full;
      if (typeof record.username === "string") {
        return resolveName(record.username, members, me);
      }
    }
  }
  return null;
}

export default function ProjectsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { data, isLoading, isError, error, refetch } = useProjects(workspace);
  const { data: memberData } = useWorkspaceMembers(workspace);
  const { data: typeData } = useProjectTypes(workspace);
  const { data: me } = useMe();
  const { can } = usePermissions(workspace);
  const [open, setOpen] = React.useState(false);

  const projects = React.useMemo(() => data ?? [], [data]);
  const members = React.useMemo(() => memberData ?? [], [memberData]);
  const projectTypes = React.useMemo(() => typeData ?? [], [typeData]);

  const baseColumns = React.useMemo<ColumnDef<Project>[]>(
    () => [
      {
        key: "name",
        header: "Project",
        sortable: true,
        sortAccessor: (p) => p.name,
        cell: (p) => (
          <div className="flex flex-col">
            <span className="font-medium">{p.name}</span>
            {p.description ? (
              <span className="truncate text-xs text-muted-foreground">
                {p.description}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: "type",
        header: "Type",
        sortable: true,
        sortAccessor: (p) => p.projectType?.name ?? "",
        cell: (p) =>
          p.projectType ? (
            <StatusBadge
              label={p.projectType.name}
              tone={toneForType(p.projectType.id, projectTypes)}
            />
          ) : (
            "—"
          ),
      },
      {
        key: "startDate",
        header: "Start",
        hideBelow: "sm",
        sortable: true,
        sortAccessor: (p) => p.startDate ?? "",
        cell: (p) => (
          <span className="text-muted-foreground">{formatDate(p.startDate)}</span>
        ),
      },
      {
        key: "endDate",
        header: "End",
        hideBelow: "sm",
        sortable: true,
        sortAccessor: (p) => p.endDate ?? "",
        cell: (p) => (
          <span className="text-muted-foreground">{formatDate(p.endDate)}</span>
        ),
      },
      {
        key: "duration",
        header: "Duration",
        align: "right",
        hideBelow: "md",
        cell: (p) => {
          const days = daysBetween(p.startDate, p.endDate);
          return days === null ? "—" : `${days}d`;
        },
      },
    ],
    [projectTypes],
  );

  // Only show the "Created by" column when the API actually returns owner info.
  const columns = React.useMemo<ColumnDef<Project>[]>(() => {
    const hasOwner = projects.some((p) => ownerName(p, members, me));
    if (!hasOwner) return baseColumns;
    return [
      ...baseColumns,
      {
        key: "owner",
        header: "Created by",
        hideBelow: "lg",
        cell: (p) => ownerName(p, members, me) ?? "—",
      },
    ];
  }, [baseColumns, projects, members, me]);

  const stats = [
    { label: "Total Projects", value: projects.length, icon: FolderKanban },
    ...projectTypes.slice(0, 3).map((type) => ({
      label: type.name,
      value: projects.filter((p) => p.projectType?.id === type.id).length,
    })),
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Projects"
          description="Create and track projects in this workspace."
        />
        {can(PERMISSIONS.PROJECT_CREATE) && (
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button className="w-full sm:w-auto">
                <Plus className="h-4 w-4" />
                New project
              </Button>
            </SheetTrigger>
            <NewProjectPanel
              workspaceSlug={workspace}
              onDone={() => setOpen(false)}
            />
          </Sheet>
        )}
      </div>

      <StatsGrid stats={stats} />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton columns={5} />}
      >
        <DataTable
          columns={columns}
          data={projects}
          getRowId={(p) => String(p.id)}
          searchAccessors={[(p) => p.name, (p) => p.projectType?.name ?? ""]}
          searchPlaceholder="Search projects…"
          emptyMessage="No projects yet. Create your first project to get started."
        />
      </QueryState>
    </PageContainer>
  );
}

/**
 * New-project creation side panel. Slides in from the right; the form
 * scrolls independently of a sticky footer action.
 */
function NewProjectPanel({
  workspaceSlug,
  onDone,
}: {
  workspaceSlug: string;
  onDone: () => void;
}) {
  const createProject = useCreateProject(workspaceSlug);
  const { data: typeData } = useProjectTypes(workspaceSlug);
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");
  const [projectTypeId, setProjectTypeId] = React.useState<string>();
  const [planId, setPlanId] = React.useState<string>();
  const [error, setError] = React.useState<string | null>(null);

  const typeOptions: SelectOption[] = (typeData ?? []).map((type) => ({
    label: type.name,
    value: String(type.id),
  }));

  // Project types with `isPlanAdd` provision plan-scoped quotas/modules —
  // the API requires an explicit plan for those (it does not fall back to
  // the workspace's active plan despite what the docs imply).
  const selectedType = typeData?.find((t) => String(t.id) === projectTypeId);
  const requiresPlan = Boolean(selectedType?.isPlanAdd);
  const { data: planData } = usePlans(
    workspaceSlug,
    requiresPlan ? projectTypeId : undefined,
  );
  const planOptions: SelectOption[] = (planData ?? []).map((plan) => ({
    label: plan.isActive ? `${plan.name} (Active)` : plan.name,
    value: String(plan.id),
  }));
  // Default to the type's active plan until the user explicitly picks one
  // (derived, not stored — avoids an effect-driven setState).
  const activePlanId = planData?.find((plan) => plan.isActive)?.id;
  const selectedPlanId = planId ?? (activePlanId ? String(activePlanId) : undefined);

  function handleTypeChange(value: string) {
    setProjectTypeId(value);
    setPlanId(undefined);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Enter a project name.");
    if (!projectTypeId) return setError("Select a project type.");
    if (requiresPlan && !selectedPlanId) return setError("Select a plan.");
    if (!startDate) return setError("Choose a start date.");
    if (!endDate) return setError("Choose an end date.");
    if (endDate < startDate) {
      return setError("End date can't be before the start date.");
    }

    const dto: CreateProjectDto = {
      name: name.trim(),
      projectTypeId,
      startDate,
      endDate,
      description: description.trim() || undefined,
      planId: requiresPlan ? selectedPlanId : undefined,
    };

    // API errors surface via the global error toast; success closes the panel.
    createProject.mutate(dto, { onSuccess: () => onDone() });
  }

  return (
    <SheetContent
      side="right"
      className="flex w-full flex-col gap-0 sm:max-w-md"
    >
      <SheetHeader>
        <SheetTitle className="text-base">New project</SheetTitle>
        <SheetDescription>
          Add a project and choose its project type.
        </SheetDescription>
      </SheetHeader>

      <form
        onSubmit={handleSubmit}
        noValidate
        className="flex min-h-0 flex-1 flex-col"
      >
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              placeholder="Website Redesign"
              value={name}
              onChange={(event) => setName(event.target.value)}
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-type">Project type</Label>
            <SelectField
              id="project-type"
              aria-label="Project type"
              options={typeOptions}
              value={projectTypeId}
              onValueChange={handleTypeChange}
              placeholder="Select a project type"
            />
          </div>

          {requiresPlan && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-plan">Plan</Label>
              <SelectField
                id="project-plan"
                aria-label="Plan"
                options={planOptions}
                value={selectedPlanId}
                onValueChange={setPlanId}
                placeholder="Select a plan"
              />
              <p className="text-xs text-muted-foreground">
                This project type provisions modules from the selected plan.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="project-description">Description</Label>
            <Input
              id="project-description"
              placeholder="Optional summary"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-start">Start date</Label>
              <Input
                id="project-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="project-end">End date</Label>
              <Input
                id="project-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>

        <div className="border-t border-border p-4">
          <Button
            type="submit"
            className="w-full"
            disabled={createProject.isPending}
          >
            {createProject.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create project"
            )}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
