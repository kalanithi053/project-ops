"use client";

import { useParams } from "next/navigation";

import { TaskBoard } from "@/components/projects/task-board";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";

export default function ProjectBoardPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();
  const { can } = usePermissions(workspace);

  return (
    <TaskBoard
      workspaceSlug={workspace}
      projectId={projectId}
      canCreate={can(PERMISSIONS.TASK_CREATE)}
      canUpdate={can(PERMISSIONS.TASK_UPDATE)}
    />
  );
}
