"use client";

import { Loader2, UserPlus, Users } from "lucide-react";
import { useParams } from "next/navigation";
import * as React from "react";

import { isValidEmail } from "@/app/(auth)/login/page";
import { SettingsField } from "@/components/settings/settings-section";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { FormPanel } from "@/components/shared/form-panel";
import { QueryState } from "@/components/shared/query-state";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { TableSkeleton } from "@/components/shared/skeletons";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useInviteProjectMember,
  useProjectMembers,
  useProjectPermissions,
  useRemoveProjectMember,
  useUpdateProjectMember,
} from "@/lib/api/hooks/use-project-members";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import { PERMISSIONS } from "@/lib/api/permissions";
import type {
  MembershipStatus,
  ProjectMember,
  UpdateMeDto,
} from "@/lib/api/types";
import { formatDate } from "@/lib/format";
import { getFullname } from "@/lib/utils";

const STATUS_TONE: Record<MembershipStatus, BadgeProps["variant"]> = {
  invited: "warning",
  active: "success",
  removed: "neutral",
};

export default function ProjectUsersPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();

  const membersQuery = useProjectMembers(workspace, projectId);
  const { data: settings } = useWorkspaceSettings(workspace);
  const updateMember = useUpdateProjectMember(workspace, projectId);
  const removeMember = useRemoveProjectMember(workspace, projectId);
  const { can } = useProjectPermissions(workspace, projectId);

  const canInvite = can(PERMISSIONS.MEMBER_INVITE);
  const canRemove = can(PERMISSIONS.MEMBER_REMOVE);

  const [adding, setAdding] = React.useState(false);
  const [removing, setRemoving] = React.useState<ProjectMember | null>(null);

  // The server returns removed members too; project access is what this page
  // is about, so they're filtered out rather than shown as tombstones.
  const members = (membersQuery.data ?? []).filter(
    (member) => member.status !== "removed",
  );

  const roleOptions: SelectOption[] = (settings?.roles ?? []).map((role) => ({
    label: role.name,
    value: role.id,
  }));

  const addButton = canInvite ? (
    <Button size="sm" onClick={() => setAdding(true)}>
      <UserPlus className="h-4 w-4" />
      Add member
    </Button>
  ) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-[6rem] z-20 -mx-4 flex flex-col gap-3 border-b border-border bg-background px-4 py-4 sm:-mx-6 sm:flex-row sm:items-start sm:justify-between sm:px-6 lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold tracking-tight">Users</h2>
          <p className="text-sm text-muted-foreground">
            Control who can work on this project. Project roles are separate
            from workspace roles.
          </p>
        </div>
        {addButton}
      </div>

      <QueryState
        isLoading={membersQuery.isLoading}
        isError={membersQuery.isError}
        error={membersQuery.error}
        onRetry={() => membersQuery.refetch()}
        skeleton={<TableSkeleton columns={4} rows={3} />}
      >
        {members.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No members yet"
            description="Add people to give them access to this project's board and tasks."
            action={addButton}
          />
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="w-56">Project role</TableHead>
                    <TableHead className="w-28">Status</TableHead>
                    <TableHead className="w-32">Joined</TableHead>
                    {canRemove && (
                      <TableHead className="w-24 text-right">Actions</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    const busy =
                      updateMember.isPending &&
                      updateMember.variables?.id === member.id;
                    const name =
                      getFullname(member.user as UpdateMeDto) ?? "Unknown";
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium first-letter:capitalize">
                          {name}
                        </TableCell>

                        <TableCell>
                          {canInvite ? (
                            <div className="flex items-center gap-2">
                              <SelectField
                                aria-label={`Role for ${name}`}
                                options={roleOptions}
                                value={member.roleId}
                                onValueChange={(roleId) =>
                                  updateMember.mutate({
                                    id: member.id,
                                    dto: { roleId },
                                  })
                                }
                                placeholder="Select a role"
                                disabled={busy}
                                className="h-8"
                              />
                              {busy && (
                                <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />
                              )}
                            </div>
                          ) : (
                            (member.role?.name ?? "—")
                          )}
                        </TableCell>

                        <TableCell>
                          <Badge variant={STATUS_TONE[member.status]}>
                            {member.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-muted-foreground">
                          {formatDate(member.joinedAt)}
                        </TableCell>

                        {canRemove && (
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() => setRemoving(member)}
                            >
                              Remove
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </Card>
        )}
      </QueryState>

      {adding && (
        <AddProjectMemberPanel
          workspaceSlug={workspace}
          projectId={projectId}
          roleOptions={roleOptions}
          onClose={() => setAdding(false)}
        />
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${getFullname(removing?.user as UpdateMeDto) ?? "this member"}?`}
        description="They lose access to this project's board and tasks. Their workspace membership is unaffected."
        confirmLabel="Remove from project"
        destructive
        pending={removeMember.isPending}
        onConfirm={() =>
          removing &&
          removeMember.mutate(removing.id, {
            onSuccess: () => setRemoving(null),
          })
        }
      />
    </div>
  );
}

/**
 * Adds an existing workspace user to this project.
 *
 * A role is required here — unlike workspace invites, this route has no
 * default-role fallback and rejects the request without one.
 */
function AddProjectMemberPanel({
  workspaceSlug,
  projectId,
  roleOptions,
  onClose,
}: {
  workspaceSlug: string;
  projectId: string;
  roleOptions: SelectOption[];
  onClose: () => void;
}) {
  const invite = useInviteProjectMember(workspaceSlug, projectId);

  const [username, setUsername] = React.useState("");
  const [roleId, setRoleId] = React.useState<string>();
  const [error, setError] = React.useState<string | null>(null);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = username.trim();
    if (!trimmed) return setError("Enter the user's email.");
    if (!isValidEmail(trimmed)) return setError("Enter valid email.");
    if (!roleId) return setError("Choose a role for this project.");

    invite.mutate({ email: trimmed, roleId }, { onSuccess: onClose });
  }

  return (
    <FormPanel
      title="Add member"
      description="Give an existing workspace user access to this project."
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={invite.isPending}
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
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
              <>
                <UserPlus className="h-4 w-4" />
                Add member
              </>
            )}
          </Button>
        </>
      }
    >
      <SettingsField label="Email" htmlFor="project-member-username">
        <Input
          id="project-member-username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          autoFocus
        />
      </SettingsField>

      <SettingsField
        label="Project role"
        htmlFor="project-member-role"
        hint="Applies to this project only — it doesn't change their workspace role."
      >
        <SelectField
          id="project-member-role"
          aria-label="Project role"
          options={roleOptions}
          value={roleId}
          onValueChange={setRoleId}
          placeholder="Select a role"
        />
      </SettingsField>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </FormPanel>
  );
}
