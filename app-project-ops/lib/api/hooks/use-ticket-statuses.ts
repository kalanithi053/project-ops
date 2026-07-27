"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import { workspaceSettingsKey } from "@/lib/api/hooks/use-settings";
import type {
  CreateTicketStatusDto,
  TicketStatus,
  UpdateTicketStatusDto,
} from "@/lib/api/types";

/**
 * GET /ticket-statuses — the workflow states tasks can be in.
 *
 * The settings screen reads statuses from the settings bundle instead;
 * this standalone list is for task/board views that don't load the bundle.
 */
export function useTicketStatuses(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["ticket-statuses", workspaceSlug],
    queryFn: () =>
      apiFetch<TicketStatus[]>("/ticket-statuses", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/** Invalidates both the standalone list and the settings bundle. */
function useStatusInvalidation(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: ["ticket-statuses", workspaceSlug],
    });
    queryClient.invalidateQueries({ queryKey: workspaceSettingsKey(workspaceSlug) });
  };
}

/** POST /ticket-statuses — requires `ticketstatus.manage`. */
export function useCreateTicketStatus(workspaceSlug: string) {
  const invalidate = useStatusInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (dto: CreateTicketStatusDto) =>
      apiFetch<TicketStatus>("/ticket-statuses", {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (status) => {
      invalidate();
      toast.success("Status created", status?.name);
    },
  });
}

/** PATCH /ticket-statuses/:id — requires `ticketstatus.manage`. */
export function useUpdateTicketStatus(workspaceSlug: string) {
  const invalidate = useStatusInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTicketStatusDto }) =>
      apiFetch<TicketStatus>(`/ticket-statuses/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (status) => {
      invalidate();
      toast.success("Status updated", status?.name);
    },
  });
}

/**
 * DELETE /ticket-statuses/:id — requires `ticketstatus.manage`. The backend
 * rejects with a 409 if any task still references the status.
 */
export function useDeleteTicketStatus(workspaceSlug: string) {
  const invalidate = useStatusInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; deleted: boolean }>(`/ticket-statuses/${id}`, {
        method: "DELETE",
        workspaceSlug,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Status deleted");
    },
  });
}
