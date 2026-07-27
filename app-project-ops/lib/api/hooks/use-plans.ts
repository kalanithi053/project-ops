"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import { workspaceSettingsKey } from "@/lib/api/hooks/use-settings";
import type {
  CreateModuleDto,
  CreatePlanDto,
  Plan,
  UpdateModuleDto,
  UpdatePlanDetailsDto,
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

/** Invalidates plan-shaped caches plus the settings bundle. */
function usePlanInvalidation(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["plans", workspaceSlug] });
    queryClient.invalidateQueries({ queryKey: ["project-types", workspaceSlug] });
    queryClient.invalidateQueries({ queryKey: workspaceSettingsKey(workspaceSlug) });
  };
}

/**
 * POST /plans — requires `plan.manage`. Creating a plan also seeds the nine
 * default modules under it.
 */
export function useCreatePlan(workspaceSlug: string) {
  const invalidate = usePlanInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (dto: CreatePlanDto) =>
      apiFetch<Plan>("/plans", { method: "POST", body: dto, workspaceSlug }),
    onSuccess: (plan) => {
      invalidate();
      toast.success("Plan created", plan?.name);
    },
  });
}

/**
 * PATCH /plans/{planId} — rename a plan or change its feature flags.
 *
 * Distinct from `useUpdateActivePlan`, which can only touch whichever plan is
 * currently active; this works on any plan.
 */
export function useUpdatePlan(workspaceSlug: string) {
  const invalidate = usePlanInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePlanDetailsDto }) =>
      apiFetch<Plan>(`/plans/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (plan) => {
      invalidate();
      toast.success("Plan updated", plan?.name);
    },
  });
}

/** POST /plans/{planId}/activate — make the given plan the active one. */
export function useActivatePlan(workspaceSlug: string) {
  const invalidate = usePlanInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (planId: string) =>
      apiFetch<Plan>(`/plans/${planId}/activate`, {
        method: "POST",
        workspaceSlug,
      }),
    onSuccess: (plan) => {
      invalidate();
      toast.success("Plan activated", plan?.name);
    },
  });
}

/**
 * PATCH /plans/active — renames the currently-active plan or toggles it off.
 *
 * There is no per-id plan update route; only whichever plan is active can be
 * edited. The backend DTO is hand-written rather than a PartialType, so both
 * `name` and `isActive` must be sent on every call.
 */
export function useUpdateActivePlan(workspaceSlug: string) {
  const invalidate = usePlanInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (dto: UpdatePlanDto) =>
      apiFetch<Plan>("/plans/active", {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (plan) => {
      invalidate();
      toast.success("Plan updated", plan?.name);
    },
  });
}

/** Invalidates module caches plus the settings bundle (plans embed modules). */
function useModuleInvalidation(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["modules", workspaceSlug] });
    queryClient.invalidateQueries({ queryKey: workspaceSettingsKey(workspaceSlug) });
  };
}

/** POST /modules — requires `module.manage`. Adds a module to a plan. */
export function useCreateModule(workspaceSlug: string) {
  const invalidate = useModuleInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (dto: CreateModuleDto) =>
      apiFetch<WorkspaceModule>("/modules", {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (module) => {
      invalidate();
      toast.success("Module added", module?.name);
    },
  });
}

/** PATCH /modules/{id} — update a module's task limit / active flag. */
export function useUpdateModule(workspaceSlug: string) {
  const invalidate = useModuleInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateModuleDto }) =>
      apiFetch<WorkspaceModule>(`/modules/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (module) => {
      invalidate();
      toast.success("Module updated", module?.name);
    },
  });
}

/**
 * PATCH /modules/{id} for several modules at once — requires `module.manage`.
 *
 * The plan editor collects edits across a whole table and commits them on
 * Apply, so this issues the writes together and reports once rather than
 * firing a toast per row. There's no bulk endpoint, so a partial failure is
 * possible; the error surfaces and the refetch reconciles what landed.
 */
export function useUpdateModules(workspaceSlug: string) {
  const invalidate = useModuleInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (
      updates: Array<{ id: string; dto: UpdateModuleDto }>,
    ): Promise<WorkspaceModule[]> =>
      Promise.all(
        updates.map(({ id, dto }) =>
          apiFetch<WorkspaceModule>(`/modules/${id}`, {
            method: "PATCH",
            body: dto,
            workspaceSlug,
          }),
        ),
      ),
    onSuccess: (modules) => {
      invalidate();
      toast.success(
        "Modules updated",
        `${modules.length} module${modules.length === 1 ? "" : "s"} saved`,
      );
    },
    onError: () => invalidate(),
  });
}

/**
 * DELETE /modules/{id} — requires `module.manage`. The backend rejects with
 * a 409 if the module is still attached to any project.
 */
export function useDeleteModule(workspaceSlug: string) {
  const invalidate = useModuleInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; deleted: boolean }>(`/modules/${id}`, {
        method: "DELETE",
        workspaceSlug,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Module removed");
    },
  });
}
