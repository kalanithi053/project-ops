"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type {
  CreateIncidentDto,
  Incident,
  IncidentActivityEntry,
  UpdateIncidentDto,
} from "@/lib/api/types";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";

export function incidentsKey(workspaceSlug: string, projectId: string) {
  return ["incidents", workspaceSlug, projectId] as const;
}

export function useIncidents(
  workspaceSlug: string,
  projectId: string,
  assigneeIds: string[] = [],
) {
  const token = useAuthStore((state) => state.accessToken);
  const params = new URLSearchParams();
  for (const id of assigneeIds) params.append("assigneeIds", id);
  const queryString = params.toString();
  return useQuery({
    queryKey: [...incidentsKey(workspaceSlug, projectId), queryString],
    queryFn: () =>
      apiFetch<Incident[]>(
        `/projects/${projectId}/incidents${queryString ? `?${queryString}` : ""}`,
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && projectId),
  });
}

export function useCreateIncident(workspaceSlug: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateIncidentDto) =>
      apiFetch<Incident>(`/projects/${projectId}/incidents`, {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (incident) => {
      queryClient.invalidateQueries({ queryKey: incidentsKey(workspaceSlug, projectId) });
      toast.success("Incident created", incident.title);
    },
  });
}

export function useIncident(
  workspaceSlug: string,
  projectId: string,
  incidentId: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["incident", workspaceSlug, projectId, incidentId],
    queryFn: () =>
      apiFetch<Incident>(`/projects/${projectId}/incidents/${incidentId}`, {
        workspaceSlug,
      }),
    enabled: Boolean(token && workspaceSlug && projectId && incidentId),
  });
}

export function incidentActivityKey(
  workspaceSlug: string,
  projectId: string,
  incidentId: string,
) {
  return ["incident-activity", workspaceSlug, projectId, incidentId] as const;
}

/** GET /projects/:projectId/incidents/:incidentId/activity — oldest first. */
export function useIncidentActivity(
  workspaceSlug: string,
  projectId: string,
  incidentId?: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: incidentActivityKey(workspaceSlug, projectId, incidentId ?? ""),
    queryFn: () =>
      apiFetch<IncidentActivityEntry[]>(
        `/projects/${projectId}/incidents/${incidentId}/activity`,
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && projectId && incidentId),
  });
}

export function useUpdateIncident(workspaceSlug: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateIncidentDto }) =>
      apiFetch<Incident>(`/projects/${projectId}/incidents/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (incident) => {
      queryClient.invalidateQueries({ queryKey: incidentsKey(workspaceSlug, projectId) });
      queryClient.invalidateQueries({
        queryKey: ["incident", workspaceSlug, projectId, incident.id],
      });
      toast.success("Incident updated", incident.title);
    },
  });
}

/** POST /projects/:projectId/incidents/:incidentId/notify — email the assignee. */
export function useNotifyIncidentAssignee(
  workspaceSlug: string,
  projectId: string,
) {
  return useMutation({
    mutationFn: (incidentId: string) =>
      apiFetch<{ notified: boolean; assignee: string }>(
        `/projects/${projectId}/incidents/${incidentId}/notify`,
        { method: "POST", workspaceSlug },
      ),
    onSuccess: () => toast.success("Incident assignee notified"),
  });
}
