"use client";

import { useParams } from "next/navigation";

import { IncidentEditor } from "@/components/projects/incident-editor";
import { QueryState } from "@/components/shared/query-state";
import { CardsSkeleton } from "@/components/shared/skeletons";
import { useIncident } from "@/lib/api/hooks/use-incidents";
import { useProjectPermissions } from "@/lib/api/hooks/use-project-members";
import { PERMISSIONS } from "@/lib/api/permissions";

export default function EditIncidentPage() {
  const { workspace, projectId, incidentId } = useParams<{
    workspace: string;
    projectId: string;
    incidentId: string;
  }>();
  const incidentQuery = useIncident(workspace, projectId, incidentId);
  const { can } = useProjectPermissions(workspace, projectId);

  return (
    <QueryState
      isLoading={incidentQuery.isLoading}
      isError={incidentQuery.isError}
      error={incidentQuery.error}
      onRetry={() => incidentQuery.refetch()}
      skeleton={<CardsSkeleton count={1} />}
      errorLabel="The incident could not be loaded."
    >
      {incidentQuery.data ? (
        <IncidentEditor
          workspaceSlug={workspace}
          projectId={projectId}
          incident={incidentQuery.data}
          canComment={can(PERMISSIONS.COMMENT_CREATE)}
        />
      ) : null}
    </QueryState>
  );
}
