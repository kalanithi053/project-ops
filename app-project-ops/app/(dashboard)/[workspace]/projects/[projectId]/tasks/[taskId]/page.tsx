"use client";

import { useParams, useRouter } from "next/navigation";

import { notifyTaskBoard } from "@/lib/tasks/tab-sync";

/** Legacy route — task editing now lives at work-items/:workItemId. */
export default function EditTaskPage() {
  const router = useRouter();
  const { workspace, projectId, taskId } = useParams<{
    workspace: string;
    projectId: string;
    taskId: string;
  }>();

  function finish() {
    notifyTaskBoard(workspace, projectId);
    router.replace(`/${workspace}/projects/${projectId}/work-items`);
  }

  return null;
}
