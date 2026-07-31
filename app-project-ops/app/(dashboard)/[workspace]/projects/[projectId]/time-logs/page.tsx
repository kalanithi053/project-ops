"use client";

import { useParams } from "next/navigation";

import { TimeLogsView } from "@/components/projects/time-logs-view";

export default function ProjectTimeLogsPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();

  return (
    <TimeLogsView workspaceSlug={workspace} projectId={projectId} sticky />
  );
}
