"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type { CreateProjectDto, Project } from "@/lib/api/types";

/** GET /projects — projects in the given workspace. */
export function useProjects(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["projects", workspaceSlug],
    queryFn: () => apiFetch<Project[]>("/projects", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/** POST /projects — create a project in the given workspace. */
export function useCreateProject(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: CreateProjectDto) =>
      apiFetch<Project>("/projects", {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceSlug] });
      toast.success("Project created", project?.name);
    },
  });
}
