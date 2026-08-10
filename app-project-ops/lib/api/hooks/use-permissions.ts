"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import type { PermissionCode } from "@/lib/api/permissions";
import type { MyPermissions } from "@/lib/api/types";

export interface WorkspacePermissions {
  /** True once we've actually resolved the current user's role permissions. */
  isResolved: boolean;
  roleName?: string;
  /** Workspace-wide dashboard visibility instead of just-your-own-items — see the role's isManagerTier flag. */
  isManagerTier: boolean;
  permissions: Set<string>;
  /**
   * Whether the current user holds a permission. Fails OPEN while
   * unresolved (returns true) so UI isn't hidden before we know the role —
   * the backend still enforces every action.
   */
  can: (permission: PermissionCode) => boolean;
}

/**
 * GET /workspace/permission — the caller's own role and effective
 * permission codes for a workspace.
 *
 * This endpoint resolves the answer server-side in a single request. The
 * previous approach cross-referenced GET /workspace-members with
 * GET /roles, but GET /roles itself requires `role.manage`, so it 403'd
 * for exactly the non-admin users whose permissions it was trying to
 * determine — leaving `can()` permanently failing open for them.
 */
export function useMyPermissions(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["my-permissions", workspaceSlug],
    queryFn: () =>
      apiFetch<MyPermissions>("/workspace/permission", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
    // A role change mid-session is rare and the backend is the real gate.
    staleTime: 5 * 60_000,
  });
}

/** Resolve the signed-in user's effective permissions for a workspace. */
export function usePermissions(workspaceSlug: string): WorkspacePermissions {
  const { data } = useMyPermissions(workspaceSlug);

  return useMemo(() => {
    const permissions = new Set(data?.permissions ?? []);
    const isResolved = Boolean(data);

    return {
      isResolved,
      roleName: data?.role?.name,
      isManagerTier: data?.role?.isManagerTier ?? false,
      permissions,
      can: (permission: PermissionCode) =>
        !isResolved || permissions.has(permission),
    };
  }, [data]);
}
