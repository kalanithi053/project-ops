"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type { InviteMemberDto, Role, WorkspaceMember } from "@/lib/api/types";

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
      toast.success("Invitation sent");
    },
  });
}
