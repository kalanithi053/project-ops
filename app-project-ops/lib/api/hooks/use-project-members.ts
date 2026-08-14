"use client";

import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import type { PermissionCode } from "@/lib/api/permissions";
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

export interface ProjectPermissionsResult {
  /** True once we've actually resolved the current user's project role. */
  isResolved: boolean;
  /** Whether the current user is a (non-removed) member of this project. */
  isMember: boolean;
  roleName?: string;
  permissions: Set<string>;
  /**
   * Whether the current user holds a permission *within this project*. Fails
   * OPEN while unresolved (returns true) so UI isn't hidden before we know
   * the role — the backend still enforces every action against the caller's
   * ProjectMember role, not their workspace role.
   */
  can: (permission: PermissionCode) => boolean;
}

/**
 * Resolve the signed-in user's effective permissions for a specific project.
 *
 * Project access is separate from workspace access: a workspace-wide
 * permission (e.g. an Admin's `member.invite`) does not carry over to a
 * project the caller isn't a member of, and their project role may differ
 * entirely from their workspace role. Use this — not `usePermissions` — to
 * gate anything scoped to `projects/:projectId/...`.
 */
export function useProjectPermissions(
  workspaceSlug: string,
  projectId: string,
): ProjectPermissionsResult {
  const { data } = useMyProjectPermissions(workspaceSlug, projectId);

  return useMemo(() => {
    const permissions = new Set(data?.permissions ?? []);
    const isResolved = Boolean(data);

    return {
      isResolved,
      isMember: data?.isMember ?? false,
      roleName: data?.role?.name,
      permissions,
      can: (permission: PermissionCode) =>
        !isResolved || permissions.has(permission),
    };
  }, [data]);
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

/**
 * Same PATCH /projects/:projectId/members/:memberId as
 * {@link useUpdateProjectMember}, for callers — like the workspace Users
 * page — that show memberships across several projects at once and only
 * know which `projectId` to hit at the moment of the call.
 */
export function useUpdateProjectMembership(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      memberId,
      dto,
    }: {
      projectId: string;
      memberId: string;
      dto: UpdateProjectMemberDto;
    }) =>
      apiFetch<ProjectMember>(`/projects/${projectId}/members/${memberId}`, {
        method: "PATCH",
        body: dto,
        workspaceSlug,
      }),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: projectMembersKey(workspaceSlug, projectId),
      });
      queryClient.invalidateQueries({ queryKey: ["members", workspaceSlug] });
      toast.success("Member updated");
    },
  });
}

/**
 * Same DELETE /projects/:projectId/members/:memberId as
 * {@link useRemoveProjectMember}, for callers — like the workspace Users
 * page — that show memberships across several projects at once and only
 * know which `projectId` to hit at the moment of the call.
 */
export function useRemoveProjectMembership(workspaceSlug: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      projectId,
      memberId,
    }: {
      projectId: string;
      memberId: string;
    }) =>
      apiFetch<{ id: string; removed: boolean }>(
        `/projects/${projectId}/members/${memberId}`,
        { method: "DELETE", workspaceSlug },
      ),
    onSuccess: (_data, { projectId }) => {
      queryClient.invalidateQueries({
        queryKey: projectMembersKey(workspaceSlug, projectId),
      });
      // The workspace-wide member list embeds each user's project
      // memberships, so it needs refreshing too.
      queryClient.invalidateQueries({ queryKey: ["members", workspaceSlug] });
      toast.success("Removed from project");
    },
  });
}
