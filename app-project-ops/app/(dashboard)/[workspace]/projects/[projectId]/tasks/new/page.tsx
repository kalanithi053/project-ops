"use client";

import { useParams, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

/** Legacy route — the create flow now lives at work-items/new. */
export default function NewTaskPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  React.useEffect(() => {
    const query = searchParams.toString();
    router.replace(
      `/${workspace}/projects/${projectId}/work-items/new${query ? `?${query}` : ""}`,
    );
  }, [workspace, projectId, searchParams, router]);

  return null;
}
