/**
 * The settings sub-navigation, in display order.
 *
 * Every section is readable by any workspace member — GET /workspace/settings
 * is deliberately ungated — so nothing is hidden here by permission. Write
 * affordances inside each section are gated individually on the listed
 * permission. `ownerOnly` sections go further: they're hidden from (and
 * blocked for) anyone but the workspace owner, regardless of permission —
 * enforced client-side only, see useIsWorkspaceOwner.
 */
export interface SettingsNavItem {
  /** Path segment under /:workspace/settings. */
  segment: string;
  label: string;
  /** Permission required to modify this section (not to view it). */
  managePermission: string;
  /** Restricts the whole section (view and manage) to the workspace owner. */
  ownerOnly?: boolean;
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  {
    segment: "workspace",
    label: "Workspace",
    managePermission: "workspace.manage",
    ownerOnly: true,
  },
  {
    segment: "preferences",
    label: "Preferences",
    managePermission: "workspace.manage",
  },
  // "Account", not "User" — this section edits the signed-in user's own
  // profile, while the workspace-level Users page manages other people.
  { segment: "account", label: "Account", managePermission: "" },
  {
    segment: "ticket-statuses",
    label: "Ticket Status",
    managePermission: "ticketstatus.manage",
    ownerOnly: true,
  },
  {
    segment: "roles",
    label: "Role",
    managePermission: "role.manage",
    ownerOnly: true,
  },
  {
    segment: "priorities",
    label: "Priorities",
    managePermission: "priority.manage",
    ownerOnly: true,
  },
  {
    segment: "project-types",
    label: "Project Type",
    managePermission: "projecttype.manage",
    ownerOnly: true,
  },
  {
    segment: "plans",
    label: "Plans",
    managePermission: "plan.manage",
    ownerOnly: true,
  },
  {
    segment: "hubs",
    label: "Hubs",
    managePermission: "hub.manage",
    ownerOnly: true,
  },
];

/**
 * The section landed on when /settings is opened with no sub-path. Fixed to
 * "preferences" rather than derived from SETTINGS_NAV[0] — the first entry
 * (Workspace) is owner-only, and the default landing page must work for
 * every member.
 */
export const DEFAULT_SETTINGS_SEGMENT = "preferences";
