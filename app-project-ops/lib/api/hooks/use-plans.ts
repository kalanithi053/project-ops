"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type { Plan, WorkspaceModule } from "@/lib/api/types";

/** GET /plans — all plan tiers provisioned for the workspace. */
export function usePlans(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["plans", workspaceSlug],
    queryFn: () => apiFetch<Plan[]>("/plans", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/** GET /modules — workspace modules (each belongs to a plan via planId). */
export function useModules(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["modules", workspaceSlug],
    queryFn: () => apiFetch<WorkspaceModule[]>("/modules", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/** POST /plans/{planId}/activate — make the given plan the active one. */
export function useActivatePlan(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) =>
      apiFetch<Plan>(`/plans/${planId}/activate`, {
        method: "POST",
        workspaceSlug,
      }),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ["plans", workspaceSlug] });
      toast.success("Plan activated", plan?.name);
    },
  });
}
