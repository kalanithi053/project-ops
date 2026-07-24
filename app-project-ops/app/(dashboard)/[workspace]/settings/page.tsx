"use client";

import { useParams } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { ModulePanels } from "@/components/shared/module-panels";
import { useTenant } from "@/lib/tenant/tenant-context";
import { useWorkspaceData } from "@/lib/workspace/data";
import type { Panel } from "@/types/module";

const WORKSPACE_DOMAIN = "projectops.app";

export default function SettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { tenant } = useTenant();
  const { projects, members } = useWorkspaceData(workspace);

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
        { label: "Projects", value: String(projects.length) },
        { label: "Users", value: String(members.length) },
        { label: "Teams", value: "HubSpot, Dev Team" },
      ],
    },
  ];

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Configuration for this workspace."
      />
      <ModulePanels panels={panels} />
    </PageContainer>
  );
}
