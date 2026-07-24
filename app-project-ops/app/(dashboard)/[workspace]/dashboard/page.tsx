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
import { useTenant } from "@/lib/tenant/tenant-context";
import { useMe } from "@/lib/api/hooks/use-users";
import { useProjects } from "@/lib/api/hooks/use-projects";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";
import { formatDate } from "@/lib/format";
import type { ProjectMode } from "@/lib/api/types";

const MODES: ProjectMode[] = ["HubSpot", "Dev"];

export default function DashboardPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { tenant } = useTenant();
  const { data: me } = useMe();
  const { data: projectData, isLoading } = useProjects(workspace);
  const { data: memberData } = useWorkspaceMembers(workspace);
  const { can } = usePermissions(workspace);

  const projects = projectData ?? [];
  const members = memberData ?? [];
  const firstName = me?.firstName || me?.username || "there";

  const stats = [
    { label: "Projects", value: projects.length, icon: FolderKanban },
    { label: "Members", value: members.length, icon: Users },
    { label: "HubSpot", value: projects.filter((p) => p.mode === "HubSpot").length },
    { label: "Dev", value: projects.filter((p) => p.mode === "Dev").length },
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
        {can(PERMISSIONS.PROJECT_CREATE) && (
          <Button asChild className="w-full sm:w-auto">
            <Link href={`/${workspace}/projects`}>
              <Plus className="h-4 w-4" />
              New project
            </Link>
          </Button>
        )}
      </div>

      {isLoading ? <StatsSkeleton count={4} /> : <StatsGrid stats={stats} />}

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
            {projects.length === 0 ? (
              <EmptyState
                title="No projects yet"
                description="Create your first project to get started."
                icon={FolderKanban}
                className="py-8"
                action={
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/${workspace}/projects`}>New project</Link>
                  </Button>
                }
              />
            ) : (
              <ul className="flex flex-col">
                {projects.slice(0, 6).map((project, index) => (
                  <li key={String(project.id)}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-medium">
                          {project.name}
                        </span>
                        {project.endDate ? (
                          <span className="text-xs text-muted-foreground">
                            due {formatDate(project.endDate)}
                          </span>
                        ) : null}
                      </div>
                      <Badge
                        variant={project.mode === "HubSpot" ? "warning" : "info"}
                      >
                        {project.mode}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects by mode</CardTitle>
            <CardDescription>Split across delivery modes</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {MODES.map((mode) => (
              <div key={mode} className="flex items-center justify-between">
                <Badge variant={mode === "HubSpot" ? "warning" : "info"}>
                  {mode}
                </Badge>
                <span className="text-sm font-medium">
                  {projects.filter((p) => p.mode === mode).length}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
      )}
    </PageContainer>
  );
}
