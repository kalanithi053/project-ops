"use client";

import { useRouter } from "next/navigation";
import { Building2, Check, ChevronsUpDown } from "lucide-react";

import { useTenant } from "@/lib/tenant/tenant-context";
import type { Tenant } from "@/types/tenant";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Lets the user switch which tenant's data they're viewing.
 *
 * SECURITY NOTE: this selector is a UI convenience, not a security
 * boundary — see TenantProvider. The backend must independently
 * validate tenant access on every request.
 */
export function TenantSelector() {
  const router = useRouter();
  const { tenant, tenants, setTenant } = useTenant();

  function switchTenant(next: Tenant) {
    setTenant(next);
    // Routes are workspace-scoped, so switching means navigating to the
    // selected workspace's dashboard.
    router.push(`/${next.slug}/dashboard`);
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
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Switch tenant</DropdownMenuLabel>
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
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
