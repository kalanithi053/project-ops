import {
  BarChart3,
  Clock,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Users
} from "lucide-react";

import type { NavigationSection } from "@/types/navigation";

/**
 * Single source of truth for the sidebar.
 *
 * `href` values are workspace-relative (e.g. "/projects"). The renderer
 * (<NavItems>) prefixes them with the active workspace slug so links
 * resolve to `/{slug}/projects`. Add a module's entry here and it's
 * wired into both the desktop and mobile navigation.
 */
export const navigationConfig: NavigationSection[] = [
  {
    items: [
      {
        label: "Dashboard",
        href: "/dashboard",
        icon: LayoutDashboard,
        tourId: "nav-dashboard",
      },
    ],
  },
  {
    label: "Workspace",
    items: [
      {
        label: "Projects",
        href: "/projects",
        icon: FolderKanban,
        tourId: "nav-projects",
      },
      {
        label: "Reports",
        href: "/reports",
        icon: BarChart3,
        tourId: "nav-reports",
      },
      {
        label: "Time log",
        href: "/time-logs",
        icon: Clock,
        tourId: "nav-time-logs",
      },
    ],
  },
  {
    label: "People",
    items: [
      { label: "Users", href: "/users", icon: Users, tourId: "nav-users" },
      // { label: "Teams", href: "/teams", icon: UsersRound },
    ],
  },
  {
    label: "Administration",
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: Settings,
        tourId: "nav-settings",
      },
    ],
  },
];
