"use client";

import { Loader2, Users } from "lucide-react";
import { useParams } from "next/navigation";
import * as React from "react";

import { PageContainer } from "@/components/layout/page-container";
import { DataTable } from "@/components/shared/data-table";
import { FormPanel } from "@/components/shared/form-panel";
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
  useInviteMember,
  useWorkspaceMembers,
} from "@/lib/api/hooks/use-members";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { MemberUser, WorkspaceMember } from "@/lib/api/types";
import { getFullname } from "@/lib/utils";
import type { ColumnDef } from "@/types/module";

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

const columns: ColumnDef<WorkspaceMember>[] = [
  {
    key: "name",
    header: "User",
    sortable: true,
    sortAccessor: (m) => memberName(m),
    cell: (m) => (
      <div className="flex flex-col">
        <span className="font-medium">{memberName(m)}</span>
        {/* <span className="text-xs text-muted-foreground">{memberEmail(m)}</span> */}
      </div>
    ),
  },
  {
    key: "role",
    header: "Role",
    hideBelow: "sm",
    sortable: true,
    sortAccessor: (m) => roleName(m),
    cell: (m) => roleName(m),
  },
  {
    key: "status",
    header: "Status",
    align: "right",
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
];

export default function UsersPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { data, isLoading, isError, error, refetch } =
    useWorkspaceMembers(workspace);
  const { can } = usePermissions(workspace);
  const [open, setOpen] = React.useState(false);
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

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Users" description="" />
        {/* {canInvite && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="w-full sm:w-auto">
                <UserPlus className="h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <AddUserDialog
              workspaceSlug={workspace}
              onDone={() => setOpen(false)}
            />
          </Dialog>
        )} */}
      </div>

      <StatsGrid stats={stats} />

      <QueryState
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        skeleton={<TableSkeleton columns={3} />}
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
  const invite = useInviteMember(workspaceSlug);
  const { data: settings } = useWorkspaceSettings(workspaceSlug);
  const roles = settings?.roles;
  const [username, setUsername] = React.useState("");
  const [roleId, setRoleId] = React.useState<string>();
  const [error, setError] = React.useState<string | null>(null);

  const roleOptions: SelectOption[] = (roles ?? []).map((role) => ({
    label: role.name,
    value: String(role.id),
  }));

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!username.trim()) return setError("Enter the user's username.");

    // API errors surface via the global error toast; success closes the dialog.
    invite.mutate(
      { username: username.trim(), roleId: roleId || undefined },
      { onSuccess: () => onDone() },
    );
  }

  return (
    <FormPanel
      title="Add user"
      description="Add a user by username and assign the role that controls their permissions."
      onClose={onDone}
      onSubmit={handleSubmit}
      busy={invite.isPending}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={onDone}
            disabled={invite.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={invite.isPending}>
            {invite.isPending ? (
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
        <Label htmlFor="invite-username">Username</Label>
        <Input
          id="invite-username"
          placeholder="jordan.rivera"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
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

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </FormPanel>
  );
}
