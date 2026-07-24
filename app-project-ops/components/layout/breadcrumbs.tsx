"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

/**
 * Maps a URL segment to a human-readable label. Centralized here so
 * pages never need to hardcode their own breadcrumb trail — add an
 * entry once when a new route is introduced.
 */
const segmentLabels: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Projects",
  users: "Users",
  teams: "Teams",
  reports: "Reports",
  settings: "Settings",
};

function labelFor(segment: string) {
  return (
    segmentLabels[segment] ??
    segment
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const allSegments = pathname.split("/").filter(Boolean);
  // First segment is the workspace slug — not a navigable breadcrumb.
  const workspaceSlug = allSegments[0];
  const segments = allSegments.slice(1);

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center text-sm sm:flex">
      {segments.map((segment, index) => {
        const href = `/${workspaceSlug}/${segments.slice(0, index + 1).join("/")}`;
        const isLast = index === segments.length - 1;

        return (
          <Fragment key={href}>
            {index > 0 && (
              <ChevronRight className="mx-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            {isLast ? (
              <span className="truncate font-medium text-foreground" aria-current="page">
                {labelFor(segment)}
              </span>
            ) : (
              <Link
                href={href}
                className="truncate text-muted-foreground hover:text-foreground"
              >
                {labelFor(segment)}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
