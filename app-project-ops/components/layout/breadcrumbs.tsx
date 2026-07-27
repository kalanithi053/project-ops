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
  preferences: "Preferences",
  board: "Board",
  files: "Files",
  // Settings sections
  workspace: "Workspace",
  account: "Account",
  "ticket-statuses": "Ticket Status",
  roles: "Role",
  priorities: "Priorities",
  "project-types": "Project Type",
  plans: "Plans",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  // First segment is the workspace slug — not a navigable breadcrumb, but it
  // stays in `allSegments` because every href is prefixed with it.
  const allSegments = pathname.split("/").filter(Boolean);
  // Record ids carry no readable label, and the detail page shows the
  // record's real name in its own heading — so they're dropped rather than
  // rendered as a mangled uuid. Hrefs are built from each segment's position
  // in the original path so a dropped id can't shift the links.
  const segments = allSegments
    .slice(1)
    .map((segment, index) => ({
      segment,
      href: `/${allSegments.slice(0, index + 2).join("/")}`,
    }))
    .filter(({ segment }) => !UUID_PATTERN.test(segment));

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center text-sm sm:flex">
      {segments.map(({ segment, href }, index) => {
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
