"use client";

import { useParams, useRouter } from "next/navigation";
import * as React from "react";

/** Legacy route — task editing now lives at work-items/:workItemId. */
export default function EditTaskPage() {
  const { workspace, projectId, taskId } = useParams<{
    workspace: string;
    projectId: string;
    taskId: string;
  }>();
  const router = useRouter();

  React.useEffect(() => {
    router.replace(`/${workspace}/projects/${projectId}/work-items/${taskId}`);
  }, [workspace, projectId, taskId, router]);

  return null;
}
