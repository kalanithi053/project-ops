"use client";

import { Eye, FolderKanban, ListChecks, Plus } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { PageContainer } from "@/components/layout/page-container";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatsGrid } from "@/components/shared/stats-grid";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { useProjectTypes } from "@/lib/api/hooks/use-project-types";
import { useProjects } from "@/lib/api/hooks/use-projects";
import { useMe } from "@/lib/api/hooks/use-users";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { Me, Project, ProjectType, WorkspaceMember } from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import type { ColumnDef, RowAction, Tone } from "@/types/module";

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

function fullName(person: { firstName?: string; lastName?: string }): string {
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
            {/* The name is the primary way into a project — the row menu's
                View action is the discoverable duplicate, not the only path. */}
            <Link
              href={`/${workspace}/projects/${p.id}`}
              className="font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:underline"
            >
              {p.name}
            </Link>
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
          <span className="text-muted-foreground">
            {formatDate(p.startDate)}
          </span>
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
    [projectTypes, workspace],
  );

  const rowActions = React.useMemo<RowAction<Project>[]>(
    () => [
      {
        label: "View project",
        icon: Eye,
        href: (p) => `/${workspace}/projects/${p.id}`,
      },
      {
        label: "Open work items",
        icon: ListChecks,
        href: (p) => `/${workspace}/projects/${p.id}/work-items`,
      },
    ],
    [workspace],
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
          <Button
            className="w-full sm:w-auto"
            data-tour="new-project-button"
            asChild
          >
            <Link href={`/${workspace}/projects/new`}>
              <Plus className="h-4 w-4" />
              New project
            </Link>
          </Button>
        )}
      </div>

      <StatsGrid stats={stats} />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton columns={7} rows={10} />}
      >
        <DataTable
          columns={columns}
          data={projects}
          getRowId={(p) => String(p.id)}
          rowActions={rowActions}
          searchAccessors={[(p) => p.name, (p) => p.projectType?.name ?? ""]}
          searchPlaceholder="Search projects…"
          emptyMessage="No projects yet. Create your first project to get started."
        />
      </QueryState>
    </PageContainer>
  );
}

