"use client";

import { useParams, useSearchParams } from "next/navigation";

import { TaskEditor } from "@/components/projects/task-editor";
import { useProjectPermissions } from "@/lib/api/hooks/use-project-members";
import { PERMISSIONS } from "@/lib/api/permissions";
import { notifyTaskBoard } from "@/lib/tasks/tab-sync";

export default function NewTaskPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();
  const searchParams = useSearchParams();
  const { can } = useProjectPermissions(workspace, projectId);

  function finish() {
    notifyTaskBoard(workspace, projectId);
  }

  return (
    <TaskEditor
      workspaceSlug={workspace}
      projectId={projectId}
      task={null}
      defaultStatusId={searchParams.get("statusId") ?? undefined}
      defaultWorkItemTypeId={searchParams.get("workItemTypeId") ?? undefined}
      canSave={can(PERMISSIONS.WORKITEM_CREATE)}
      canComment={can(PERMISSIONS.COMMENT_CREATE)}
      onDone={finish}
    />
  );
}
