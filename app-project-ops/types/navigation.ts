import type { LucideIcon } from "lucide-react";

/**
 * A single entry in the primary navigation tree. Groups are modeled as
 * items with `children` and no `href`; leaf items link to a route.
 * `permission` is optional so ungated items (e.g. Dashboard) remain
 * visible to every authenticated user.
 */
export interface NavigationItem {
  label: string;
  href?: string;
  icon?: LucideIcon;
  permission?: string;
  children?: NavigationItem[];
}

export interface NavigationSection {
  label?: string;
  items: NavigationItem[];
}
