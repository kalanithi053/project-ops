"use client";

import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import { useMe } from "@/lib/api/hooks/use-users";

/**
 * Whether the signed-in user is the workspace's owner — stricter than any
 * permission code, used to gate the handful of settings sections (Workspace,
 * Ticket Status, Role, Priorities, Project Type, Plans) that only the owner
 * may view, regardless of what their role otherwise grants.
 *
 * UI-only: the backend still enforces access by permission code, not
 * ownership, for these routes.
 */
export function useIsWorkspaceOwner(workspaceSlug: string) {
  const { data: me } = useMe();
  const { data: settings } = useWorkspaceSettings(workspaceSlug);

  const isResolved = Boolean(me?.id && settings?.workspace.ownerId);
  const isOwner = Boolean(
    isResolved && me!.id === settings!.workspace.ownerId,
  );

  return { isOwner, isResolved };
}
