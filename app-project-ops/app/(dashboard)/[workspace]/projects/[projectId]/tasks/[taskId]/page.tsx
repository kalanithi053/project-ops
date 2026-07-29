"use client";

import { useParams } from "next/navigation";

import { TaskEditor } from "@/components/projects/task-editor";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton } from "@/components/shared/skeletons";
import { usePermissions } from "@/lib/api/hooks/use-permissions";
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
  const { can } = usePermissions(workspace);

  function finish() {
    notifyTaskBoard(workspace, projectId);
  }

  return (
    <QueryState
      isLoading={taskQuery.isLoading}
      isError={taskQuery.isError}
      error={taskQuery.error}
      onRetry={() => taskQuery.refetch()}
      skeleton={<CardsSkeleton count={1} />}
      errorLabel="The task could not be loaded."
    >
      {taskQuery.data ? (
        <TaskEditor
          workspaceSlug={workspace}
          projectId={projectId}
          task={taskQuery.data}
          canSave={can(PERMISSIONS.TASK_UPDATE)}
          canComment={can(PERMISSIONS.COMMENT_CREATE)}
          onDone={finish}
        />
      ) : null}
    </QueryState>
  );
}
