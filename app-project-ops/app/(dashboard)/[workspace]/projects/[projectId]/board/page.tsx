"use client";

import { useParams, useRouter } from "next/navigation";
import * as React from "react";

/**
 * The Board and Work items tabs merged into one page with a List/Kanban
 * toggle. This route just redirects old links/bookmarks there, defaulting
 * the toggle to Kanban so the destination still feels like "Board".
 */
export default function ProjectBoardPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();
  const router = useRouter();

  React.useEffect(() => {
    try {
      window.localStorage.setItem(
        `project-ops:work-items-view:${workspace}:${projectId}`,
        "kanban",
      );
    } catch {}
    router.replace(`/${workspace}/projects/${projectId}/work-items`);
  }, [workspace, projectId, router]);

  return null;
}
