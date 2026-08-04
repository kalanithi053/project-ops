"use client";

import { useParams } from "next/navigation";

import { ProjectAttachments } from "@/components/projects/project-attachments";
import { useProjectPermissions } from "@/lib/api/hooks/use-project-members";
import { PERMISSIONS } from "@/lib/api/permissions";

export default function ProjectAttachmentsPage() {
  const { workspace, projectId } = useParams<{
    workspace: string;
    projectId: string;
  }>();
  const { can } = useProjectPermissions(workspace, projectId);

  return (
    <ProjectAttachments
      workspaceSlug={workspace}
      projectId={projectId}
      canCreate={can(PERMISSIONS.ATTACHMENT_CREATE)}
      canDelete={can(PERMISSIONS.ATTACHMENT_DELETE)}
    />
  );
}
