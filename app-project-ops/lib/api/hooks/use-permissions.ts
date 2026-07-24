"use client";

import { useMemo } from "react";

import { useMe } from "@/lib/api/hooks/use-users";
import { useRoles, useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import type { PermissionCode } from "@/lib/api/permissions";
import type { Role, WorkspaceMember } from "@/lib/api/types";

function memberUsername(member: WorkspaceMember): string | undefined {
  return member.user?.username ?? member.username;
}

function memberRole(member: WorkspaceMember): { id?: string; name?: string } {
  if (member.role && typeof member.role === "object") {
    return { id: member.role.id, name: member.role.name };
  }
  if (typeof member.role === "string") return { name: member.role };
  return {};
}

export interface WorkspacePermissions {
  /** True once we've actually resolved the current user's role permissions. */
  isResolved: boolean;
  roleName?: string;
  permissions: Set<string>;
  /**
   * Whether the current user holds a permission. Fails OPEN while
   * unresolved (returns true) so UI isn't hidden before we know the role —
   * the backend still enforces every action.
   */
  can: (permission: PermissionCode) => boolean;
}

/**
 * Resolve the signed-in user's effective permissions for a workspace by
 * matching their membership to a role and reading that role's permission
 * codes (GET /workspace-members + GET /roles).
 */
export function usePermissions(workspaceSlug: string): WorkspacePermissions {
  const { data: me } = useMe();
  const { data: members } = useWorkspaceMembers(workspaceSlug);
  const { data: roles } = useRoles(workspaceSlug);

  return useMemo(() => {
    const myUsername = me?.username;
    const member = (members ?? []).find(
      (m) => memberUsername(m) === myUsername,
    );
    const roleRef = member ? memberRole(member) : undefined;

    let role: Role | undefined;
    if (roleRef && roles) {
      role =
        (roleRef.id && roles.find((r) => r.id === roleRef.id)) ||
        (roleRef.name && roles.find((r) => r.name === roleRef.name)) ||
        undefined;
    }

    const permissions = new Set(role?.permissions ?? []);
    const isResolved = Boolean(myUsername && member && role);

    return {
      isResolved,
      roleName: roleRef?.name ?? role?.name,
      permissions,
      can: (permission: PermissionCode) =>
        !isResolved || permissions.has(permission),
    };
  }, [me, members, roles]);
}
