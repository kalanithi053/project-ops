"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { FolderKanban, Plus, Users } from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { StatsGrid } from "@/components/shared/stats-grid";
import { StatsSkeleton, CardsSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AttentionItemsCard } from "@/components/dashboard/attention-items-card";
import { PriorityItemsCard } from "@/components/dashboard/priority-items-card";
import { QuickTimeLogCard } from "@/components/dashboard/quick-time-log-card";
import { TeamAttentionItemsCard } from "@/components/dashboard/team-attention-items-card";
import { TeamPriorityItemsCard } from "@/components/dashboard/team-priority-items-card";
import { ProjectUtilizationCard } from "@/components/dashboard/project-utilization-card";
import { Meter } from "@/components/dashboard/meter";
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
import { formatDate } from "@/lib/format";
import {
  projectSeverity,
  PROJECT_SEVERITY_LABELS,
  PROJECT_SEVERITY_TONES,
} from "@/lib/project-severity";
import { statusMeter, scheduleMeter } from "@/lib/utilization-display";
import type { ProjectType } from "@/lib/api/types";
import type { Tone } from "@/types/module";

const TONE_CYCLE: Tone[] = ["info", "warning", "success", "neutral"];

function toneForType(typeId: string | undefined, types: ProjectType[]): Tone {
  if (!typeId) return "neutral";
  const index = types.findIndex((t) => String(t.id) === typeId);
  return TONE_CYCLE[index % TONE_CYCLE.length] ?? "neutral";
}

export default function DashboardPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { tenant } = useTenant();
  const { data: me } = useMe();
  const { data: projectData, isLoading } = useProjects(workspace);
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
  const utilizationByProjectId = new Map(
    (utilizationData ?? []).map((u) => [u.id, u]),
  );
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

      {isLoading ? (
        <CardsSkeleton count={2} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Recent projects</CardTitle>
              <CardDescription>Latest projects in this workspace</CardDescription>
            </CardHeader>
            <CardContent>
              {!projects.length  ? (
                <EmptyState
                  title="No projects yet"
                  description="Create your first project to get started."
                  icon={FolderKanban}
                  className="py-8"
                />
              ) : (
                <ul className="flex flex-col">
                  {projects.slice(0, 6).map((project, index) => {
                    const severity = projectSeverity(project.endDate);
                    const utilization = utilizationByProjectId.get(project.id);
                    const projectStatusMeter = utilization
                      ? statusMeter(utilization)
                      : null;
                    const projectScheduleMeter = utilization
                      ? scheduleMeter(utilization)
                      : null;
                    return (
                      <li key={String(project.id)}>
                        {index > 0 && <Separator className="my-3" />}
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 flex-col gap-1">
                            <span className="truncate text-sm font-medium hover:underline">
                               <Link href={`/${workspace}/projects/${project.id}`}>{project.name}</Link>

                            </span>
                            <div className="flex items-center gap-2">
                              {project.endDate ? (
                                <span className="text-xs text-muted-foreground">
                                  due {formatDate(project.endDate)}
                                </span>
                              ) : null}
                              <Badge
                                variant={PROJECT_SEVERITY_TONES[severity]}
                                className="text-[10px]"
                              >
                                {PROJECT_SEVERITY_LABELS[severity]}
                              </Badge>
                            </div>
                          </div>
                          {project.projectType && (
                            <Badge
                              variant={toneForType(project.projectType.id, projectTypes)}
                            >
                              {project.projectType.name}
                            </Badge>
                          )}
                        </div>
                        {isManager && (projectStatusMeter || projectScheduleMeter) && (
                          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            {projectStatusMeter && (
                              <Meter
                                label={projectStatusMeter.label}
                                percent={projectStatusMeter.percent}
                                tone={projectStatusMeter.tone}
                                valueLabel={projectStatusMeter.valueLabel}
                              />
                            )}
                            {projectScheduleMeter && (
                              <Meter
                                label={projectScheduleMeter.label}
                                percent={projectScheduleMeter.percent}
                                tone={projectScheduleMeter.tone}
                                valueLabel={projectScheduleMeter.valueLabel}
                              />
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Projects by type</CardTitle>
              <CardDescription>Split across project types</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {projectTypes.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No project types configured yet.
                </p>
              ) : (
                projectTypes.map((type) => (
                  <div
                    key={String(type.id)}
                    className="flex items-center justify-between"
                  >
                    <Badge variant={toneForType(String(type.id), projectTypes)}>
                      {type.name}
                    </Badge>
                    <span className="text-sm font-medium">
                      {projects.filter((p) => p.projectType?.id === type.id).length}
                    </span>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

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
