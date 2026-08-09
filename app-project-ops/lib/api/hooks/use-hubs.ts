"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import { workspaceSettingsKey } from "@/lib/api/hooks/use-settings";
import type { CreateHubDto, Hub, UpdateHubDto } from "@/lib/api/types";

/**
 * GET /hubs?projectTypeId=… — HubSpot Hubs (Marketing/Sales/Service/...) for
 * one project type. The backend requires projectTypeId, so the query stays
 * disabled until one is chosen — same shape as `usePlans`.
 */
export function useHubs(workspaceSlug: string, projectTypeId?: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["hubs", workspaceSlug, projectTypeId],
    queryFn: () =>
      apiFetch<Hub[]>(
        `/hubs?${new URLSearchParams({ projectTypeId: projectTypeId! })}`,
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && projectTypeId),
  });
}

/** Invalidates hub-shaped caches plus the settings bundle (plans embed hub). */
function useHubInvalidation(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["hubs", workspaceSlug] });
    queryClient.invalidateQueries({ queryKey: ["plans", workspaceSlug] });
    queryClient.invalidateQueries({
      queryKey: workspaceSettingsKey(workspaceSlug),
    });
  };
}

/**
 * POST /hubs — requires `hub.manage`. Creating a Hub also seeds its 3 tier
 * plans (Starter/Professional/Enterprise), each with no modules yet.
 */
export function useCreateHub(workspaceSlug: string) {
  const invalidate = useHubInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (dto: CreateHubDto) =>
      apiFetch<Hub>("/hubs", { method: "POST", body: dto, workspaceSlug }),
    onSuccess: (hub) => {
      invalidate();
      toast.success("Hub created", hub?.name);
    },
  });
}

/** PATCH /hubs/{hubId} — rename a Hub, recolor it, or toggle it active. */
export function useUpdateHub(workspaceSlug: string) {
  const invalidate = useHubInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateHubDto }) =>
      apiFetch<Hub>(`/hubs/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (hub) => {
      invalidate();
      toast.success("Hub updated", hub?.name);
    },
  });
}

/**
 * DELETE /hubs/{hubId} — requires `hub.manage`. The backend rejects with a
 * 409 if the hub (or one of its tiers) is still referenced by any project.
 */
export function useDeleteHub(workspaceSlug: string) {
  const invalidate = useHubInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; deleted: boolean }>(`/hubs/${id}`, {
        method: "DELETE",
        workspaceSlug,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Hub removed");
    },
  });
}
