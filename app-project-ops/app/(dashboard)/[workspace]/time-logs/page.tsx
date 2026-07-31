"use client";

import { FolderKanban } from "lucide-react";
import { useParams } from "next/navigation";
import * as React from "react";

import { PageContainer } from "@/components/layout/page-container";
import { TimeLogsView } from "@/components/projects/time-logs-view";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { QueryState } from "@/components/shared/query-state";
import {
  SelectField,
  type SelectOption,
} from "@/components/shared/select-field";
import { CardsSkeleton } from "@/components/shared/skeletons";
import { useProjects } from "@/lib/api/hooks/use-projects";

/**
 * Workspace-level time log: pick a project (defaults to the first one) and
 * see its time-log entries, reusing the same view as the project tab.
 */
export default function WorkspaceTimeLogsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const projectsQuery = useProjects(workspace);
  const projects = React.useMemo(
    () => projectsQuery.data ?? [],
    [projectsQuery.data],
  );

  // Only set once the user explicitly picks a project; until then the
  // first loaded project is used, derived rather than stored so there's no
  // effect-driven render cascade.
  const [projectId, setProjectId] = React.useState<string>();
  const selectedProjectId = projectId ?? projects[0]?.id;

  const projectOptions: SelectOption[] = projects.map((project) => ({
    label: project.name,
    value: project.id,
  }));

  return (
    <PageContainer className="flex flex-col gap-6">
      {/* <PageHeader
        title="Time log"
        description="Hours logged against a project's work items."
      /> */}

      <QueryState
        isLoading={projectsQuery.isLoading}
        isError={projectsQuery.isError}
        error={projectsQuery.error}
        onRetry={() => projectsQuery.refetch()}
        skeleton={<CardsSkeleton count={2} />}
      >
        {projects.length === 0 ? (
          <EmptyState
            icon={FolderKanban}
            title="No projects yet"
            description="Create a project to start logging time against it."
          />
        ) : (
          selectedProjectId && (
            <TimeLogsView
              workspaceSlug={workspace}
              projectId={selectedProjectId}
              projectSelector={
                <SelectField
                  id="time-logs-project"
                  aria-label="Project"
                  options={projectOptions}
                  value={selectedProjectId}
                  onValueChange={setProjectId}
                  placeholder="Select a project"
                  className="w-48"
                />
              }
            />
          )
        )}
      </QueryState>
    </PageContainer>
  );
}
