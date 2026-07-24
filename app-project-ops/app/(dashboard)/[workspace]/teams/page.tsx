"use client";

import { useParams } from "next/navigation";
import { FolderKanban, Users, UsersRound } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { StatsGrid } from "@/components/shared/stats-grid";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton, StatsSkeleton } from "@/components/shared/skeletons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useProjects } from "@/lib/api/hooks/use-projects";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { formatDate } from "@/lib/format";
import type { ProjectMode } from "@/lib/api/types";

const MODES: ProjectMode[] = ["HubSpot", "Dev"];

export default function TeamsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const projectsQuery = useProjects(workspace);
  const membersQuery = useWorkspaceMembers(workspace);
  const projects = projectsQuery.data ?? [];
  const members = membersQuery.data ?? [];

  const stats = [
    { label: "Modes", value: MODES.length, icon: UsersRound },
    { label: "Members", value: members.length, icon: Users },
    { label: "Projects", value: projects.length, icon: FolderKanban },
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="Teams"
        description="Delivery modes in this workspace and the projects each owns."
      />

      {projectsQuery.isLoading ? (
        <StatsSkeleton count={3} />
      ) : (
        <StatsGrid stats={stats} />
      )}

      <QueryState
        isLoading={projectsQuery.isLoading}
        isError={projectsQuery.isError}
        error={projectsQuery.error}
        onRetry={() => projectsQuery.refetch()}
        skeleton={<CardsSkeleton count={2} />}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {MODES.map((mode) => {
            const modeProjects = projects.filter((p) => p.mode === mode);
            return (
              <Card key={mode}>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <div className="flex flex-col gap-1">
                    <CardTitle>{mode}</CardTitle>
                    <CardDescription>
                      {modeProjects.length} project
                      {modeProjects.length === 1 ? "" : "s"}
                    </CardDescription>
                  </div>
                  <UsersRound className="h-5 w-5 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {modeProjects.length === 0 ? (
                    <EmptyState
                      title="No projects yet"
                      description="Create a project in this mode from the Projects page."
                      icon={FolderKanban}
                      className="py-8"
                    />
                  ) : (
                    <ul className="flex flex-col">
                      {modeProjects.map((project, index) => (
                        <li key={String(project.id)}>
                          {index > 0 && <Separator className="my-3" />}
                          <div className="flex items-center justify-between gap-3">
                            <span className="truncate text-sm font-medium">
                              {project.name}
                            </span>
                            {project.endDate ? (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                due {formatDate(project.endDate)}
                              </span>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </QueryState>
    </PageContainer>
  );
}
