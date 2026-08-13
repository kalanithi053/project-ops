"use client";

import { Clock, FolderKanban, ListChecks, Users } from "lucide-react";
import * as React from "react";

import { TimeLogsBoard } from "@/components/projects/time-logs-board";
import { useTimeLogsRange } from "@/components/projects/use-time-logs-range";
import { BentoGrid, BentoTile } from "@/components/shared/bento-grid";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { useProjects } from "@/lib/api/hooks/use-projects";
import { useWorkspaceTimeLogs } from "@/lib/api/hooks/use-time-logs";
import { getFullname } from "@/lib/utils";

/**
 * Workspace-wide Time Logs page: pools time logged across every project in
 * the workspace into the shared `TimeLogsBoard` UI (day/week/month/range
 * date window, grid/list views). The per-project Time Logs tab uses the same
 * board via `ProjectTimeLogsBoard`, scoped to one project.
 */
export function TimeLogsWorkspace({
  workspaceSlug,
}: {
  workspaceSlug: string;
}) {
  const [userId, setUserId] = React.useState("");
  const range = useTimeLogsRange();

  const membersQuery = useWorkspaceMembers(workspaceSlug);
  const projectsQuery = useProjects(workspaceSlug);
  const timeLogsQuery = useWorkspaceTimeLogs(workspaceSlug, {
    startDate: range.startDate,
    endDate: range.endDate,
    ...(userId ? { userId } : {}),
  });

  const members = React.useMemo(
    () =>
      (membersQuery.data ?? [])
        .filter((member) => member.status !== "removed" && member.user?.id)
        .map((member) => ({
          id: member.user?.id ?? "",
          name: getFullname(member.user) ?? member.user?.email ?? "Unknown user",
        })),
    [membersQuery.data],
  );
  const projectRoster = React.useMemo(
    () =>
      (projectsQuery.data ?? []).map((project) => ({
        id: project.id,
        name: project.name,
      })),
    [projectsQuery.data],
  );
  const entries = React.useMemo(
    () => timeLogsQuery.data ?? [],
    [timeLogsQuery.data],
  );

  const isLoading =
    membersQuery.isLoading || projectsQuery.isLoading || timeLogsQuery.isLoading;
  const isError =
    membersQuery.isError || projectsQuery.isError || timeLogsQuery.isError;

  const totalHours = entries.reduce((sum, e) => sum + e.durationMinutes, 0) / 60;
  const contributorCount = new Set(entries.map((e) => e.userId)).size;
  const projectCount = new Set(entries.map((e) => e.projectId)).size;

  return (
    <div className="flex flex-col gap-6">
      {!isLoading && !isError && (
        <BentoGrid>
          <BentoTile className="col-span-2 justify-between sm:col-span-2 sm:row-span-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Hours Logged
              </span>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-3xl font-semibold">
              {totalHours.toFixed(1)}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                hrs
              </span>
            </p>
          </BentoTile>

          <BentoTile>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Entries
              </span>
              <ListChecks className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold">{entries.length}</p>
          </BentoTile>

          <BentoTile>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Contributors
              </span>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold">{contributorCount}</p>
          </BentoTile>

          <BentoTile className="col-span-2 sm:col-span-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                Projects
              </span>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold">{projectCount}</p>
          </BentoTile>
        </BentoGrid>
      )}

      <TimeLogsBoard
        workspaceSlug={workspaceSlug}
        range={range}
        userId={userId}
        onUserIdChange={setUserId}
        members={members}
        projectRoster={projectRoster}
        entries={entries}
        isLoading={isLoading}
        isError={isError}
        error={membersQuery.error ?? projectsQuery.error ?? timeLogsQuery.error}
        onRetry={() => {
          membersQuery.refetch();
          projectsQuery.refetch();
          timeLogsQuery.refetch();
        }}
      />
    </div>
  );
}
