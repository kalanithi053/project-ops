"use client";

import { useParams } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { TimeLogsWorkspace } from "@/components/projects/time-logs-workspace";
import { PageHeader } from "@/components/shared/page-header";

export default function WorkspaceTimeLogsPage() {
  const { workspace } = useParams<{ workspace: string }>();

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="Time log"
        description="Hours logged across every project in the workspace."
      />
      <TimeLogsWorkspace workspaceSlug={workspace} />
    </PageContainer>
  );
}
