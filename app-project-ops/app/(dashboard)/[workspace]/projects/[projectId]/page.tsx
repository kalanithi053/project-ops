"use client";

import { useParams } from "next/navigation";

import { TaskWorkItems } from "@/components/projects/task-work-items";
import { useProjectPermissions } from "@/lib/api/hooks/use-project-members";
import { PERMISSIONS } from "@/lib/api/permissions";

export default function ProjectWorkItemsPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();
  const { can, roleName } = useProjectPermissions(workspace, projectId);

  return (
    <TaskWorkItems
      workspaceSlug={workspace}
      projectId={projectId}
      canCreate={can(PERMISSIONS.WORKITEM_CREATE)}
      canUpdate={can(PERMISSIONS.WORKITEM_UPDATE)}
      roleName={roleName}
    />
  );
}
