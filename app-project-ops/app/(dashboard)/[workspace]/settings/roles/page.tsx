"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Lock, Plus, ShieldCheck, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton } from "@/components/shared/skeletons";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SettingsSection } from "@/components/settings/settings-section";
import { RolePanel } from "@/components/settings/role-panel";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import { useDeleteRole } from "@/lib/api/hooks/use-roles";
import { useMyPermissions, usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";
import type { Role } from "@/lib/api/types";

export default function RolesPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const settings = useWorkspaceSettings(workspace);
  const { data: mine } = useMyPermissions(workspace);
  const remove = useDeleteRole(workspace);
  const { can } = usePermissions(workspace);

  const canManage = can(PERMISSIONS.ROLE_MANAGE);
  const roles = settings.data?.roles ?? [];
  const catalog = settings.data?.permissions ?? [];

  const [editing, setEditing] = React.useState<Role | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Role | null>(null);

  const addButton = canManage ? (
    <Button size="sm" onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4" />
      Add New Role
    </Button>
  ) : null;

  return (
    <SettingsSection
      title="Role"
      description="Define access levels and permissions for members."
      action={addButton}
    >
      <QueryState
        isLoading={settings.isLoading}
        isError={settings.isError}
        error={settings.error}
        onRetry={() => settings.refetch()}
        skeleton={<CardsSkeleton count={3} />}
      >
        <div className="flex flex-col gap-3">
          {roles.map((role) => (
            <RoleCard
              key={role.id}
              role={role}
              totalPermissions={catalog.length}
              isOwnRole={mine?.role?.id === role.id}
              canManage={canManage}
              onEdit={() => setEditing(role)}
              onDelete={() => setDeleting(role)}
            />
          ))}
        </div>
      </QueryState>

      {(creating || editing) && (
        <RolePanel
          workspaceSlug={workspace}
          role={editing}
          catalog={catalog}
          isOwnRole={Boolean(editing && mine?.role?.id === editing.id)}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete the "${deleting?.name}" role?`}
        description="Members still assigned to this role must be moved to another one first — the server will refuse the delete otherwise."
        confirmLabel="Delete role"
        destructive
        pending={remove.isPending}
        onConfirm={() =>
          deleting &&
          remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
        }
      />
    </SettingsSection>
  );
}

/**
 * One role, summarised by how much of the permission catalog it grants.
 *
 * The API has no description field for roles, so the permission count is the
 * honest summary — it's also the number that actually matters when choosing
 * a role for someone.
 */
function RoleCard({
  role,
  totalPermissions,
  isOwnRole,
  canManage,
  onEdit,
  onDelete,
}: {
  role: Role;
  totalPermissions: number;
  isOwnRole: boolean;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const granted = role.permissions?.length ?? 0;
  const isFullAccess = totalPermissions > 0 && granted === totalPermissions;

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
          {role.isSystem ? (
            <Lock className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          )}
        </span>

        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{role.name}</span>
            {role.isSystem && <Badge variant="outline">System</Badge>}
            {role.isDefault && <Badge variant="secondary">Default</Badge>}
            {isOwnRole && <Badge variant="info">You</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">
            {isFullAccess
              ? "Full access to all settings and projects"
              : `${granted} of ${totalPermissions} permissions`}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:justify-end">
        <Button variant="link" size="sm" onClick={onEdit} className="px-2">
          {canManage && !role.isSystem ? "Edit Permissions" : "View Permissions"}
        </Button>
        {canManage && !role.isSystem && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive"
            aria-label={`Delete ${role.name}`}
            onClick={onDelete}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </Card>
  );
}
