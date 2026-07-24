"use client";

import * as React from "react";

import type { Tenant } from "@/types/tenant";
import { useMyWorkspaces } from "@/lib/api/hooks/use-workspaces";
import type { Workspace } from "@/lib/api/types";

interface TenantContextValue {
  tenant: Tenant;
  tenants: Tenant[];
  isLoading: boolean;
}

const TenantContext = React.createContext<TenantContextValue | null>(null);

/** Title-case a slug, e.g. "nova-robotics" → "Nova Robotics". */
function titleCase(slug: string): string {
  return slug
    .split("-")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function toTenant(workspace: Workspace): Tenant {
  return {
    id: String(workspace.id ?? workspace.slug),
    name: workspace.name ?? titleCase(workspace.slug),
    slug: workspace.slug,
  };
}

/**
 * Provides the active tenant + the user's workspace list to the shell.
 * The active workspace is the one whose slug matches the current route
 * (`/{slug}/…`); the list comes from GET /workspaces/me. Until that
 * loads, a placeholder derived from the slug keeps the header populated.
 *
 * SECURITY NOTE: this is a UI convenience only. The `x-workspace-slug`
 * header (set from the route) is what actually scopes API calls, and the
 * backend authorizes membership on every request.
 */
export function TenantProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const { data, isLoading } = useMyWorkspaces();

  const tenants = React.useMemo<Tenant[]>(() => {
    const list = (data ?? []).map(toTenant);
    // Ensure the active workspace is always present, even mid-load.
    if (slug && !list.some((t) => t.slug === slug)) {
      list.push({ id: `tn_${slug}`, name: titleCase(slug), slug });
    }
    return list;
  }, [data, slug]);

  const tenant = React.useMemo<Tenant>(
    () =>
      tenants.find((t) => t.slug === slug) ?? {
        id: `tn_${slug}`,
        name: titleCase(slug),
        slug,
      },
    [tenants, slug],
  );

  const value = React.useMemo(
    () => ({ tenant, tenants, isLoading }),
    [tenant, tenants, isLoading],
  );

  return (
    <TenantContext.Provider value={value}>{children}</TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = React.useContext(TenantContext);
  if (!ctx) {
    throw new Error("useTenant must be used within a TenantProvider");
  }
  return ctx;
}
