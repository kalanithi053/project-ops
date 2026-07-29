"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type { CreateWorkspaceDto, Workspace } from "@/lib/api/types";

/** GET /workspaces/me — workspaces the current user belongs to. */
export function useMyWorkspaces() {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["workspaces", "me"],
    queryFn: () => apiFetch<Workspace[]>("/workspaces/me"),
    enabled: Boolean(token),
  });
}

/** POST /workspaces — create a workspace (returns the created record). */
export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateWorkspaceDto) =>
      apiFetch<Workspace>("/workspaces", { method: "POST", body: dto }),
    onSuccess: (workspace) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace created", workspace?.name);
    },
  });
}

/** PATCH /workspace-members/:workspaceId/default — set the user's default workspace. */
export function useSetDefaultWorkspace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (workspaceId: string) =>
      apiFetch(`/workspace-members/${workspaceId}/default`, { method: "PATCH" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces", "me"] });
    },
  });
}
