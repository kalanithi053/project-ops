"use client";

import { Download } from "lucide-react";
import * as React from "react";

import { TimeLogsBoard } from "@/components/projects/time-logs-board";
import { useTimeLogsRange } from "@/components/projects/use-time-logs-range";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProject } from "@/lib/api/hooks/use-projects";
import { useProjectMembers } from "@/lib/api/hooks/use-project-members";
import { useProjectTimeLogs } from "@/lib/api/hooks/use-time-logs";
import {
  exportTimeLogs,
  type TimeLogsExportFormat,
} from "@/lib/time-logs-export";
import { getFullname } from "@/lib/utils";

/**
 * Per-project Time Logs tab — the same day/week/month/range `TimeLogsBoard`
 * UI as the workspace-wide page, scoped to this one project's entries, plus
 * an Export control (CSV or Excel) the workspace-wide page doesn't have.
 */
export function ProjectTimeLogsBoard({
  workspaceSlug,
  projectId,
}: {
  workspaceSlug: string;
  projectId: string;
}) {
  const [userId, setUserId] = React.useState("");
  const range = useTimeLogsRange();

  const membersQuery = useProjectMembers(workspaceSlug, projectId);
  const projectQuery = useProject(workspaceSlug, projectId);
  const timeLogsQuery = useProjectTimeLogs(workspaceSlug, projectId, {
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
  const entries = React.useMemo(
    () => timeLogsQuery.data ?? [],
    [timeLogsQuery.data],
  );

  const isLoading =
    membersQuery.isLoading || projectQuery.isLoading || timeLogsQuery.isLoading;
  const isError =
    membersQuery.isError || projectQuery.isError || timeLogsQuery.isError;

  function handleExport(format: TimeLogsExportFormat) {
    exportTimeLogs(entries, format, {
      filenamePrefix: `time-logs-${projectId}`,
      summary: [
        ["Project", projectQuery.data?.name ?? ""],
        ["Date range", `${range.startDate} to ${range.endDate}`],
      ],
    });
  }

  return (
    <TimeLogsBoard
      workspaceSlug={workspaceSlug}
      range={range}
      userId={userId}
      onUserIdChange={setUserId}
      members={members}
      projectRoster={[]}
      entries={entries}
      showProject={false}
      isLoading={isLoading}
      isError={isError}
      error={membersQuery.error ?? projectQuery.error ?? timeLogsQuery.error}
      onRetry={() => {
        membersQuery.refetch();
        projectQuery.refetch();
        timeLogsQuery.refetch();
      }}
      title="Time Logs"
      description="Every hour logged across this project's work items."
      headerAction={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" disabled={entries.length === 0}>
              <Download className="h-4 w-4" />
              Export
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => handleExport("csv")}>
              Export as CSV
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => handleExport("xlsx")}>
              Export as Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
    />
  );
}
