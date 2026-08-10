"use client";

import * as React from "react";
import { Loader2, ShieldCheck } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FormPanel } from "@/components/shared/form-panel";
import { SettingsField } from "@/components/settings/settings-section";
import { useCreateRole, useUpdateRole } from "@/lib/api/hooks/use-roles";
import type { Permission, Role } from "@/lib/api/types";

/**
 * Display names for permission groups, keyed by the segment before the dot
 * in a permission code. Anything unmapped falls back to a title-cased key,
 * so a new backend permission group still renders sensibly.
 */
const GROUP_LABELS: Record<string, string> = {
  project: "Projects",
  task: "Tasks",
  member: "Members",
  role: "Roles",
  module: "Modules",
  ticketstatus: "Ticket Statuses",
  priority: "Priorities",
  projecttype: "Project Types",
  plan: "Plans",
  permission: "Permissions",
  workspace: "Workspace",
};

/** Order groups by importance, then alphabetically for anything unlisted. */
const GROUP_ORDER = [
  "workspace",
  "project",
  "task",
  "member",
  "role",
  "permission",
  "projecttype",
  "plan",
  "module",
  "ticketstatus",
  "priority",
];

interface PermissionGroup {
  key: string;
  label: string;
  permissions: Permission[];
}

function groupPermissions(permissions: Permission[]): PermissionGroup[] {
  const groups = new Map<string, Permission[]>();

  for (const permission of permissions) {
    const key = permission.code.split(".")[0];
    const bucket = groups.get(key);
    if (bucket) bucket.push(permission);
    else groups.set(key, [permission]);
  }

  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      label: GROUP_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1),
      permissions: items,
    }))
    .sort((a, b) => {
      const aIndex = GROUP_ORDER.indexOf(a.key);
      const bIndex = GROUP_ORDER.indexOf(b.key);
      if (aIndex === -1 && bIndex === -1) return a.label.localeCompare(b.label);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
}

interface RolePanelProps {
  workspaceSlug: string;
  /** null creates a new role. */
  role: Role | null;
  catalog: Permission[];
  /** True when this is the signed-in user's own role. */
  isOwnRole: boolean;
  onClose: () => void;
}

/**
 * Create/edit form for a role and its permission matrix.
 *
 * System roles are read-only here: the backend lets you PATCH them, but
 * stripping a permission off the Owner role is an unrecoverable lockout from
 * the UI, so the editor refuses rather than offering the footgun.
 */
export function RolePanel({
  workspaceSlug,
  role,
  catalog,
  isOwnRole,
  onClose,
}: RolePanelProps) {
  const create = useCreateRole(workspaceSlug);
  const update = useUpdateRole(workspaceSlug);
  const isEdit = Boolean(role);
  const readOnly = Boolean(role?.isSystem);
  const pending = create.isPending || update.isPending;

  const groups = React.useMemo(() => groupPermissions(catalog), [catalog]);

  const [name, setName] = React.useState(role?.name ?? "");
  const [isDefault, setIsDefault] = React.useState(role?.isDefault ?? false);
  const [isManagerTier, setIsManagerTier] = React.useState(
    role?.isManagerTier ?? false,
  );
  const [selected, setSelected] = React.useState<Set<string>>(
    () => new Set(role?.permissions ?? []),
  );
  const [error, setError] = React.useState<string | null>(null);

  function toggle(code: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function toggleGroup(group: PermissionGroup, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      for (const permission of group.permissions) {
        if (checked) next.add(permission.code);
        else next.delete(permission.code);
      }
      return next;
    });
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (readOnly) return;

    const trimmed = name.trim();
    if (trimmed.length < 2) {
      return setError("Role name must be at least 2 characters.");
    }

    const dto = {
      name: trimmed,
      isDefault,
      isManagerTier,
      permissionCodes: [...selected],
    };

    if (role) {
      update.mutate({ id: role.id, dto }, { onSuccess: onClose });
    } else {
      create.mutate(dto, { onSuccess: onClose });
    }
  }

  return (
    <FormPanel
      title={isEdit ? `Edit ${role?.name}` : "Add role"}
      description={
        readOnly
          ? "This is a built-in role. Its permissions are shown for reference and can't be changed."
          : "Choose exactly what members with this role can do. Permissions apply across the whole workspace."
      }
      onClose={onClose}
      onSubmit={handleSubmit}
      busy={pending}
      size="lg"
      footer={
        <>
          <Button type="button" variant="ghost" onClick={onClose} disabled={pending}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button type="submit" disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Create role
                </>
              )}
            </Button>
          )}
        </>
      }
    >
      <fieldset disabled={readOnly} className="flex flex-col gap-4">
        <SettingsField label="Role name" htmlFor="role-name">
          <Input
            id="role-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Manager"
            maxLength={50}
            autoFocus={!readOnly}
          />
        </SettingsField>

        <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Default role</span>
            <span className="text-xs text-muted-foreground">
              Assigned to new members when no role is chosen.
            </span>
          </div>
          <Switch
            checked={isDefault}
            onCheckedChange={setIsDefault}
            aria-label="Default role"
          />
        </div>

        <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">Manager-tier role</span>
            <span className="text-xs text-muted-foreground">
              Members with this role see workspace-wide dashboard data (every
              assignee&apos;s attention/priority items and project
              utilization), not just their own.
            </span>
          </div>
          <Switch
            checked={isManagerTier}
            onCheckedChange={setIsManagerTier}
            aria-label="Manager-tier role"
          />
        </div>
      </fieldset>

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Permissions</span>
        <Badge variant="secondary">
          {selected.size} of {catalog.length} selected
        </Badge>
      </div>

      <div className="rounded-md border border-border">
        {groups.map((group, index) => {
          const groupCodes = group.permissions.map((p) => p.code);
          const allChecked = groupCodes.every((code) => selected.has(code));
          const someChecked =
            !allChecked && groupCodes.some((code) => selected.has(code));

          return (
            <div key={group.key} className={cn(index > 0 && "border-t border-border")}>
              <div className="flex items-center gap-2 bg-muted/40 px-3 py-2">
                <Checkbox
                  id={`group-${group.key}`}
                  checked={allChecked}
                  ref={(node) => {
                    if (node) node.indeterminate = someChecked;
                  }}
                  onChange={(event) => toggleGroup(group, event.target.checked)}
                  disabled={readOnly}
                />
                <label
                  htmlFor={`group-${group.key}`}
                  className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                >
                  {group.label}
                </label>
              </div>

              <div className="flex flex-col">
                {group.permissions.map((permission) => (
                  <label
                    key={permission.id}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-3 py-2 transition-colors hover:bg-accent/40",
                      readOnly && "cursor-default hover:bg-transparent",
                    )}
                  >
                    <span className="pt-0.5">
                      <Checkbox
                        checked={selected.has(permission.code)}
                        onChange={() => toggle(permission.code)}
                        disabled={readOnly}
                        aria-label={permission.code}
                      />
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="text-sm">
                        {permission.description ?? permission.code}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {permission.code}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {isOwnRole && !readOnly && (
        <p className="rounded-md border border-status-warning-bg bg-status-warning-bg px-3 py-2 text-xs text-status-warning">
          This is your own role. Removing a permission here takes it away from
          you immediately.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </FormPanel>
  );
}
