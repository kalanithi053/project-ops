"use client";

import { useRouter } from "next/navigation";
import {
  Building2,
  Check,
  ChevronsUpDown,
  Plus,
  Settings2,
} from "lucide-react";

import { useTenant } from "@/lib/tenant/tenant-context";
import type { Tenant } from "@/types/tenant";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Header workspace switcher. Lists the workspaces the user belongs to and
 * links to the workspace hub to create or manage them.
 *
 * SECURITY NOTE: this selector is a UI convenience, not a security
 * boundary — see TenantProvider. The backend must independently validate
 * tenant access on every request.
 */
export function TenantSelector() {
  const router = useRouter();
  const { tenant, tenants, isLoading } = useTenant();

  function switchTenant(next: Tenant) {
    // Routes are workspace-scoped, so switching navigates to the selected
    // workspace's dashboard (which re-scopes every API call via the header).
    router.push(`/${next.slug}/dashboard`);
  }

  if (isLoading && tenants.length <= 1) {
    return <Skeleton className="hidden h-8 w-40 rounded-md sm:block" />;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="hidden max-w-48 gap-2 sm:flex"
        >
          <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="truncate">{tenant.name}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>Switch workspace</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {tenants.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onSelect={() => switchTenant(t)}
            className="justify-between"
          >
            <span className="truncate">{t.name}</span>
            {t.id === tenant.id && <Check className="h-4 w-4 shrink-0" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/workspaces?new=1")}>
          <Plus className="h-4 w-4" />
          Create workspace
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push("/workspaces")}>
          <Settings2 className="h-4 w-4" />
          Manage workspaces
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
