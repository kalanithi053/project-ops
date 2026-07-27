"use client";

import { useParams } from "next/navigation";

import { TaskBoard } from "@/components/projects/task-board";
import { useProject } from "@/lib/api/hooks/use-projects";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";

export default function ProjectBoardPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();
  const { data: project } = useProject(workspace, projectId);
  const { can } = usePermissions(workspace);

  return (
    <TaskBoard
      workspaceSlug={workspace}
      projectId={projectId}
      canCreate={can(PERMISSIONS.TASK_CREATE)}
      canUpdate={can(PERMISSIONS.TASK_UPDATE)}
      // Plan-driven project types reject tasks that aren't filed under a
      // module instance, so the task form has to require one.
      requiresModule={Boolean(project?.projectType?.isPlanAdd)}
    />
  );
}
