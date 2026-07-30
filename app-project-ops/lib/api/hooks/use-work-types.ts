"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import type { WorkType } from "@/lib/api/types";

/** GET /work-types — the workspace's work-item classification catalog. */
export function useWorkTypes(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["work-types", workspaceSlug],
    queryFn: () => apiFetch<WorkType[]>("/work-types", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}
