"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type {
  UpdateWorkspaceSettingsDto,
  Workspace,
  WorkspaceSettings,
} from "@/lib/api/types";

/**
 * Query key for the settings bundle. Exported because every settings
 * mutation (statuses, priorities, roles, project types, plans, modules)
 * has to invalidate it — the bundle is the single read source for the
 * whole settings area, so a shared key beats repeating the literal in
 * seven hook files.
 */
export function workspaceSettingsKey(workspaceSlug: string) {
  return ["workspace-settings", workspaceSlug] as const;
}

/**
 * GET /workspace/settings — the entire settings bundle in one request:
 * workspace details, plans (with modules), ticket statuses, priorities,
 * project types, roles (with permission codes) and the permission catalog.
 *
 * Every settings section reads from this one cached query, so switching
 * sections costs no extra network calls. It's also the only role source a
 * non-admin can read: GET /roles requires `role.manage` and 403s otherwise.
 */
export function useWorkspaceSettings(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: workspaceSettingsKey(workspaceSlug),
    queryFn: () =>
      apiFetch<WorkspaceSettings>("/workspace/settings", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/**
 * PATCH /workspace/settings — rename the workspace or change its URL slug.
 * Requires `workspace.manage`.
 *
 * A slug change also changes the tenant header and the first URL segment, so
 * callers must redirect to the new slug. In that case the old key is left
 * untouched: invalidating it would make the still-mounted observer refetch
 * with a slug the server no longer knows, flashing a 404 before the redirect
 * lands. The stale entry is unreachable and gets garbage-collected.
 */
export function useUpdateWorkspace(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateWorkspaceSettingsDto) =>
      apiFetch<Workspace>("/workspace/settings", {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (workspace) => {
      if (workspace.slug === workspaceSlug) {
        queryClient.invalidateQueries({
          queryKey: workspaceSettingsKey(workspaceSlug),
        });
      }
      // The workspace switcher and any slug-keyed list need to see the rename.
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace updated", workspace?.name);
    },
  });
}

/**
 * Invalidates the settings bundle. Used by the resource-specific settings
 * hooks so a write to any sub-resource refreshes the shared read.
 */
export function useInvalidateSettings(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({
      queryKey: workspaceSettingsKey(workspaceSlug),
    });
}
