"use client";

import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import type {
  AttentionItemsResponse,
  MyOpenWorkItemsResponse,
  PriorityItemsResponse,
  TeamAttentionItemsResponse,
  TeamPriorityItemsResponse,
} from "@/lib/api/types";

/** GET /work-items/attention — the caller's own overdue/due-soon/blocked items, for the dashboard. */
export function useAttentionItems(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["work-items", "attention", workspaceSlug],
    queryFn: () =>
      apiFetch<AttentionItemsResponse>("/work-items/attention", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/** GET /work-items/priority — the caller's own open items ranked by priority, for the dashboard. */
export function usePriorityItems(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["work-items", "priority", workspaceSlug],
    queryFn: () =>
      apiFetch<PriorityItemsResponse>("/work-items/priority", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/** GET /work-items/mine — every open item assigned to the caller, for the quick time-log picker. */
export function useMyOpenItems(workspaceSlug: string) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["work-items", "mine", workspaceSlug],
    queryFn: () =>
      apiFetch<MyOpenWorkItemsResponse>("/work-items/mine", { workspaceSlug }),
    enabled: Boolean(token && workspaceSlug),
  });
}

/**
 * GET /work-items/attention/team — every workspace item needing attention,
 * across every assignee. Owner/Admin/Client only; pass `enabled: false`
 * (e.g. when the caller's role isn't manager-tier) to skip the request —
 * the backend 403s anyway, but there's no reason to fire it.
 */
export function useTeamAttentionItems(
  workspaceSlug: string,
  options: { enabled?: boolean } = {},
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["work-items", "attention-team", workspaceSlug],
    queryFn: () =>
      apiFetch<TeamAttentionItemsResponse>("/work-items/attention/team", {
        workspaceSlug,
      }),
    enabled: Boolean(token && workspaceSlug) && (options.enabled ?? true),
  });
}

/**
 * GET /work-items/priority/team — every workspace top-priority item, across
 * every assignee. Owner/Admin/Client only; see useTeamAttentionItems for
 * the `enabled` gate.
 */
export function useTeamPriorityItems(
  workspaceSlug: string,
  options: { enabled?: boolean } = {},
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["work-items", "priority-team", workspaceSlug],
    queryFn: () =>
      apiFetch<TeamPriorityItemsResponse>("/work-items/priority/team", {
        workspaceSlug,
      }),
    enabled: Boolean(token && workspaceSlug) && (options.enabled ?? true),
  });
}

/**
 * GET /projects/:projectId/work-items/attention — every item in this
 * project needing attention, across every assignee. Owner/Admin/Client
 * only; see useTeamAttentionItems for the `enabled` gate.
 */
export function useProjectAttentionItems(
  workspaceSlug: string,
  projectId: string,
  options: { enabled?: boolean } = {},
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["work-items", "attention-project", workspaceSlug, projectId],
    queryFn: () =>
      apiFetch<TeamAttentionItemsResponse>(
        `/projects/${projectId}/work-items/attention`,
        { workspaceSlug },
      ),
    enabled:
      Boolean(token && workspaceSlug && projectId) && (options.enabled ?? true),
  });
}

/**
 * GET /projects/:projectId/work-items/priority — every open top-priority
 * item in this project, across every assignee. Owner/Admin/Client only;
 * see useTeamAttentionItems for the `enabled` gate.
 */
export function useProjectPriorityItems(
  workspaceSlug: string,
  projectId: string,
  options: { enabled?: boolean } = {},
) {
  const token = useAuthStore((state) => state.accessToken);
  return useQuery({
    queryKey: ["work-items", "priority-project", workspaceSlug, projectId],
    queryFn: () =>
      apiFetch<TeamPriorityItemsResponse>(
        `/projects/${projectId}/work-items/priority`,
        { workspaceSlug },
      ),
    enabled:
      Boolean(token && workspaceSlug && projectId) && (options.enabled ?? true),
  });
}
