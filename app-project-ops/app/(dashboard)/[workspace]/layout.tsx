"use client";

import { useParams } from "next/navigation";

import { AuthGuard } from "@/components/auth/auth-guard";
import { TenantProvider } from "@/lib/tenant/tenant-context";
import { WorkspaceShell } from "@/components/layout/workspace-shell";
import { WorkspacePrefetcher } from "@/components/providers/workspace-prefetcher";

/**
 * Shared layout for every workspace-scoped route (`/{workspace}/…`).
 *
 * The `[workspace]` slug is the source of truth for the active tenant:
 * it drives the header/nav and is sent as `x-workspace-slug` on API
 * calls. `AuthGuard` blocks the area for signed-out users, `WorkspaceShell`
 * loads the real profile, and `TenantProvider` resolves the workspace
 * list from GET /workspaces/me.
 */
export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace } = useParams<{ workspace: string }>();

  return (
    <AuthGuard>
      <TenantProvider slug={workspace}>
        <WorkspacePrefetcher slug={workspace} />
        <WorkspaceShell>{children}</WorkspaceShell>
      </TenantProvider>
    </AuthGuard>
  );
}
