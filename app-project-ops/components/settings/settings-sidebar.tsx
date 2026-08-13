"use client";

import {
  Building2,
  CreditCard,
  FolderKanban,
  Flag,
  Layers,
  ListChecks,
  ShieldCheck,
  SlidersHorizontal,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { SETTINGS_NAV } from "@/components/settings/settings-nav";
import { BentoGrid, BentoTile } from "@/components/shared/bento-grid";
import { useIsWorkspaceOwner } from "@/lib/api/hooks/use-workspace-owner";

export const SETTINGS_NAV_ICONS: Record<string, LucideIcon> = {
  workspace: Building2,
  preferences: SlidersHorizontal,
  account: UserCircle,
  "ticket-statuses": ListChecks,
  roles: ShieldCheck,
  priorities: Flag,
  "project-types": FolderKanban,
  plans: CreditCard,
  hubs: Layers,
};

/**
 * Settings sub-navigation, rendered as a bento tile grid so each section
 * reads as its own destination rather than a row in a list.
 *
 * `ownerOnly` items are hidden until we've resolved that the viewer *is* the
 * owner — never shown-then-yanked for a non-owner, and briefly absent for
 * the owner while resolving instead.
 */
export function SettingsSidebar({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const base = `/${workspaceSlug}/settings`;
  const { isOwner, isResolved } = useIsWorkspaceOwner(workspaceSlug);

  const visibleNav = SETTINGS_NAV.filter(
    (item) => !item.ownerOnly || (isResolved && isOwner),
  );

  return (
    <nav aria-label="Settings sections">
      <BentoGrid className="sm:grid-cols-3 lg:grid-cols-4">
        {visibleNav.map((item) => {
          const href = `${base}/${item.segment}`;
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          const Icon = SETTINGS_NAV_ICONS[item.segment];

          return (
            <BentoTile key={item.segment} interactive className="p-0">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex h-full items-center gap-2.5 rounded-2xl p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                  isActive && "bg-accent",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground",
                  )}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" />}
                </span>
                <span
                  className={cn(
                    "text-sm font-medium",
                    isActive ? "text-accent-foreground" : "text-foreground",
                  )}
                >
                  {item.label}
                </span>
              </Link>
            </BentoTile>
          );
        })}
      </BentoGrid>
    </nav>
  );
}
