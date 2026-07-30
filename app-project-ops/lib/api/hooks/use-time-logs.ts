"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiDownload, apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type {
  CreateTimeLogDto,
  StopTimerDto,
  TimeLog,
  TimeLogFilters,
  UpdateTimeLogDto,
  WorkItemTimeLogs,
} from "@/lib/api/types";

/** Query key for one work item's own time-log list (+ running timer). */
export function workItemTimeLogsKey(
  workspaceSlug: string,
  projectId: string,
  workItemId: string,
) {
  return ["time-logs", "work-item", workspaceSlug, projectId, workItemId] as const;
}

/** Query key prefix for the project-level Time Logs tab — filters append a suffix. */
export function projectTimeLogsKey(workspaceSlug: string, projectId: string) {
  return ["time-logs", "project", workspaceSlug, projectId] as const;
}

function filtersToQueryString(filters: TimeLogFilters): string {
  const params = new URLSearchParams();
  if (filters.startDate) params.set("startDate", filters.startDate);
  if (filters.endDate) params.set("endDate", filters.endDate);
  if (filters.userId) params.set("userId", filters.userId);
  return params.toString();
}

/** GET /projects/:projectId/work-items/:workItemId/time-logs */
export function useWorkItemTimeLogs(
  workspaceSlug: string,
  projectId: string,
  workItemId: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: workItemTimeLogsKey(workspaceSlug, projectId, workItemId),
    queryFn: () =>
      apiFetch<WorkItemTimeLogs>(
        `/projects/${projectId}/work-items/${workItemId}/time-logs`,
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && projectId && workItemId),
  });
}

/** GET /projects/:projectId/time-logs — the project-wide Time Logs tab. */
export function useProjectTimeLogs(
  workspaceSlug: string,
  projectId: string,
  filters: TimeLogFilters = {},
) {
  const token = useAuthStore((state) => state.accessToken);
  const queryString = filtersToQueryString(filters);
  return useQuery({
    queryKey: [...projectTimeLogsKey(workspaceSlug, projectId), queryString],
    queryFn: () =>
      apiFetch<TimeLog[]>(
        `/projects/${projectId}/time-logs${queryString ? `?${queryString}` : ""}`,
        { workspaceSlug },
      ),
    enabled: Boolean(token && workspaceSlug && projectId),
  });
}

function invalidateTimeLogs(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceSlug: string,
  projectId: string,
  workItemId: string,
) {
  queryClient.invalidateQueries({
    queryKey: workItemTimeLogsKey(workspaceSlug, projectId, workItemId),
  });
  queryClient.invalidateQueries({
    queryKey: projectTimeLogsKey(workspaceSlug, projectId),
  });
}

/** POST /projects/:projectId/work-items/:workItemId/time-logs — manual entry. */
export function useCreateTimeLog(
  workspaceSlug: string,
  projectId: string,
  workItemId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateTimeLogDto) =>
      apiFetch<TimeLog>(
        `/projects/${projectId}/work-items/${workItemId}/time-logs`,
        { method: "POST", body: dto, workspaceSlug },
      ),
    onSuccess: () => {
      invalidateTimeLogs(queryClient, workspaceSlug, projectId, workItemId);
      toast.success("Time logged");
    },
  });
}

/** POST .../time-logs/timer/start — assignee only, one running timer at a time. */
export function useStartTimer(
  workspaceSlug: string,
  projectId: string,
  workItemId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<TimeLog>(
        `/projects/${projectId}/work-items/${workItemId}/time-logs/timer/start`,
        { method: "POST", workspaceSlug },
      ),
    onSuccess: () => {
      invalidateTimeLogs(queryClient, workspaceSlug, projectId, workItemId);
    },
  });
}

/** POST .../time-logs/timer/stop */
export function useStopTimer(
  workspaceSlug: string,
  projectId: string,
  workItemId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: StopTimerDto = {}) =>
      apiFetch<TimeLog>(
        `/projects/${projectId}/work-items/${workItemId}/time-logs/timer/stop`,
        { method: "POST", body: dto, workspaceSlug },
      ),
    onSuccess: (entry) => {
      invalidateTimeLogs(queryClient, workspaceSlug, projectId, workItemId);
      toast.success("Timer stopped", `${entry.durationMinutes} min logged`);
    },
  });
}

/** PATCH /time-logs/:id — only the entry's own logger may edit it. */
export function useUpdateTimeLog(
  workspaceSlug: string,
  projectId: string,
  workItemId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateTimeLogDto }) =>
      apiFetch<TimeLog>(`/time-logs/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: () => {
      invalidateTimeLogs(queryClient, workspaceSlug, projectId, workItemId);
      toast.success("Time log updated");
    },
  });
}

/** DELETE /time-logs/:id — only the entry's own logger may delete it. */
export function useDeleteTimeLog(
  workspaceSlug: string,
  projectId: string,
  workItemId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; deleted: boolean }>(`/time-logs/${id}`, {
        method: "DELETE",
        workspaceSlug,
      }),
    onSuccess: () => {
      invalidateTimeLogs(queryClient, workspaceSlug, projectId, workItemId);
      toast.success("Time log deleted");
    },
  });
}

/**
 * Downloads the project's (filtered) time logs as CSV through the
 * authenticated API — mirrors `downloadAttachment` in use-attachments.ts.
 */
export async function downloadTimeLogsCsv(
  workspaceSlug: string,
  projectId: string,
  filters: TimeLogFilters = {},
): Promise<void> {
  const queryString = filtersToQueryString(filters);
  const blob = await apiDownload(
    `/projects/${projectId}/time-logs/export${queryString ? `?${queryString}` : ""}`,
    { workspaceSlug },
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `time-logs-${projectId}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
