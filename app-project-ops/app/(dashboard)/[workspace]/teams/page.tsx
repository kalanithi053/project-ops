"use client";

import { useParams } from "next/navigation";
import { FolderKanban, Users, UsersRound } from "lucide-react";

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
import { TEAMS, useWorkspaceData } from "@/lib/workspace/data";

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export default function TeamsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { members, projects } = useWorkspaceData(workspace);

  const stats = [
    { label: "Teams", value: TEAMS.length, icon: UsersRound },
    { label: "People", value: members.length, icon: Users },
    { label: "Projects", value: projects.length, icon: FolderKanban },
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="Teams"
        description="The two delivery teams in this workspace and who's on them."
      />

      <StatsGrid stats={stats} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {TEAMS.map((team) => {
          const teamMembers = members.filter((m) => m.team === team);
          const teamProjects = projects.filter((p) => p.team === team);
          return (
            <Card key={team}>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div className="flex flex-col gap-1">
                  <CardTitle>{team}</CardTitle>
                  <CardDescription>
                    {teamMembers.length} member
                    {teamMembers.length === 1 ? "" : "s"} ·{" "}
                    {teamProjects.length} project
                    {teamProjects.length === 1 ? "" : "s"}
                  </CardDescription>
                </div>
                <UsersRound className="h-5 w-5 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {teamMembers.length === 0 ? (
                  <EmptyState
                    title="No members yet"
                    description="Add users on the Users page and assign them here."
                    icon={Users}
                    className="py-8"
                  />
                ) : (
                  <ul className="flex flex-col">
                    {teamMembers.map((member, index) => (
                      <li key={member.id}>
                        {index > 0 && <Separator className="my-3" />}
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
                            {initials(member.name)}
                          </span>
                          <div className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-medium">
                              {member.name}
                            </span>
                            <span className="truncate text-xs text-muted-foreground">
                              {member.role} · {member.email}
                            </span>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
