"use client";

import { useParams } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";

/**
 * Shell for the settings area: page heading plus the persistent section
 * rail, with each section rendered as a nested route.
 *
 * Sections deliberately don't receive data through this layout. They each
 * call useWorkspaceSettings(), which resolves to the same cached
 * GET /workspace/settings response — so switching sections is instant and
 * costs no extra requests, while every section stays independently
 * deep-linkable.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace } = useParams<{ workspace: string }>();

  return (
    <PageContainer className="flex flex-col gap-6">
      <PageHeader
        title="Settings"
        description="Manage your workspace configuration, access control and project structure."
      />

      <div className="flex flex-col gap-6 md:flex-row md:gap-8">
        <SettingsSidebar workspaceSlug={workspace} />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </PageContainer>
  );
}

