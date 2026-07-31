"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";

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
  const router = useRouter();
  const { can } = usePermissions(workspace);

  function cancel() {
    notifyTaskBoard(workspace, projectId);
    router.push(`/${workspace}/projects/${projectId}/work-items`);
  }

  function saved(workItemId: string) {
    notifyTaskBoard(workspace, projectId);
    router.push(`/${workspace}/projects/${projectId}/work-items/${workItemId}`);
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
      onDone={cancel}
      onSaved={saved}
    />
  );
}
