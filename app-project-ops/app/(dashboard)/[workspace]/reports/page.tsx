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
import { useProjectTypes } from "@/lib/api/hooks/use-project-types";
import { useWorkspaceReport } from "@/lib/api/hooks/use-project-report";
import { formatDate } from "@/lib/format";
import type { Panel, Tone } from "@/types/module";

const TONE_CYCLE: Tone[] = ["info", "warning", "success", "neutral"];

/**
 * Workspace reporting overview. The API doesn't expose an activity feed
 * yet, so this summarizes the live data we do have (projects, members,
 * project types) into breakdowns and a recent-projects list.
 */
export default function ReportsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const projectsQuery = useProjects(workspace);
  const membersQuery = useWorkspaceMembers(workspace);
  const typesQuery = useProjectTypes(workspace);
  const workReportQuery = useWorkspaceReport(workspace);
  const projects = projectsQuery.data ?? [];
  const members = membersQuery.data ?? [];
  const projectTypes = typesQuery.data ?? [];

  const isLoading =
    projectsQuery.isLoading ||
    typesQuery.isLoading ||
    membersQuery.isLoading ||
    workReportQuery.isLoading;

  const stats = [
    { label: "Projects", value: projects.length, icon: FolderKanban },
    { label: "Members", value: members.length, icon: Users },
    {
      label: "Work items",
      value: workReportQuery.data?.totalItems ?? 0,
      icon: BarChart3,
    },
  ];

  const panels: Panel[] = [
    {
      type: "breakdown",
      title: "Work by status",
      description: "All work items in this workspace",
      span: 2,
      items: (workReportQuery.data?.statusBreakdown ?? []).map(
        (status, index) => ({
          label: status.label,
          count: status.count,
          tone: TONE_CYCLE[index % TONE_CYCLE.length],
        }),
      ),
    },
    {
      type: "breakdown",
      title: "Projects by type",
      description: "Split across project types",
      items: projectTypes.map((type, index) => ({
        label: type.name,
        count: projects.filter((p) => p.projectType?.id === type.id).length,
        tone: TONE_CYCLE[index % TONE_CYCLE.length],
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
        secondary: project.description || project.projectType?.name || "",
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

      {isLoading ? <StatsSkeleton count={3} /> : <StatsGrid stats={stats} />}

      <QueryState
        isLoading={isLoading}
        isError={projectsQuery.isError || workReportQuery.isError}
        error={projectsQuery.error ?? workReportQuery.error}
        onRetry={() => {
          projectsQuery.refetch();
          workReportQuery.refetch();
        }}
        skeleton={<CardsSkeleton count={2} />}
      >
        <ModulePanels panels={panels} />
      </QueryState>
    </PageContainer>
  );
}
