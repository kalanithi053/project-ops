"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { ApiError, apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type {
  AddWorkspaceMemberDto,
  InviteMemberDto,
  ProjectMember,
  Role,
  WorkspaceMember,
} from "@/lib/api/types";

/** GET /workspace-members — members of the given workspace. */
export function useWorkspaceMembers(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["members", workspaceSlug],
    queryFn: () =>
      apiFetch<WorkspaceMember[]>("/workspace-members", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/** GET /roles — workspace roles (used to populate the invite form). */
export function useRoles(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["roles", workspaceSlug],
    queryFn: () => apiFetch<Role[]>("/roles", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/** POST /workspace-members — invite a user to the workspace. */
export function useInviteMember(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: InviteMemberDto) =>
      apiFetch<WorkspaceMember>("/workspace-members", {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["members", workspaceSlug] });
      toast.success("User added");
    },
  });
}

/**
 * POST /workspace-members, then POST /projects/:projectId/members for each
 * chosen project (each with its own role) — one user action from the
 * workspace Users page instead of inviting to the workspace and then to
 * each project separately.
 *
 * A project the user already belongs to is skipped rather than failing the
 * whole request: the workspace invite (and every other selected project)
 * still goes through, and the skipped ones are called out in the toast.
 */
export function useAddWorkspaceMember(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectMemberships = [],
      ...dto
    }: AddWorkspaceMemberDto) => {
      const member = await apiFetch<WorkspaceMember>("/workspace-members", {
        method: "POST",
        body: dto,
        workspaceSlug,
        notify: false,
      });

      let added = 0;
      let skipped = 0;
      for (const { projectId, roleId } of projectMemberships) {
        try {
          await apiFetch<ProjectMember>(`/projects/${projectId}/members`, {
            method: "POST",
            body: { email: dto.email, roleId },
            workspaceSlug,
            notify: false,
          });
          added += 1;
        } catch (err) {
          if (err instanceof ApiError && err.statusCode === 409) {
            skipped += 1;
            continue;
          }
          throw err;
        }
      }

      return { member, added, skipped, requested: projectMemberships.length };
    },
    onSuccess: ({ added, skipped, requested }) => {
      queryClient.invalidateQueries({ queryKey: ["members", workspaceSlug] });

      let message = "User added to the workspace";
      if (requested > 0) {
        message += ` and ${added} project${added === 1 ? "" : "s"}`;
        if (skipped > 0) {
          message += ` (already had access to ${skipped})`;
        }
      }
      toast.success(message);
    },
  });
}
