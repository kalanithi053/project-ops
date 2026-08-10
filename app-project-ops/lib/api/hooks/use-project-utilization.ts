"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import type { ProjectUtilization } from "@/lib/api/types";

/**
 * GET /projects/utilization — per-project hours/schedule health and
 * work-item completion, for the dashboard's "Hours utilized" card and
 * per-project meter box. Owner/Admin/Client only; pass `enabled: false`
 * for anyone else to skip the request (the backend 403s anyway).
 */
export function useProjectUtilization(
  workspaceSlug: string,
  options: { enabled?: boolean } = {},
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["projects", "utilization", workspaceSlug],
    queryFn: () =>
      apiFetch<ProjectUtilization[]>("/projects/utilization", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug) && (options.enabled ?? true),
  });
}
