"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/lib/api/hooks/use-projects";
import { cn } from "@/lib/utils";

const TABS = [
  { segment: "", label: "Dashboard" },
  { segment: "board", label: "Board" },
  { segment: "work-items", label: "Work items" },
  { segment: "users", label: "Users" },
  // { segment: "files", label: "Files" },
];

/**
 * Shell for a single project: identity header plus Overview / Board tabs.
 *
 * Both tabs call useProject(), resolving to the same cached request, so
 * switching between them costs nothing and each stays deep-linkable.
 */
export default function ProjectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();
  const pathname = usePathname();
  const { isLoading } = useProject(workspace, projectId);

  const base = `/${workspace}/projects/${projectId}`;
  const isTaskEditor =
    pathname.startsWith(`${base}/tasks/`) ||
    pathname.startsWith(`${base}/incidents/`);

  if (isTaskEditor) {
    return <PageContainer>{children}</PageContainer>;
  }

  return (
    <PageContainer className="flex flex-col gap-6">
      {/* <Button
        asChild
        variant="ghost"
        size="sm"
        className="-ml-2 w-fit text-muted-foreground"
      >
        <Link href={`/${workspace}/projects`}>
          <ArrowLeft className="h-4 w-4" />
          All projects
        </Link>
      </Button> */}
      {isLoading ? <Skeleton className="h-8 w-64" /> : null}
      {/* <div className="flex flex-col gap-2">

        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {project?.name ?? "Project"}
            </h1>
            {project?.projectType && (
              <Badge variant="info">{project.projectType.name}</Badge>
            )}
          </div>
        )}

        {project?.description && (
          <p className="text-sm text-muted-foreground">{project.description}</p>
        )}

        {(project?.startDate || project?.endDate) && (
          <p className="text-sm text-muted-foreground">
            {formatDate(project.startDate)} — {formatDate(project.endDate)}
          </p>
        )}
      </div> */}

      <nav
        aria-label="Project sections"
        className="sticky top-14 z-30 -mx-4 flex gap-1 border-b border-border bg-background px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
      >
        {TABS.map((tab) => {
          const href = tab.segment ? `${base}/${tab.segment}` : base;
          const isActive = pathname === href;
          return (
            <Link
              key={tab.label}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {children}
    </PageContainer>
  );
}
