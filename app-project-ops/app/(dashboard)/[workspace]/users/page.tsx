"use client";

import { Loader2, UserPlus, Users } from "lucide-react";
import { useParams } from "next/navigation";
import * as React from "react";

import { PageContainer } from "@/components/layout/page-container";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { DataTable } from "@/components/shared/data-table";
import { FormPanel } from "@/components/shared/form-panel";
import { MultiSelectField } from "@/components/shared/multi-select-field";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatsGrid } from "@/components/shared/stats-grid";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  useAddWorkspaceMember,
  useRemoveWorkspaceMember,
  useUpdateWorkspaceMember,
  useWorkspaceMembers,
} from "@/lib/api/hooks/use-members";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { useProjects } from "@/lib/api/hooks/use-projects";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { MemberUser, WorkspaceMember } from "@/lib/api/types";
import { getFullname } from "@/lib/utils";
import type { ColumnDef } from "@/types/module";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Member name/email live under a nested `user` object (fallback to flat). */
function memberUser(m: WorkspaceMember): MemberUser {
  return m.user ?? m;
}

function memberName(m: WorkspaceMember): string {
  const u = memberUser(m);
  return getFullname(u) || "—";
}

function memberEmail(m: WorkspaceMember): string {
  const u = memberUser(m);
  return u.email ?? "";
}

function roleName(m: WorkspaceMember): string {
  if (!m.role) return "—";
  return typeof m.role === "string" ? m.role : (m.role.name ?? "—");
}

function roleIdOf(m: WorkspaceMember): string | undefined {
  if (m.roleId) return m.roleId;
  return m.role && typeof m.role !== "string" ? m.role.id : undefined;
}

export default function UsersPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { data, isLoading, isError, error, refetch } =
    useWorkspaceMembers(workspace);
  const { data: settings } = useWorkspaceSettings(workspace);
  const { can } = usePermissions(workspace);
  const updateMember = useUpdateWorkspaceMember(workspace);
  const removeMember = useRemoveWorkspaceMember(workspace);
  const [open, setOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<WorkspaceMember | null>(null);
  const members = data ?? [];

  const stats = [
    { label: "Total Users", value: members.length, icon: Users },
    {
      label: "Active",
      value: members.filter(
        (m) => String(m.status ?? "").toLowerCase() === "active",
      ).length,
    },
  ];

  const canInvite = can(PERMISSIONS.MEMBER_INVITE);
  const canRemove = can(PERMISSIONS.MEMBER_REMOVE);
  const roleOptions: SelectOption[] = (settings?.roles ?? []).map((role) => ({
    label: role.name,
    value: role.id,
  }));

  const columns: ColumnDef<WorkspaceMember>[] = [
    {
      key: "name",
      header: "User",
      sortable: true,
      sortAccessor: (m) => memberName(m),
      cell: (m) => (
        <div className="flex flex-col">
          <span className="font-medium">{memberName(m)}</span>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      hideBelow: "sm",
      sortable: true,
      sortAccessor: (m) => roleName(m),
      cell: (m) => {
        if (!canInvite) return roleName(m);
        const busy =
          updateMember.isPending && updateMember.variables?.id === m.id;
        return (
          <div className="flex items-center gap-2">
            <SelectField
              aria-label={`Role for ${memberName(m)}`}
              options={roleOptions}
              value={roleIdOf(m)}
              onValueChange={(roleId) =>
                updateMember.mutate({ id: m.id, dto: { roleId } })
              }
              placeholder="Select a role"
              disabled={busy}
              className="h-8 w-40"
            />
            {busy && (
              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
            )}
          </div>
        );
      },
    },
    {
      key: "status",
      header: "Status",
      align: canRemove ? "left" : "right",
      cell: (m) =>
        m.status ? (
          <StatusBadge
            label={String(m.status)}
            tone={
              String(m.status).toLowerCase() === "active" ? "success" : "neutral"
            }
          />
        ) : (
          "—"
        ),
    },
    ...(canRemove
      ? [
          {
            key: "actions",
            header: "Actions",
            align: "right" as const,
            cell: (m: WorkspaceMember) => (
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => setRemoving(m)}
              >
                Remove
              </Button>
            ),
          },
        ]
      : []),
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Users" description="" />
        {canInvite && (
          <Button className="w-full sm:w-auto" onClick={() => setOpen(true)}>
            <UserPlus className="h-4 w-4" />
            Add User
          </Button>
        )}
      </div>

      <StatsGrid stats={stats} />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton columns={3} rows={10} />}
      >
        <DataTable
          columns={columns}
          data={members}
          getRowId={(m) => String(m.id)}
          searchAccessors={[
            (m) => memberName(m),
            (m) => memberEmail(m),
            (m) => memberUser(m).username ?? "",
          ]}
          searchPlaceholder="Search users…"
          emptyMessage="No members yet. Add someone to this workspace to get started."
        />
      </QueryState>

      {open && (
        <AddUserPanel workspaceSlug={workspace} onDone={() => setOpen(false)} />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(nextOpen) => !nextOpen && setRemoving(null)}
        title={`Remove ${removing ? memberName(removing) : "this member"}?`}
        description="They lose access to this workspace and every project in it."
        confirmLabel="Remove access"
        destructive
        pending={removeMember.isPending}
        onConfirm={() =>
          removing &&
          removeMember.mutate(removing.id, {
            onSuccess: () => setRemoving(null),
          })
        }
      />
    </PageContainer>
  );
}

