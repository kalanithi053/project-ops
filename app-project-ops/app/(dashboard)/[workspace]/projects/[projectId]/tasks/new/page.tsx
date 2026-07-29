"use client";

import { useParams, useSearchParams } from "next/navigation";

import { TaskEditor } from "@/components/projects/task-editor";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { PERMISSIONS } from "@/lib/api/permissions";
import { notifyTaskBoard } from "@/lib/tasks/tab-sync";

export default function NewTaskPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();
  const searchParams = useSearchParams();
  const { can } = usePermissions(workspace);

  function finish() {
    notifyTaskBoard(workspace, projectId);
  }

  return (
    <TaskEditor
      workspaceSlug={workspace}
      projectId={projectId}
      task={null}
      defaultStatusId={searchParams.get("statusId") ?? undefined}
      canSave={can(PERMISSIONS.TASK_CREATE)}
      canComment={can(PERMISSIONS.COMMENT_CREATE)}
      onDone={finish}
    />
  );
}
