import type { Tenant } from "@/types/tenant";

/**
 * Client-side persistence for the workspace the user picked (or created)
 * during the auth flow, so the dashboard header can reflect it.
 *
 * This is a stand-in for a real session: there's no backend yet, so the
 * selection is kept in localStorage and read by TenantProvider on mount.
 * Replace these helpers with session/tenant API calls once auth exists.
 */

const ACTIVE_KEY = "projectops.activeWorkspace";
const CREATED_KEY = "projectops.createdWorkspaces";

function isBrowser() {
  return typeof window !== "undefined";
}

/** The workspace the user last entered, or null if none chosen yet. */
export function getActiveWorkspace(): Tenant | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_KEY);
    return raw ? (JSON.parse(raw) as Tenant) : null;
  } catch {
    return null;
  }
}

/** Workspaces created in-app (not part of the seeded mock list). */
export function getCreatedWorkspaces(): Tenant[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(CREATED_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as Tenant[]) : [];
  } catch {
    return [];
  }
}

/**
 * Mark `workspace` as the active one. Pass `created: true` when it was
 * just created so it's also remembered for the tenant switcher list.
 */
export function setActiveWorkspace(
  workspace: Tenant,
  options?: { created?: boolean },
): void {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(ACTIVE_KEY, JSON.stringify(workspace));
    if (options?.created) {
      const existing = getCreatedWorkspaces();
      if (!existing.some((t) => t.id === workspace.id)) {
        window.localStorage.setItem(
          CREATED_KEY,
          JSON.stringify([...existing, workspace]),
        );
      }
    }
  } catch {
    // Ignore storage quota / serialization failures — non-critical.
  }
}
