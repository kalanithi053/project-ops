"use client";

import { Boxes, ListChecks, Pencil, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { EditProjectPanel } from "@/components/projects/edit-project-panel";
import { ProjectActivity } from "@/components/projects/project-activity";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryState } from "@/components/shared/query-state";
import { RichTextContent } from "@/components/shared/rich-text-content";
import { ProjectOverviewSkeleton } from "@/components/shared/skeletons";
import { StatsGrid } from "@/components/shared/stats-grid";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TeamAttentionItemsCard } from "@/components/dashboard/team-attention-items-card";
import { TeamPriorityItemsCard } from "@/components/dashboard/team-priority-items-card";
import {
  useProjectMembers,
  useProjectPermissions,
} from "@/lib/api/hooks/use-project-members";
import { useProject, useProjectModules } from "@/lib/api/hooks/use-projects";
import { useProjectReport } from "@/lib/api/hooks/use-project-report";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import { useTasks } from "@/lib/api/hooks/use-tasks";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import {
  useProjectAttentionItems,
  useProjectPriorityItems,
} from "@/lib/api/hooks/use-work-item-insights";
import { PERMISSIONS } from "@/lib/api/permissions";
import { formatDurationMinutes } from "@/lib/format";

function daysBetween(start?: string, end?: string): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms)) return null;
  return Math.max(0, Math.round(ms / 86_400_000));
}

