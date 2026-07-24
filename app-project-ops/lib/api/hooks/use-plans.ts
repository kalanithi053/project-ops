"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type {
  Plan,
  UpdateModuleDto,
  UpdatePlanDto,
  WorkspaceModule,
} from "@/lib/api/types";

/**
 * GET /plans?projectTypeId=… — plan tiers for one project type. The backend
 * requires projectTypeId, so the query stays disabled until one is chosen.
 */
export function usePlans(workspaceSlug: string, projectTypeId?: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["plans", workspaceSlug, projectTypeId],
    queryFn: () =>
      apiFetch<Plan[]>(
        `/plans?${new URLSearchParams({ projectTypeId: projectTypeId! })}`,
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && projectTypeId),
  });
}

/**
 * GET /modules?planId=… — modules provisioned under one plan. The backend
 * requires planId, so the query stays disabled until one is available.
 */
export function useModules(workspaceSlug: string, planId?: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["modules", workspaceSlug, planId],
    queryFn: () =>
      apiFetch<WorkspaceModule[]>(
        `/modules?${new URLSearchParams({ planId: planId! })}`,
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && planId),
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

/**
 * PATCH /plans/active — updates the currently-active plan's limits.
 * (There's no per-id plan update route; only the active plan is editable.)
 */
export function useUpdateActivePlan(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdatePlanDto) =>
      apiFetch<Plan>("/plans/active", {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ["plans", workspaceSlug] });
      toast.success("Plan updated", plan?.name);
    },
  });
}

/** PATCH /modules/{id} — update a module's task limit / active flag. */
export function useUpdateModule(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateModuleDto }) =>
      apiFetch<WorkspaceModule>(`/modules/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (module) => {
      queryClient.invalidateQueries({ queryKey: ["modules", workspaceSlug] });
      toast.success("Module updated", module?.name);
    },
  });
}
