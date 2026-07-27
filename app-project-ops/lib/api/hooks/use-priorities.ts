"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import { workspaceSettingsKey } from "@/lib/api/hooks/use-settings";
import type {
  CreatePriorityDto,
  Priority,
  UpdatePriorityDto,
} from "@/lib/api/types";

/**
 * GET /priorities — the workspace priority scale.
 *
 * The settings screen reads priorities from the settings bundle instead;
 * this standalone list is for task views that don't load the bundle.
 */
export function usePriorities(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["priorities", workspaceSlug],
    queryFn: () => apiFetch<Priority[]>("/priorities", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/** Invalidates both the standalone list and the settings bundle. */
function usePriorityInvalidation(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["priorities", workspaceSlug] });
    queryClient.invalidateQueries({ queryKey: workspaceSettingsKey(workspaceSlug) });
  };
}

/** POST /priorities — requires `priority.manage`. */
export function useCreatePriority(workspaceSlug: string) {
  const invalidate = usePriorityInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (dto: CreatePriorityDto) =>
      apiFetch<Priority>("/priorities", {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (priority) => {
      invalidate();
      toast.success("Priority created", priority?.name);
    },
  });
}

/** PATCH /priorities/:id — requires `priority.manage`. */
export function useUpdatePriority(workspaceSlug: string) {
  const invalidate = usePriorityInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdatePriorityDto }) =>
      apiFetch<Priority>(`/priorities/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (priority) => {
      invalidate();
      toast.success("Priority updated", priority?.name);
    },
  });
}

/**
 * DELETE /priorities/:id — requires `priority.manage`. The backend rejects
 * with a 409 if any task still references the priority.
 */
export function useDeletePriority(workspaceSlug: string) {
  const invalidate = usePriorityInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; deleted: boolean }>(`/priorities/${id}`, {
        method: "DELETE",
        workspaceSlug,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Priority deleted");
    },
  });
}
