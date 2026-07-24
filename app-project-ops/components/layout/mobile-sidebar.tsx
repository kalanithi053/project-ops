"use client";

import { navigationConfig } from "@/config/navigation";
import { NavItems } from "@/components/layout/nav-items";
import { BrandLink } from "@/components/layout/brand-link";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  permissions: string[];
}

/**
 * Mobile-only navigation drawer. Reuses the same configuration-driven
 * NavItems renderer as the desktop sidebar so the two never drift.
 */
export function MobileSidebar({
  open,
  onOpenChange,
  permissions,
}: MobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="flex flex-col">
        <SheetHeader>
          <SheetTitle asChild>
            <BrandLink onNavigate={() => onOpenChange(false)} />
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">
          <NavItems
            sections={navigationConfig}
            permissions={permissions}
            onNavigate={() => onOpenChange(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
