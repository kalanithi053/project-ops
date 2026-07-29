"use client";

import { useParams } from "next/navigation";

import { TaskWorkItems } from "@/components/projects/task-work-items";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";

export default function ProjectWorkItemsPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();
  const { can } = usePermissions(workspace);

  return (
    <TaskWorkItems
      workspaceSlug={workspace}
      projectId={projectId}
      canCreate={can(PERMISSIONS.TASK_CREATE)}
      canCreateIncident={can(PERMISSIONS.INCIDENT_CREATE)}
    />
  );
}
