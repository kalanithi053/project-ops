"use client";

import * as React from "react";
import { useParams } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { ModulePanels } from "@/components/shared/module-panels";
import { PlansSection } from "@/components/shared/plans-section";
import { CardsSkeleton } from "@/components/shared/skeletons";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { SelectField, type SelectOption } from "@/components/shared/select-field";
import { useTenant } from "@/lib/tenant/tenant-context";
import { useMe } from "@/lib/api/hooks/use-users";
import { useProjects } from "@/lib/api/hooks/use-projects";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import { useProjectTypes } from "@/lib/api/hooks/use-project-types";
import type { Panel } from "@/types/module";

const WORKSPACE_DOMAIN = "projectops.app";

export default function SettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { tenant } = useTenant();
  const { data: me } = useMe();
  const { data: projects, isLoading } = useProjects(workspace);
  const { data: members } = useWorkspaceMembers(workspace);
  const { data: projectTypes, isLoading: typesLoading } =
    useProjectTypes(workspace);

  // `projectTypeId` is only set once the user explicitly picks one; until
  // then, default to the first loaded type (derived, not stored) so there's
  // no effect-driven setState render cascade.
  const [projectTypeId, setProjectTypeId] = React.useState<string>();
  const selectedTypeId =
    projectTypeId ??
    (projectTypes && projectTypes.length > 0
      ? String(projectTypes[0].id)
      : undefined);

  const typeOptions: SelectOption[] = (projectTypes ?? []).map((type) => ({
    label: type.name,
    value: String(type.id),
  }));

  const fullName =
    [me?.firstName, me?.lastName].filter(Boolean).join(" ").trim() ||
    me?.username ||
    "—";

  const panels: Panel[] = [
    {
      type: "fields",
      title: "Workspace",
      description: "Core details for this workspace",
      items: [
        { label: "Name", value: tenant.name },
        { label: "URL", value: `${WORKSPACE_DOMAIN}/${tenant.slug}` },
        { label: "Workspace ID", value: tenant.id },
      ],
    },
    {
      type: "fields",
      title: "Usage",
      description: "What's inside this workspace",
      items: [
        { label: "Projects", value: String((projects ?? []).length) },
        { label: "Members", value: String((members ?? []).length) },
      ],
    },
    {
      type: "fields",
      title: "Your account",
      description: "From your profile",
      items: [
        { label: "Name", value: fullName },
        { label: "Username", value: me?.username ?? "—" },
        { label: "Email", value: me?.email ?? "—" },
      ],
    },
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Configuration for this workspace."
      />
      {isLoading ? <CardsSkeleton count={3} /> : <ModulePanels panels={panels} />}

      <Separator />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-sm font-medium">Plans</h2>
          <p className="text-sm text-muted-foreground">
            Choose a project type to see the plans and modules it provisions.
          </p>
        </div>

        <div className="flex flex-col gap-2 sm:max-w-xs">
          <Label htmlFor="project-type">Project type</Label>
          <SelectField
            id="project-type"
            aria-label="Project type"
            options={typeOptions}
            value={selectedTypeId}
            onValueChange={setProjectTypeId}
            placeholder={typesLoading ? "Loading…" : "Select a project type"}
            disabled={typesLoading || typeOptions.length === 0}
          />
        </div>

        <PlansSection workspaceSlug={workspace} projectTypeId={selectedTypeId} />
      </div>
    </PageContainer>
  );
}
