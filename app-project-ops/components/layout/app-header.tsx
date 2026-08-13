import { Menu, PanelLeft } from "lucide-react";

import type { AuthUser, Notification } from "@/types/auth";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { GlobalSearch } from "@/components/layout/global-search";
import { TenantSelector } from "@/components/layout/tenant-selector";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationsMenu } from "@/components/layout/notifications-menu";
import { TimerHeaderWidget } from "@/components/layout/timer-header-widget";

interface AppHeaderProps {
  user: AuthUser;
  notifications: Notification[];
  onOpenMobileNav: () => void;
  onToggleSidebar: () => void;
}

/**
 * Top application bar. Stays usable regardless of desktop sidebar
 * collapsed state since it's a sibling, not a child, of the sidebar.
 */
export function AppHeader({
  user,
  notifications,
  onOpenMobileNav,
  onToggleSidebar,
}: AppHeaderProps) {
  return (
    <header className="z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border bg-background px-4">
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Open navigation menu"
        onClick={onOpenMobileNav}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        aria-label="Toggle sidebar"
        onClick={onToggleSidebar}
      >
        <PanelLeft className="h-4 w-4" />
      </Button>

      <Breadcrumbs />

      <div className="ml-auto flex items-center gap-2">
        <GlobalSearch />
        <TenantSelector />
        <TimerHeaderWidget />
        <NotificationsMenu notifications={notifications} />
        <UserMenu user={user} />
      </div>
    </header>
  );
}
