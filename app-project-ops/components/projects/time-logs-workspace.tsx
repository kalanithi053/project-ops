"use client";

import * as React from "react";

import { TimeLogsBoard } from "@/components/projects/time-logs-board";
import { useTimeLogsRange } from "@/components/projects/use-time-logs-range";
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

  return (
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
  );
}