function AddUserPanel({
  workspaceSlug,
  onDone,
}: {
  workspaceSlug: string;
  onDone: () => void;
}) {
  const addMember = useAddWorkspaceMember(workspaceSlug);
  const { data: settings } = useWorkspaceSettings(workspaceSlug);
  const { data: projects } = useProjects(workspaceSlug);
  const roles = settings?.roles;
  const [email, setEmail] = React.useState("");
  const [roleId, setRoleId] = React.useState<string>();
  const [projectIds, setProjectIds] = React.useState<string[]>([]);
  // Each selected project gets its own role — project access doesn't have to
  // mirror the workspace-wide one.
  const [projectRoleIds, setProjectRoleIds] = React.useState<
    Record<string, string | undefined>
  >({});
  const [error, setError] = React.useState<string | null>(null);

  const roleOptions: SelectOption[] = (roles ?? []).map((role) => ({
    label: role.name,
    value: String(role.id),
  }));
  const projectOptions: SelectOption[] = (projects ?? []).map((project) => ({
    label: project.name,
    value: project.id,
  }));
  const defaultRoleId =
    roleId ?? (roles ?? []).find((role) => role.isDefault)?.id ?? roles?.[0]?.id;

  function handleProjectIdsChange(nextIds: string[]) {
    setProjectIds(nextIds);
    // Newly checked projects start on the workspace role (still editable per
    // project below); dropping a project also drops its role choice.
    setProjectRoleIds((current) => {
      const next: Record<string, string | undefined> = {};
      for (const id of nextIds) next[id] = current[id] ?? defaultRoleId;
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) return setError("Enter the user's email.");
    if (!EMAIL_PATTERN.test(trimmed)) return setError("Enter a valid email.");

    const projectMemberships: { projectId: string; roleId: string }[] = [];
    for (const projectId of projectIds) {
      const projectRoleId = projectRoleIds[projectId] ?? defaultRoleId;
      if (!projectRoleId) {
        const project = projects?.find((p) => p.id === projectId);
        return setError(
          `Choose a role for ${project?.name ?? "the selected project"}.`,
        );
      }
      projectMemberships.push({ projectId, roleId: projectRoleId });
    }

    // API errors surface via the global error toast; success closes the panel.
    addMember.mutate(
      { email: trimmed, roleId, projectMemberships },
      { onSuccess: () => onDone() },
    );
  }

  return (
    <FormPanel
      title="Add user"
      description="Add a user by email, assign their role, and optionally give them access to specific projects."
      onClose={onDone}
      onSubmit={handleSubmit}
      busy={addMember.isPending}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={onDone}
            disabled={addMember.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={addMember.isPending}>
            {addMember.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Adding…
              </>
            ) : (
              "Add User"
            )}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-email">Email</Label>
        <Input
          id="invite-email"
          type="email"
          placeholder="jordan.rivera@company.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoFocus
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-role">Role</Label>
        <SelectField
          id="invite-role"
          aria-label="Role"
          options={roleOptions}
          value={roleId}
          onValueChange={setRoleId}
          placeholder={roleOptions.length ? "Select a role" : "Default role"}
        />
        <p className="text-xs text-muted-foreground">
          The role determines what this user can do in the workspace.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="invite-projects">Projects</Label>
        <MultiSelectField
          id="invite-projects"
          aria-label="Projects"
          options={projectOptions}
          values={projectIds}
          onValuesChange={handleProjectIdsChange}
          placeholder="No projects selected"
        />
        <p className="text-xs text-muted-foreground">
          Also add this user as a member of the selected projects. Projects
          they already belong to are left as-is.
        </p>
      </div>

      {projectIds.length > 0 && (
        <div className="flex flex-col gap-3 rounded-md border border-border p-3">
          {projectIds.map((projectId) => {
            const project = projects?.find((p) => p.id === projectId);
            return (
              <div
                key={projectId}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 flex-1 truncate text-sm">
                  {project?.name ?? projectId}
                </span>
                <SelectField
                  aria-label={`Role in ${project?.name ?? "project"}`}
                  className="w-40 shrink-0"
                  options={roleOptions}
                  value={projectRoleIds[projectId]}
                  onValueChange={(value) =>
                    setProjectRoleIds((current) => ({
                      ...current,
                      [projectId]: value,
                    }))
                  }
                  placeholder="Select a role"
                />
              </div>
            );
          })}
        </div>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </FormPanel>
  );
}
