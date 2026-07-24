"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { can } from "@/lib/permissions/can";
import type { NavigationSection } from "@/types/navigation";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface NavItemsProps {
  sections: NavigationSection[];
  permissions: string[];
  /** Icon-only rail mode (desktop collapsed state). */
  collapsed?: boolean;
  onNavigate?: () => void;
}

/**
 * Renders the configuration-driven navigation tree. Shared between the
 * desktop sidebar and the mobile sheet so nav markup is defined once.
 * Items whose `permission` isn't in the current permission set are
 * omitted entirely — a UX-level filter only, not an authorization check.
 */
export function NavItems({
  sections,
  permissions,
  collapsed = false,
  onNavigate,
}: NavItemsProps) {
  const pathname = usePathname();
  // First path segment is the active workspace slug; nav hrefs are
  // workspace-relative and get prefixed with it here.
  const workspaceSlug = pathname.split("/").filter(Boolean)[0];

  return (
    <nav className="flex flex-col gap-4 px-2">
      {sections.map((section, sectionIndex) => {
        const visibleItems = section.items.filter((item) =>
          can(permissions, item.permission),
        );
        if (visibleItems.length === 0) return null;

        return (
          <div key={section.label ?? sectionIndex} className="flex flex-col gap-1">
            {section.label && !collapsed && (
              <p className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/80">
                {section.label}
              </p>
            )}
            {visibleItems.map((item) => {
              const href =
                item.href && workspaceSlug
                  ? `/${workspaceSlug}${item.href}`
                  : item.href;
              const isActive =
                !!href &&
                (pathname === href || pathname.startsWith(`${href}/`));
              const Icon = item.icon;

              const link = (
                <Link
                  key={item.label}
                  href={href ?? "#"}
                  onClick={onNavigate}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80",
                    collapsed && "justify-center px-0",
                  )}
                >
                  {Icon && <Icon className="h-4 w-4 shrink-0" />}
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );

              if (collapsed) {
                return (
                  <Tooltip key={item.label} delayDuration={200}>
                    <TooltipTrigger asChild>{link}</TooltipTrigger>
                    <TooltipContent side="right">{item.label}</TooltipContent>
                  </Tooltip>
                );
              }

              return link;
            })}
          </div>
        );
      })}
    </nav>
  );
}
