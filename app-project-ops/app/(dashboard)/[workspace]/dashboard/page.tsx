"use client";

import { useParams } from "next/navigation";
import { FolderKanban, Plus, Users } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { StatsGrid } from "@/components/shared/stats-grid";
import { StatsSkeleton } from "@/components/shared/skeletons";
import { Button } from "@/components/ui/button";
import { AttentionItemsCard } from "@/components/dashboard/attention-items-card";
import { PriorityItemsCard } from "@/components/dashboard/priority-items-card";
import { QuickTimeLogCard } from "@/components/dashboard/quick-time-log-card";
import { TeamAttentionItemsCard } from "@/components/dashboard/team-attention-items-card";
import { TeamPriorityItemsCard } from "@/components/dashboard/team-priority-items-card";
import { ProjectUtilizationCard } from "@/components/dashboard/project-utilization-card";
import { useTenant } from "@/lib/tenant/tenant-context";
import { useMe } from "@/lib/api/hooks/use-users";
import { useProjects } from "@/lib/api/hooks/use-projects";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { useProjectTypes } from "@/lib/api/hooks/use-project-types";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import {
  useAttentionItems,
  useMyOpenItems,
  usePriorityItems,
  useTeamAttentionItems,
  useTeamPriorityItems,
} from "@/lib/api/hooks/use-work-item-insights";
import { useProjectUtilization } from "@/lib/api/hooks/use-project-utilization";
import { PERMISSIONS } from "@/lib/api/permissions";

export default function DashboardPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { tenant } = useTenant();
  const { data: me } = useMe();
  const { data: projectData } = useProjects(workspace);
  const { data: memberData } = useWorkspaceMembers(workspace);
  const { data: typeData } = useProjectTypes(workspace);
  const { can, isManagerTier: isManager } = usePermissions(workspace);
  const { data: attentionData, isLoading: isAttentionLoading } =
    useAttentionItems(workspace);
  const { data: priorityData, isLoading: isPriorityLoading } =
    usePriorityItems(workspace);
  const { data: myOpenItemsData, isLoading: isMyOpenItemsLoading } =
    useMyOpenItems(workspace);
  const { data: teamAttentionData, isLoading: isTeamAttentionLoading } =
    useTeamAttentionItems(workspace, { enabled: isManager });
  const { data: teamPriorityData, isLoading: isTeamPriorityLoading } =
    useTeamPriorityItems(workspace, { enabled: isManager });
  const { data: utilizationData, isLoading: isUtilizationLoading } =
    useProjectUtilization(workspace, { enabled: isManager });

  const projects = projectData ?? [];
  const members = memberData ?? [];
  const projectTypes = typeData ?? [];
  const attentionItems = attentionData?.items ?? [];
  const priorityItems = priorityData?.items ?? [];
  const myOpenItems = myOpenItemsData?.items ?? [];
  const teamAttentionItems = teamAttentionData?.items ?? [];
  const teamPriorityItems = teamPriorityData?.items ?? [];
  const firstName = me?.firstName || me?.username || "there";

  const stats = [
    { label: "Projects", value: projects.length, icon: FolderKanban },
    { label: "Members", value: members.length, icon: Users },
    ...projectTypes.slice(0, 2).map((type) => ({
      label: type.name,
      value: projects.filter((p) => p.projectType?.id === type.id).length,
    })),
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {firstName}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening in{" "}
            <span className="font-medium text-foreground">{tenant.name}</span>.
          </p>
        </div>

      </div>

      {/* {isLoading ? <StatsSkeleton count={4} /> : <StatsGrid stats={stats} />} */}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <AttentionItemsCard
          workspaceSlug={workspace}
          items={attentionItems}
          isLoading={isAttentionLoading}
        />
        <PriorityItemsCard
          workspaceSlug={workspace}
          items={priorityItems}
          isLoading={isPriorityLoading}
        />
        {can(PERMISSIONS.TIMELOG_MANAGE) && (
          <QuickTimeLogCard
            workspaceSlug={workspace}
            items={myOpenItems}
            isLoading={isMyOpenItemsLoading}
          />
        )}
      </div>

      {isManager && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <TeamAttentionItemsCard
            workspaceSlug={workspace}
            items={teamAttentionItems}
            isLoading={isTeamAttentionLoading}
          />
          <TeamPriorityItemsCard
            workspaceSlug={workspace}
            items={teamPriorityItems}
            isLoading={isTeamPriorityLoading}
          />
          <ProjectUtilizationCard
            workspaceSlug={workspace}
            projects={utilizationData ?? []}
            isLoading={isUtilizationLoading}
          />
        </div>
      )}
    </PageContainer>
  );
}
