"use client";

import { useParams } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { ModulePanels } from "@/components/shared/module-panels";
import { PlansSection } from "@/components/shared/plans-section";
import { CardsSkeleton } from "@/components/shared/skeletons";
import { Separator } from "@/components/ui/separator";
import { useTenant } from "@/lib/tenant/tenant-context";
import { useMe } from "@/lib/api/hooks/use-users";
import { useProjects } from "@/lib/api/hooks/use-projects";
import { useWorkspaceMembers } from "@/lib/api/hooks/use-members";
import type { Panel } from "@/types/module";

const WORKSPACE_DOMAIN = "projectops.app";

export default function SettingsPage() {
  const { workspace } = useParams<{ workspace: string }>();
  const { tenant } = useTenant();
  const { data: me } = useMe();
  const { data: projects, isLoading } = useProjects(workspace);
  const { data: members } = useWorkspaceMembers(workspace);

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

      <PlansSection workspaceSlug={workspace} />
    </PageContainer>
  );
}
