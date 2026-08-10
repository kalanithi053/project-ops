"use client";

import { useParams, useRouter } from "next/navigation";

import { TaskEditor } from "@/components/projects/task-editor";
import { QueryState } from "@/components/shared/query-state";
import { FormSkeleton } from "@/components/shared/skeletons";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
import { useProjectPermissions } from "@/lib/api/hooks/use-project-members";
import { useTask } from "@/lib/api/hooks/use-tasks";
import { PERMISSIONS } from "@/lib/api/permissions";
import { notifyTaskBoard } from "@/lib/tasks/tab-sync";

export default function EditTaskPage() {
  const { workspace, projectId, taskId } = useParams<{
    workspace: string;
    projectId: string;
    taskId: string;
  }>();
  const taskQuery = useTask(workspace, projectId, taskId);
  const router = useRouter();
  const { can } = usePermissions(workspace);
  // WORKITEM_UPDATE (and who counts as "Client") is enforced against the
  // caller's *project* role, not their workspace role — see
  // useProjectPermissions' own doc comment and WorkItemsService's
  // project-member role lookup — so canSave/roleName come from here, not
  // the workspace-scoped `can` above.
  const { can: canInProject, roleName } = useProjectPermissions(
    workspace,
    projectId,
  );

  function cancel() {
    notifyTaskBoard(workspace, projectId);
    router.push(`/${workspace}/projects/${projectId}/work-items`);
  }

  function saved(workItemId: string) {
    notifyTaskBoard(workspace, projectId);
    router.push(`/${workspace}/projects/${projectId}/work-items/${workItemId}`);
  }

  return (
    <QueryState
      isLoading={taskQuery.isLoading}
      isError={taskQuery.isError}
      error={taskQuery.error}
      onRetry={() => taskQuery.refetch()}
      skeleton={<FormSkeleton />}
      errorLabel="The task could not be loaded."
    >
      {taskQuery.data ? (
        <TaskEditor
          workspaceSlug={workspace}
          projectId={projectId}
          task={taskQuery.data}
          canSave={canInProject(PERMISSIONS.WORKITEM_UPDATE)}
          roleName={roleName}
          canComment={can(PERMISSIONS.COMMENT_CREATE)}
          canCreateAttachment={can(PERMISSIONS.ATTACHMENT_CREATE)}
          canDeleteAttachment={can(PERMISSIONS.ATTACHMENT_DELETE)}
          onDone={cancel}
          onSaved={saved}
        />
      ) : null}
    </QueryState>
  );
}
