import { TenantProvider } from "@/lib/tenant/tenant-context";
import { AppShell } from "@/components/layout/app-shell";
import { mockCurrentUser, mockNotifications } from "@/lib/mock/data";

/**
 * Shared layout for every workspace-scoped route (`/{workspace}/…`).
 * The `[workspace]` slug is the source of truth for the active tenant —
 * it's handed to TenantProvider so the header, nav, and data all align
 * with the URL. This is also where the real session lookup will live
 * once auth exists; today it feeds mock user/notifications into the
 * shell the same way the session will later.
 */
export default async function WorkspaceLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspace: string }>;
}) {
  const { workspace } = await params;

  return (
    <TenantProvider slug={workspace}>
      <AppShell user={mockCurrentUser} notifications={mockNotifications}>
        {children}
      </AppShell>
    </TenantProvider>
  );
}
