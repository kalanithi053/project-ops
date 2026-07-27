"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";
import { workspaceSettingsKey } from "@/lib/api/hooks/use-settings";
import type {
  CreateProjectTypeDto,
  ProjectType,
  UpdateProjectTypeDto,
} from "@/lib/api/types";

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

/**
 * Invalidates the type list plus the settings bundle and plan lists —
 * creating a type with `isPlanAdd` also provisions plans and modules.
 */
function useProjectTypeInvalidation(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["project-types", workspaceSlug] });
    queryClient.invalidateQueries({ queryKey: ["plans", workspaceSlug] });
    queryClient.invalidateQueries({ queryKey: workspaceSettingsKey(workspaceSlug) });
  };
}

/**
 * POST /project-types — requires `projecttype.manage`.
 *
 * When `isPlanAdd` is true (the server-side default) this also seeds the
 * Professional / Ultimate / Enterprise plan templates and the nine default
 * modules under each, so it's a heavier write than it looks.
 */
export function useCreateProjectType(workspaceSlug: string) {
  const invalidate = useProjectTypeInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (dto: CreateProjectTypeDto) =>
      apiFetch<ProjectType>("/project-types", {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (projectType) => {
      invalidate();
      toast.success("Project type created", projectType?.name);
    },
  });
}

/** PATCH /project-types/:id — requires `projecttype.manage`. */
export function useUpdateProjectType(workspaceSlug: string) {
  const invalidate = useProjectTypeInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateProjectTypeDto }) =>
      apiFetch<ProjectType>(`/project-types/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (projectType) => {
      invalidate();
      toast.success("Project type updated", projectType?.name);
    },
  });
}

/**
 * DELETE /project-types/:id — requires `projecttype.manage`. The backend
 * rejects with a 409 if any project still uses the type.
 */
export function useDeleteProjectType(workspaceSlug: string) {
  const invalidate = useProjectTypeInvalidation(workspaceSlug);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; deleted: boolean }>(`/project-types/${id}`, {
        method: "DELETE",
        workspaceSlug,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Project type deleted");
    },
  });
}
