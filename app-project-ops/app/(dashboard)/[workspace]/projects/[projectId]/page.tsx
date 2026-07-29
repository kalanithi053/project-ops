"use client";

import { Boxes, ListChecks, Users } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import * as React from "react";

import { ProjectActivity } from "@/components/projects/project-activity";
import { EmptyState } from "@/components/shared/empty-state";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton } from "@/components/shared/skeletons";
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
import { useProjectMembers } from "@/lib/api/hooks/use-project-members";
import { useProject, useProjectModules } from "@/lib/api/hooks/use-projects";
import { useProjectReport } from "@/lib/api/hooks/use-project-report";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";
import { useTasks } from "@/lib/api/hooks/use-tasks";

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


  /** Plan ids on the project resolved to names via the settings bundle. */
  const planNames = React.useMemo(() => {
    const ids = project?.planId ?? [];
    return ids.map(
      (id) => settings?.plans.find((plan) => plan.id === id)?.name ?? id,
    );
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
    { label: "Tasks", value: String(report?.progress.totalTasks ?? tasks.length), icon: ListChecks },
    {
      label: "Completed",
      value: report ? `${report.progress.percentComplete}%` : "—",
      icon: ListChecks,
      hint: report ? `${report.progress.doneTasks} of ${report.progress.totalTasks} · ${report.progress.stage}` : undefined,
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
      onRetry={() => { projectQuery.refetch(); reportQuery.refetch(); }}
      skeleton={<CardsSkeleton count={2} />}
    >
      <div className="flex flex-col gap-6">
        <StatsGrid stats={stats} />

        {planNames.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Provisioned from
            </span>
            {planNames.map((planName) => (
              <Badge key={planName} variant="secondary">
                {planName}
              </Badge>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
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
                  description="This project type doesn't provision modules, so tasks stand on their own."
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

          <Card>
            <CardHeader>
              <CardTitle>Work by status</CardTitle>
              <CardDescription>Where the tasks currently sit.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {!report ? null : (
                <ul className="flex flex-col gap-2.5">
                  {report.statusBreakdown.map((status) => (
                    <li key={status.name} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2 text-sm"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: status.color ?? "var(--status-neutral)" }} />{status.name}</span>
                      <span className="text-sm font-medium">{status.count}</span>
                    </li>
                  ))}
                </ul>
              )}
              {report?.progress.totalTasks === 0 && (
                <p className="text-sm text-muted-foreground">
                  No work has been reported yet.
                </p>
              )}

              <Button asChild variant="outline" size="sm" className="mt-1">
                <Link
                  href={`/${workspace}/projects/${projectId}/board`}
                  className="justify-center"
                >
                  <ListChecks className="h-4 w-4" />
                  Open board
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
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
                        <TableCell className="font-medium">{entry.priority}</TableCell>
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

          <Card>
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
                      <TableHead className="text-right">Tasks</TableHead>
                      <TableHead className="text-right">Incidents</TableHead>
                      <TableHead className="text-right">Completed</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {report.user.map((user) => (
                      <TableRow key={user.name}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-right">{user.totalTasks}</TableCell>
                        <TableCell className="text-right">{user.totalIncidents}</TableCell>
                        <TableCell className="text-right">
                          {user.completedTasks + user.completedIncidents}
                        </TableCell>
                        <TableCell className="text-right">
                          {user.totalCompletedHours}h / {user.totalEstimateHours}h
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

        <Card>
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
