"use client";

import type { AuthUser, Notification } from "@/types/auth";
import { useSidebar } from "@/hooks/use-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { AppHeader } from "@/components/layout/app-header";
import { ErrorBoundary } from "@/components/shared/error-boundary";

interface AppShellProps {
  user: AuthUser;
  notifications: Notification[];
  children: React.ReactNode;
}

/**
 * Composes the persistent chrome (sidebar + header) around routed page
 * content. This is the only piece of the shell that needs to be a
 * Client Component — it owns the collapsed/mobile-open UI state that
 * the sidebar and header both read from. Everything nested inside it
 * (dashboard pages, etc.) can remain a Server Component.
 */
export function AppShell({ user, notifications, children }: AppShellProps) {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();

  return (
    <TooltipProvider>
      <div className="flex min-h-screen bg-background">
        <AppSidebar collapsed={collapsed} permissions={user.permissions} />
        <MobileSidebar
          open={mobileOpen}
          onOpenChange={setMobileOpen}
          permissions={user.permissions}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader
            user={user}
            notifications={notifications}
            onOpenMobileNav={() => setMobileOpen(true)}
            onToggleSidebar={toggleCollapsed}
          />
          <main className="flex-1">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
