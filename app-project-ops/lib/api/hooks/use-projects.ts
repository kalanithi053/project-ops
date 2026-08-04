"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import type {
  CreateProjectDto,
  Project,
  ProjectDetail,
  ProjectModuleInstance,
  UpdateProjectDto,
} from "@/lib/api/types";

/** GET /projects — projects in the given workspace. */
export function useProjects(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["projects", workspaceSlug],
    queryFn: () => apiFetch<Project[]>("/projects", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/**
 * GET /projects/:id — one project with its project type, module instances
 * and members. Returns a task *count* only; the board fetches tasks
 * separately via useTasks.
 */
export function useProject(workspaceSlug: string, projectId: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["project", workspaceSlug, projectId],
    queryFn: () =>
      apiFetch<ProjectDetail>(`/projects/${projectId}`, { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug && projectId),
  });
}

/**
 * GET /projects/:projectId/modules — the module instances attached to a
 * project, each with its task limit and overflow count.
 *
 * Needed on its own because a task must be filed under a module instance
 * when the project type provisions plans, and the task payload carries only
 * a raw `moduleInstanceId` with no module name to render.
 */
export function useProjectModules(workspaceSlug: string, projectId: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["project-modules", workspaceSlug, projectId],
    queryFn: () =>
      apiFetch<ProjectModuleInstance[]>(`/projects/${projectId}/modules`, {
        workspaceSlug,
      }),
    enabled: Boolean(token && workspaceSlug && projectId),
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

/** PATCH /projects/:id — edit name/description/dates on an existing project. */
export function useUpdateProject(workspaceSlug: string, projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: UpdateProjectDto) =>
      apiFetch<Project>(`/projects/${projectId}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceSlug] });
      queryClient.invalidateQueries({
        queryKey: ["project", workspaceSlug, projectId],
      });
      toast.success("Project updated", project?.name);
    },
  });
}
