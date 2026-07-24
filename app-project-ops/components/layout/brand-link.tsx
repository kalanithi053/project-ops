"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Boxes } from "lucide-react";

import { cn } from "@/lib/utils";
import { siteConfig } from "@/config/site";

/**
 * Brand logo + wordmark that links to the active workspace's dashboard.
 * Derives the workspace slug from the current path so the sidebar never
 * hardcodes a tenant.
 */
export function BrandLink({
  showName = true,
  onNavigate,
  className,
}: {
  showName?: boolean;
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();
  const slug = pathname.split("/").filter(Boolean)[0];
  const href = slug ? `/${slug}/dashboard` : "/";

  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn("flex items-center gap-2 overflow-hidden", className)}
    >
      <Boxes className="h-5 w-5 shrink-0 text-sidebar-primary" />
      {showName && (
        <span className="truncate text-sm font-semibold">{siteConfig.name}</span>
      )}
    </Link>
  );
}
