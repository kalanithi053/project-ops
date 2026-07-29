"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

import { useProject } from "@/lib/api/hooks/use-projects";

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
  const { workspace, projectId } = useParams<{
    workspace?: string;
    projectId?: string;
  }>();
  const { data: project } = useProject(workspace ?? "", projectId ?? "");

  // First segment is the workspace slug — not a navigable breadcrumb, but it
  // stays in `allSegments` because every href is prefixed with it.
  const allSegments = pathname.split("/").filter(Boolean);
  // Most record ids have no readable label and are dropped. A project id is
  // retained because the shared project query can resolve its real name for
  // the persistent app header.
  const segments = allSegments
    .slice(1)
    .map((segment, index) => ({
      segment,
      href: `/${allSegments.slice(0, index + 2).join("/")}`,
      label:
        segment === projectId ? (project?.name ?? "Project") : labelFor(segment),
    }))
    .filter(
      ({ segment }) => segment === projectId || !UUID_PATTERN.test(segment),
    );

  if (segments.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center text-sm sm:flex">
      {segments.map(({ label, href }, index) => {
        const isLast = index === segments.length - 1;

        return (
          <Fragment key={href}>
            {index > 0 && (
              <ChevronRight className="mx-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            {isLast ? (
              <span className="truncate font-medium text-foreground" aria-current="page">
                {label}
              </span>
            ) : (
              <Link
                href={href}
                className="truncate text-muted-foreground hover:text-foreground"
              >
                {label}
              </Link>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
