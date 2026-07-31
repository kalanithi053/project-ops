import { cn } from "@/lib/utils";
import { navigationConfig } from "@/config/navigation";
import { NavItems } from "@/components/layout/nav-items";
import { BrandLink } from "@/components/layout/brand-link";

interface AppSidebarProps {
  collapsed: boolean;
  permissions: string[];
}

/**
 * Persistent desktop navigation rail. Hidden on mobile in favor of the
 * Sheet-based MobileSidebar so it never permanently consumes screen
 * width on small viewports.
 */
export function AppSidebar({ collapsed, permissions }: AppSidebarProps) {
  return (
    <aside
      className={cn(
        "hidden h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 md:flex",
        collapsed ? "w-16" : "w-64",
      )}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <BrandLink showName={!collapsed} />
      </div>

      <div className="flex-1 overflow-y-auto py-4">
        <NavItems
          sections={navigationConfig}
          permissions={permissions}
          collapsed={collapsed}
        />
      </div>
    </aside>
  );
}
