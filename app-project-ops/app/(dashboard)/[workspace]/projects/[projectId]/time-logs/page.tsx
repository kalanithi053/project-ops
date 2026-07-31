"use client";

import { useParams } from "next/navigation";

import { ProjectTimeLogsBoard } from "@/components/projects/project-time-logs-board";

export default function ProjectTimeLogsPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();

  return (
    <ProjectTimeLogsBoard workspaceSlug={workspace} projectId={projectId} />
  );
}
