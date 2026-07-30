"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import type {
  MyWorkspaceMembership,
  UpdateMyThemeDto,
} from "@/lib/api/types";

function myMembershipKey(workspaceSlug: string) {
  return ["my-membership", workspaceSlug] as const;
}

/**
 * GET /workspace-members/me — the caller's own membership row for this
 * workspace (role, status, and their theme preference). Ungated by
 * permission — any active member can read their own row.
 */
export function useMyMembership(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: myMembershipKey(workspaceSlug),
    queryFn: () =>
      apiFetch<MyWorkspaceMembership>("/workspace-members/me", {
        workspaceSlug,
      }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/**
 * PATCH /workspace-members/me/theme — set the caller's own display-theme
 * preference for this workspace. Self-service, unrestricted by role.
 */
export function useUpdateMyTheme(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateMyThemeDto) =>
      apiFetch<MyWorkspaceMembership>("/workspace-members/me/theme", {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(myMembershipKey(workspaceSlug), updated);
    },
  });
}
