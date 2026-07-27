"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type {
  InviteProjectMemberDto,
  ProjectMember,
  ProjectPermissions,
  UpdateProjectMemberDto,
} from "@/lib/api/types";
import { useAuthStore } from "@/lib/store/auth-store";
import { toast } from "@/lib/toast/toast-store";

/** Query key for a project's member list. */
export function projectMembersKey(workspaceSlug: string, projectId: string) {
  return ["project-members", workspaceSlug, projectId] as const;
}

/**
 * GET /projects/:projectId/members — who has access to this project.
 *
 * Project membership is separate from workspace membership: being in the
 * workspace doesn't grant access to a given project, and a person can hold a
 * different role here than they do workspace-wide.
 */
export function useProjectMembers(workspaceSlug: string, projectId: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: projectMembersKey(workspaceSlug, projectId),
    queryFn: () =>
      apiFetch<ProjectMember[]>(`/projects/${projectId}/members`, {
        workspaceSlug,
      }),
    enabled: Boolean(token && workspaceSlug && projectId),
  });
}

/**
 * GET /project/:projectId/permission — the caller's own role and effective
 * permissions *within this project*, resolved server-side.
 */
export function useMyProjectPermissions(
  workspaceSlug: string,
  projectId: string,
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["my-project-permissions", workspaceSlug, projectId],
    queryFn: () =>
      apiFetch<ProjectPermissions>(`/project/${projectId}/permission`, {
        workspaceSlug,
      }),
    enabled: Boolean(token && workspaceSlug && projectId),
    staleTime: 5 * 60_000,
  });
}

function useMemberInvalidation(workspaceSlug: string, projectId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({
      queryKey: projectMembersKey(workspaceSlug, projectId),
    });
    // The project header shows a member count, and the caller's own access
    // may have changed if they edited their own membership.
    queryClient.invalidateQueries({
      queryKey: ["project", workspaceSlug, projectId],
    });
    queryClient.invalidateQueries({
      queryKey: ["my-project-permissions", workspaceSlug, projectId],
    });
  };
}

/**
 * POST /projects/:projectId/members — requires `member.invite`.
 * `roleId` is mandatory on this route.
 */
export function useInviteProjectMember(
  workspaceSlug: string,
  projectId: string,
) {
  const invalidate = useMemberInvalidation(workspaceSlug, projectId);
  return useMutation({
    mutationFn: (dto: InviteProjectMemberDto) =>
      apiFetch<ProjectMember>(`/projects/${projectId}/members`, {
        method: "POST",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (member) => {
      invalidate();
      toast.success("Member added", member?.user?.email);
    },
  });
}

/**
 * PATCH /projects/:projectId/members/:memberId — change a member's project
 * role or membership status. Requires `member.invite`.
 */
export function useUpdateProjectMember(
  workspaceSlug: string,
  projectId: string,
) {
  const invalidate = useMemberInvalidation(workspaceSlug, projectId);
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateProjectMemberDto }) =>
      apiFetch<ProjectMember>(`/projects/${projectId}/members/${id}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: () => {
      invalidate();
      toast.success("Member updated");
    },
  });
}

/**
 * DELETE /projects/:projectId/members/:memberId — requires `member.remove`.
 * Removes project access without touching workspace membership.
 */
export function useRemoveProjectMember(
  workspaceSlug: string,
  projectId: string,
) {
  const invalidate = useMemberInvalidation(workspaceSlug, projectId);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string; removed: boolean }>(
        `/projects/${projectId}/members/${id}`,
        { method: "DELETE", workspaceSlug },
      ),
    onSuccess: () => {
      invalidate();
      toast.success("Member removed");
    },
  });
}
