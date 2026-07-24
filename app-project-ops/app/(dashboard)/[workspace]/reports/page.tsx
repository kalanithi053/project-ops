"use client";

import { useParams } from "next/navigation";
import {
  Activity as ActivityIcon,
  Building2,
  FolderKanban,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { StatsGrid } from "@/components/shared/stats-grid";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useWorkspaceData, type ActivityType } from "@/lib/workspace/data";

const ACTIVITY_ICON: Record<ActivityType, LucideIcon> = {
  project: FolderKanban,
  member: UserPlus,
  workspace: Building2,
};

/** ISO → "2026-07-23 · 09:41" (deterministic; no locale/timezone drift). */
function formatWhen(iso: string) {
  if (iso.length < 16) return iso;
  return `${iso.slice(0, 10)} · ${iso.slice(11, 16)}`;
}

export default function ReportsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { activities, projects, members } = useWorkspaceData(workspace);

  const stats = [
    { label: "Total Activity", value: activities.length, icon: ActivityIcon },
    { label: "Projects Created", value: projects.length, icon: FolderKanban },
    { label: "Users Added", value: members.length, icon: UserPlus },
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="Reports"
        description="Everything that's happened across this workspace."
      />

      <StatsGrid stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle>Activity feed</CardTitle>
          <CardDescription>Most recent first</CardDescription>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <EmptyState
              title="No activity yet"
              description="Create a project or add a user and it'll show up here."
              icon={ActivityIcon}
              className="py-10"
            />
          ) : (
            <ul className="flex flex-col">
              {activities.map((activity, index) => {
                const Icon = ACTIVITY_ICON[activity.type];
                return (
                  <li key={activity.id}>
                    {index > 0 && <Separator className="my-3" />}
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm">{activity.message}</span>
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
    </PageContainer>
  );
}
