"use client";

import { useParams } from "next/navigation";

import { PageContainer } from "@/components/layout/page-container";
import { PageHeader } from "@/components/shared/page-header";
import { SettingsSidebar } from "@/components/settings/settings-sidebar";

/**
 * Shell for the settings area: page heading plus a bento grid of section
 * tiles, with each section rendered as a nested route below it.
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
      <div className="sticky top-0 z-30 -mx-4 flex flex-col gap-6 border-b border-border bg-background px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <PageHeader
          title="Settings"
          description="Manage your workspace configuration, access control and project structure."
        />

        <SettingsSidebar workspaceSlug={workspace} />
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </PageContainer>
  );
}
