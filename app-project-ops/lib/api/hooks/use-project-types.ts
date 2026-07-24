"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import type { ProjectType } from "@/lib/api/types";

/** GET /project-types — project types available at project creation. */
export function useProjectTypes(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["project-types", workspaceSlug],
    queryFn: () =>
      apiFetch<ProjectType[]>("/project-types", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}
