"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Boxes, ListChecks, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { StatsGrid } from "@/components/shared/stats-grid";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton } from "@/components/shared/skeletons";
import { EmptyState } from "@/components/shared/empty-state";
import { ProjectActivity } from "@/components/projects/project-activity";
import { useProject, useProjectModules } from "@/lib/api/hooks/use-projects";
import { useProjectMembers } from "@/lib/api/hooks/use-project-members";
import { useTasks } from "@/lib/api/hooks/use-tasks";
import { useTicketStatuses } from "@/lib/api/hooks/use-ticket-statuses";
import { useWorkspaceSettings } from "@/lib/api/hooks/use-settings";

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
  const membersQuery = useProjectMembers(workspace, projectId);
  const { data: statuses } = useTicketStatuses(workspace);
  const { data: settings } = useWorkspaceSettings(workspace);

  const project = projectQuery.data;
  const tasks = React.useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const modules = React.useMemo(
    () => modulesQuery.data ?? [],
    [modulesQuery.data],
  );
  const members = React.useMemo(
    () => membersQuery.data ?? [],
    [membersQuery.data],
  );

  /** moduleInstanceId -> module name, for labelling activity entries. */
  const moduleNames = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const instance of modules) map.set(instance.id, instance.module.name);
    return map;
  }, [modules]);

  /** Live task count per module instance, for the capacity bars. */
  const tasksPerModule = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of tasks) {
      if (!task.moduleInstanceId) continue;
      counts.set(
        task.moduleInstanceId,
        (counts.get(task.moduleInstanceId) ?? 0) + 1,
      );
    }
    return counts;
  }, [tasks]);

  const byStatus = React.useMemo(() => {
    const ordered = [...(statuses ?? [])].sort((a, b) => a.order - b.order);
    return ordered.map((status) => ({
      status,
      count: tasks.filter((task) => task.statusId === status.id).length,
    }));
  }, [statuses, tasks]);

  /** Plan ids on the project resolved to names via the settings bundle. */
  const planNames = React.useMemo(() => {
    const ids = project?.planId ?? [];
    return ids.map(
      (id) => settings?.plans.find((plan) => plan.id === id)?.name ?? id,
    );
  }, [project, settings]);

  const duration = daysBetween(project?.startDate, project?.endDate);
  const done = byStatus
    .filter(({ status }) => status.category === "done")
    .reduce((sum, entry) => sum + entry.count, 0);

  const stats = [
    { label: "Tasks", value: String(tasks.length), icon: ListChecks },
    {
      label: "Completed",
      value: tasks.length ? `${Math.round((done / tasks.length) * 100)}%` : "—",
      icon: ListChecks,
      hint: `${done} of ${tasks.length}`,
    },
    { label: "Modules", value: String(modules.length), icon: Boxes },
    {
      label: "Members",
      value: String(members.filter((m) => m.status !== "removed").length),
      icon: Users,
      hint: duration === null ? undefined : `${duration}d project`,
    },
  ];

  return (
    <QueryState
      isLoading={projectQuery.isLoading}
      isError={projectQuery.isError}
      error={projectQuery.error}
      onRetry={() => projectQuery.refetch()}
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
              {modules.length === 0 ? (
                <EmptyState
                  icon={Boxes}
                  title="No modules"
                  description="This project type doesn't provision modules, so tasks stand on their own."
                  className="border-0 py-6"
                />
              ) : (
                <ul className="flex flex-col">
                  {modules.map((instance, index) => {
                    const used = tasksPerModule.get(instance.id) ?? 0;
                    const pct = instance.taskLimit
                      ? Math.min(
                          100,
                          Math.round((used / instance.taskLimit) * 100),
                        )
                      : 0;
                    return (
                      <li key={instance.id} className="flex flex-col gap-1.5">
                        {index > 0 && <Separator className="my-3" />}
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-medium">
                            {instance.module.name}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {used} / {instance.taskLimit}
                            {instance.addonTask > 0 && (
                              <span className="ml-1.5 text-status-warning">
                                +{instance.addonTask} add-on
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
              {byStatus.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No ticket statuses configured yet.
                </p>
              ) : (
                <ul className="flex flex-col gap-2.5">
                  {byStatus.map(({ status, count }) => (
                    <li
                      key={status.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{
                            backgroundColor:
                              status.color ?? "var(--status-neutral)",
                          }}
                          aria-hidden
                        />
                        <span className="truncate text-sm">{status.name}</span>
                      </span>
                      <span className="shrink-0 text-sm font-medium">
                        {count}
                      </span>
                    </li>
                  ))}
                </ul>
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
