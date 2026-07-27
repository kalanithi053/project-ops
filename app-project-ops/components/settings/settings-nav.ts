/**
 * The settings sub-navigation, in display order.
 *
 * Every section is readable by any workspace member — GET /workspace/settings
 * is deliberately ungated — so nothing is hidden here. Write affordances
 * inside each section are gated individually on the listed permission.
 */
export interface SettingsNavItem {
  /** Path segment under /:workspace/settings. */
  segment: string;
  label: string;
  /** Permission required to modify this section (not to view it). */
  managePermission: string;
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  { segment: "workspace", label: "Workspace", managePermission: "workspace.manage" },
  // "Account", not "User" — this section edits the signed-in user's own
  // profile, while the workspace-level Users page manages other people.
  { segment: "account", label: "Account", managePermission: "" },
  {
    segment: "ticket-statuses",
    label: "Ticket Status",
    managePermission: "ticketstatus.manage",
  },
  { segment: "roles", label: "Role", managePermission: "role.manage" },
  { segment: "priorities", label: "Priorities", managePermission: "priority.manage" },
  {
    segment: "project-types",
    label: "Project Type",
    managePermission: "projecttype.manage",
  },
  { segment: "plans", label: "Plans", managePermission: "plan.manage" },
];

/** The section landed on when /settings is opened with no sub-path. */
export const DEFAULT_SETTINGS_SEGMENT = SETTINGS_NAV[0].segment;
