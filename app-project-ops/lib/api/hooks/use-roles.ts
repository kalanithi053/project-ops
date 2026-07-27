"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { toast } from "@/lib/toast/toast-store";
import { workspaceSettingsKey } from "@/lib/api/hooks/use-settings";
import type { CreateRoleDto, Role, UpdateRoleDto } from "@/lib/api/types";

/**
 * Invalidates every cache a role write can affect: the settings bundle,
 * the standalone role list, the member list (role names are embedded), and
 * the caller's own permissions — editing your own role changes what the UI
 * should let you do.
 */
function useRoleInvalidation(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: workspaceSettingsKey(workspaceSlug) });
    queryClient.invalidateQueries({ queryKey: ["roles", workspaceSlug] });
    queryClient.invalidateQueries({ queryKey: ["members", workspaceSlug] });
    queryClient.invalidateQueries({ queryKey: ["my-permissions", workspaceSlug] });
  };
}

/**
 * POST /roles — requires `role.manage`.
 *
 * The response does not echo the granted permission codes back, which is
 * why every mutation here refetches rather than writing to the cache.
 */
export function useCreateRole(workspaceSlug: string) {
  const invalidate = useRoleInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (dto: CreateRoleDto) =>
      apiFetch<Role>("/roles", { method: "POST", body: dto, workspaceSlug }),
    onSuccess: (role) => {
      invalidate();
      toast.success("Role created", role?.name);
    },
  });
}

/**
 * PATCH /roles/:id — requires `role.manage`.
 *
 * `permissionCodes` is replace-all: whatever array you send becomes the
 * role's complete permission set, and `[]` revokes everything.
 */
export function useUpdateRole(workspaceSlug: string) {
  const invalidate = useRoleInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateRoleDto }) =>
      apiFetch<Role>(`/roles/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (role) => {
      invalidate();
      toast.success("Role updated", role?.name);
    },
  });
}

/**
 * DELETE /roles/:id — requires `role.manage`. The backend refuses to delete
 * system roles (403) or roles still assigned to members (409).
 */
export function useDeleteRole(workspaceSlug: string) {
  const invalidate = useRoleInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; deleted: boolean }>(`/roles/${id}`, {
        method: "DELETE",
        workspaceSlug,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Role deleted");
    },
  });
}
