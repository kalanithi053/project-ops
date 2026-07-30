"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { SETTINGS_NAV } from "@/components/settings/settings-nav";

/**
 * Settings sub-navigation rail.
 *
 * A vertical list on desktop; on narrow viewports it becomes a horizontally
 * scrollable strip so all seven sections stay reachable without a second
 * disclosure layer. Active detection matches the section prefix so nested
 * routes (a plan's module editor, say) keep their parent highlighted.
 */
export function SettingsSidebar({ workspaceSlug }: { workspaceSlug: string }) {
  const pathname = usePathname();
  const base = `/${workspaceSlug}/settings`;

  return (
    <nav
      aria-label="Settings sections"
      className={cn(
        "flex gap-1 overflow-x-auto border-b border-border pb-0",
        "md:w-52 md:shrink-0 md:flex-col md:overflow-visible md:border-r md:border-b-0 md:pb-0",
        "md:sticky md:top-20 md:self-start",
      )}
    >
      {SETTINGS_NAV.map((item) => {
        const href = `${base}/${item.segment}`;
        const isActive = pathname === href || pathname.startsWith(`${href}/`);

        return (
          <Link
            key={item.segment}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-t-md border-b-2 border-transparent px-3 py-2 text-sm font-medium transition-colors",
              "md:-mr-px md:rounded-l-md md:rounded-r-none md:border-r-2 md:border-b-0",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isActive
                ? "border-primary bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
