"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";

import { notifyTaskBoard } from "@/lib/tasks/tab-sync";

/** Legacy route — the create flow now lives at work-items/new. */
export default function NewTaskPage() {
  const router = useRouter();
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();
  const searchParams = useSearchParams();

  function finish() {
    notifyTaskBoard(workspace, projectId);
    router.replace(`/${workspace}/projects/${projectId}/work-items`);
  }

  return null;
}
