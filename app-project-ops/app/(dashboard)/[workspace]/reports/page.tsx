"use client";

import { useParams } from "next/navigation";
import { BarChart3, FolderKanban, Users } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { StatsGrid } from "@/components/shared/stats-grid";
import { ModulePanels } from "@/components/shared/module-panels";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton, StatsSkeleton } from "@/components/shared/skeletons";
import { useProjects } from "@/lib/api/hooks/use-projects";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { formatDate } from "@/lib/format";
import type { Panel } from "@/types/module";
import type { ProjectMode } from "@/lib/api/types";

const MODES: ProjectMode[] = ["HubSpot", "Dev"];

/**
 * Workspace reporting overview. The API doesn't expose an activity feed
 * yet, so this summarizes the live data we do have (projects, members)
 * into breakdowns and a recent-projects list.
 */
export default function ReportsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const projectsQuery = useProjects(workspace);
  const membersQuery = useWorkspaceMembers(workspace);
  const projects = projectsQuery.data ?? [];
  const members = membersQuery.data ?? [];

  const stats = [
    { label: "Projects", value: projects.length, icon: FolderKanban },
    { label: "Members", value: members.length, icon: Users },
    {
      label: "Scheduled",
      value: projects.filter((p) => p.endDate).length,
      icon: BarChart3,
    },
  ];

  const panels: Panel[] = [
    {
      type: "breakdown",
      title: "Projects by mode",
      description: "Split across delivery modes",
      items: MODES.map((mode) => ({
        label: mode,
        count: projects.filter((p) => p.mode === mode).length,
        tone: mode === "HubSpot" ? ("warning" as const) : ("info" as const),
      })),
    },
    {
      type: "list",
      title: "Recent projects",
      description: "Most recently listed",
      span: 2,
      items: projects.slice(0, 6).map((project) => ({
        icon: FolderKanban,
        primary: project.name,
        secondary: project.description || project.mode,
        meta: project.endDate ? `due ${formatDate(project.endDate)}` : undefined,
      })),
    },
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="A live summary of activity across this workspace."
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
        <ModulePanels panels={panels} />
      </QueryState>
    </PageContainer>
  );
}