export default function ProjectOverviewPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();

  const projectQuery = useProject(workspace, projectId);
  const tasksQuery = useTasks(workspace, projectId);
  const modulesQuery = useProjectModules(workspace, projectId);
  const reportQuery = useProjectReport(workspace, projectId);
  const membersQuery = useProjectMembers(workspace, projectId);
  const { data: settings } = useWorkspaceSettings(workspace);
  const { can } = useProjectPermissions(workspace, projectId);
  const { isManagerTier: isManager } = usePermissions(workspace);
  const { data: attentionData, isLoading: isAttentionLoading } =
    useProjectAttentionItems(workspace, projectId, { enabled: isManager });
  const { data: priorityData, isLoading: isPriorityLoading } =
    useProjectPriorityItems(workspace, projectId, { enabled: isManager });
  const [editOpen, setEditOpen] = React.useState(false);

  const project = projectQuery.data;
  const tasks = React.useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const members = React.useMemo(
    () => membersQuery.data ?? [],
    [membersQuery.data],
  );

  /** moduleInstanceId -> module name, for labelling activity entries. */
  const moduleNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const instance of modulesQuery.data ?? []) {
      map.set(instance.id, instance.module.name);
    }
    return map;
  }, [modulesQuery.data]);


  /**
   * Plan ids on the project resolved to hub-qualified labels via the
   * settings bundle — a bare tier name like "Enterprise" isn't unique on
   * its own (every Hub has its own Enterprise tier), so it can't double as
   * both the label and the React key.
   */
  const planBadges = React.useMemo(() => {
    const ids = project?.planId ?? [];
    return ids.map((id) => {
      const plan = settings?.plans.find((p) => p.id === id);
      const label = plan
        ? `${plan.hub?.name ?? ""} ${plan.name}`.trim()
        : id;
      return { id, label };
    });
  }, [project, settings]);

  const duration = daysBetween(project?.startDate, project?.endDate);
  const report = reportQuery.data;
  const priorityStatusNames = React.useMemo(
    () =>
      Array.from(
        new Set(
          report?.byPriority.flatMap((entry) => Object.keys(entry.statuses)) ?? [],
        ),
      ).sort(),
    [report],
  );

  const stats = [
    { label: "Work items", value: String(report?.progress.totalItems ?? tasks.length), icon: ListChecks },
    {
      label: "Completed",
      value: report ? `${report.progress.percentComplete}%` : "—",
      icon: ListChecks,
      hint: report ? `${report.progress.doneItems} of ${report.progress.totalItems} · ${report.progress.stage}` : undefined,
    },
    { label: "Modules", value: String(report?.modules.length ?? 0), icon: Boxes },
    {
      label: "Members",
      value: String(members.filter((m) => m.status !== "removed").length),
      icon: Users,
      hint: duration === null ? undefined : `${duration}d project`,
    },
  ];

  return (
    <QueryState
      isLoading={projectQuery.isLoading || reportQuery.isLoading}
      isError={projectQuery.isError || reportQuery.isError}
      error={projectQuery.error ?? reportQuery.error}
      onRetry={() => {
        projectQuery.refetch();
        reportQuery.refetch();
      }}
      skeleton={<ProjectOverviewSkeleton />}
    >
      <div className="flex flex-col gap-6">
        <div data-tour="project-stats">
          <StatsGrid stats={stats} />
        </div>

        {planBadges.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Provisioned from
            </span>
            {planBadges.map((plan) => (
              <Badge key={plan.id} variant="secondary">
                {plan.label}
              </Badge>
            ))}
          </div>
        )}

        <Card data-tour="project-description">
          <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
            <div>
              <CardTitle>Description</CardTitle>
              <CardDescription>What this project is about.</CardDescription>
            </div>
            {can(PERMISSIONS.PROJECT_UPDATE) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {project?.description ? (
              <RichTextContent
                html={project.description}
                workspaceSlug={workspace}
                projectId={projectId}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                No description yet.
              </p>
            )}
          </CardContent>
        </Card>

        {project && (
          <EditProjectPanel
            open={editOpen}
            onOpenChange={setEditOpen}
            workspaceSlug={workspace}
            project={project}
          />
        )}

        {isManager && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <TeamAttentionItemsCard
              workspaceSlug={workspace}
              items={attentionData?.items ?? []}
              isLoading={isAttentionLoading}
            />
            <TeamPriorityItemsCard
              workspaceSlug={workspace}
              items={priorityData?.items ?? []}
              isLoading={isPriorityLoading}
            />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2" data-tour="project-module-capacity">
            <CardHeader>
              <CardTitle>Module capacity</CardTitle>
              <CardDescription>
                Tasks filed under each module, against the limit this project
                was provisioned with.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report?.modules.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="No modules"
                  description="This project type doesn't provision modules, so work items stand on their own."
                  className="border-0 py-6"
                />
              ) : (
                <ul className="flex flex-col">
                  {report?.modules.map((module, index) => {
                    const pct = module.limit
                      ? Math.min(
                          100,
                          Math.round((module.used / module.limit) * 100),
                        )
                      : 0;
                    return (
                      <li key={module.id} className="flex flex-col gap-1.5">
                        {index > 0 && <Separator className="my-3" />}
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {module.module}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {module.used} / {module.limit}
                            {module.addon > 0 && (
                              <span className="ml-1.5 text-status-warning">
                                +{module.addon} add-on
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={
                              pct >= 100
                                ? "h-full bg-status-warning"
                                : "h-full bg-status-info"
                            }
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-4">
            <Card data-tour="project-work-by-type">
              <CardHeader>
                <CardTitle>Work by type</CardTitle>
                <CardDescription>
                  {report?.byType
                    ?.map((v) => v.name)
                    ?.join(", ")
                    ?.trim() ?? "Work Type"}{" "}
                  counts.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report?.byType.length ? (
                  <ul className="flex flex-col gap-2.5">
                    {report.byType.map((type) => (
                      <li
                        key={type.name}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="inline-flex items-center gap-2 text-sm">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                type.color ?? "var(--status-neutral)",
                            }}
                          />
                          {type.name}
                        </span>
                        <span className="text-sm font-medium">
                          {type.total}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No work has been reported yet.
                  </p>
                )}
              </CardContent>
            </Card>
            <Card data-tour="project-work-by-status">
              <CardHeader>
                <CardTitle>Work by status</CardTitle>
                <CardDescription>
                  Where the work currently sits.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {!report ? null : (
                  <ul className="flex flex-col gap-2.5">
                    {report.statusBreakdown.map((status) => (
                      <li
                        key={status.name}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="inline-flex items-center gap-2 text-sm">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{
                              backgroundColor:
                                status.color ?? "var(--status-neutral)",
                            }}
                          />
                          {status.name}
                        </span>
                        <span className="text-sm font-medium">
                          {status.count}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {report?.progress.totalItems === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No work has been reported yet.
                  </p>
                )}

                <Button asChild variant="outline" size="sm" className="mt-1">
                  <Link
                    href={`/${workspace}/projects/${projectId}/work-items`}
                    className="justify-center"
                  >
                    <ListChecks className="h-4 w-4" />
                    Open work items
                  </Link>
                </Button>
              </CardContent>
            </Card>

            <Card data-tour="project-hours-logged">
              <CardHeader>
                <CardTitle>Hours logged</CardTitle>
                <CardDescription>
                  Actual time tracked per member.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {report?.user.length ? (
                  <ul className="flex flex-col gap-2.5">
                    {[...report.user]
                      .sort((a, b) => b.loggedMinutes - a.loggedMinutes)
                      .map((user) => (
                        <li
                          key={user.name}
                          className="flex items-center justify-between gap-2"
                        >
                          <span className="text-sm">{user.name}</span>
                          <span className="text-sm font-medium">
                            {formatDurationMinutes(user.loggedMinutes)}
                          </span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No project members are available for time reporting.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card data-tour="project-priority-by-status">
            <CardHeader>
              <CardTitle>Priority by status</CardTitle>
              <CardDescription>
                Task count grouped by priority and workflow status.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report?.byPriority.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Priority</TableHead>
                      {priorityStatusNames.map((status) => (
                        <TableHead key={status} className="text-right">
                          {status}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.byPriority.map((entry) => (
                      <TableRow key={entry.priority}>
                        <TableCell className="font-medium">
                          {entry.priority}
                        </TableCell>
                        {priorityStatusNames.map((status) => (
                          <TableCell key={status} className="text-right">
                            {entry.statuses[status] ?? 0}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No priority data yet.
                </p>
              )}
            </CardContent>
          </Card>

          <Card data-tour="project-team-workload">
            <CardHeader>
              <CardTitle>Team workload</CardTitle>
              <CardDescription>
                Assigned work and logged effort for each project member.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {report?.user.length ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead className="text-right">Assigned</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.user.map((user) => (
                      <TableRow key={user.name}>
                        <TableCell className="font-medium">
                          {user.name}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.totalItems}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.completedItems}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.totalCompletedHours}h /{" "}
                          {user.totalEstimateHours}h
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No project members are available for workload reporting.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card data-tour="project-recent-activity">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>
              Derived from task and membership changes — the API keeps no
              separate audit trail, so this reflects current record timestamps
              rather than a full history.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProjectActivity
              tasks={tasks}
              members={members}
              moduleNames={moduleNames}
            />
          </CardContent>
        </Card>
      </div>
    </QueryState>
  );
}
