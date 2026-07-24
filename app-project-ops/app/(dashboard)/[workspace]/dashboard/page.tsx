"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Activity as ActivityIcon,
  FolderKanban,
  Plus,
  UserPlus,
  Users,
  type LucideIcon,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { StatsGrid } from "@/components/shared/stats-grid";
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
import { TEAMS, useWorkspaceData, type ActivityType } from "@/lib/workspace/data";
import { mockCurrentUser } from "@/lib/mock/data";

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  project: FolderKanban,
  member: UserPlus,
  workspace: ActivityIcon,
};

function formatWhen(iso: string) {
  if (iso.length < 16) return iso;
  return `${iso.slice(0, 10)} · ${iso.slice(11, 16)}`;
}

export default function DashboardPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { tenant } = useTenant();
  const { projects, members, activities } = useWorkspaceData(workspace);

  const stats = [
    { label: "Projects", value: projects.length, icon: FolderKanban },
    { label: "Users", value: members.length, icon: Users },
    { label: "Teams", value: TEAMS.length, icon: Users },
    { label: "Activity", value: activities.length, icon: ActivityIcon },
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Good morning, {mockCurrentUser.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Here&apos;s what&apos;s happening in{" "}
            <span className="font-medium text-foreground">{tenant.name}</span>.
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link href={`/${workspace}/projects`}>
            <Plus className="h-4 w-4" />
            New project
          </Link>
        </Button>
      </div>

      <StatsGrid stats={stats} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Latest updates in this workspace</CardDescription>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <EmptyState
                title="Nothing here yet"
                description="Create a project or add a user to see activity."
                icon={ActivityIcon}
                className="py-8"
              />
            ) : (
              <ul className="flex flex-col">
                {activities.slice(0, 6).map((activity, index) => {
                  const Icon = ACTIVITY_ICON[activity.type];
                  return (
                    <li key={activity.id}>
                      {index > 0 && <Separator className="my-3" />}
                      <div className="flex items-start gap-3">
                        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="flex min-w-0 flex-1 flex-col">
                          <span className="truncate text-sm">
                            {activity.message}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatWhen(activity.at)}
                          </span>
                        </div>
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
            <CardTitle>Projects by team</CardTitle>
            <CardDescription>Split across delivery teams</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {TEAMS.map((team) => (
              <div key={team} className="flex items-center justify-between">
                <Badge variant={team === "HubSpot" ? "warning" : "info"}>
                  {team}
                </Badge>
                <span className="text-sm font-medium">
                  {projects.filter((p) => p.team === team).length}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </PageContainer>
  );
}
