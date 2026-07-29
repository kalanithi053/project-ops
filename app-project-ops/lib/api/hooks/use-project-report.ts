"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { ProjectReport, WorkspaceReport } from "@/lib/api/types";
import { useAuthStore } from "@/lib/store/auth-store";

export function useProjectReport(workspaceSlug: string, projectId: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["project-report", workspaceSlug, projectId],
    queryFn: () =>
      apiFetch<ProjectReport>(`/projects/${projectId}/reports`, { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug && projectId),
  });
}

export function useWorkspaceReport(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["workspace-report", workspaceSlug],
    queryFn: () => apiFetch<WorkspaceReport>("/reports", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}
