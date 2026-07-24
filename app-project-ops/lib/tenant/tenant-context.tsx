"use client";

import * as React from "react";

import type { Tenant } from "@/types/tenant";
import { mockTenants } from "@/lib/mock/data";
import {
  getCreatedWorkspaces,
  setActiveWorkspace,
} from "@/lib/tenant/active-workspace";

interface TenantContextValue {
  tenant: Tenant;
  tenants: Tenant[];
  setTenant: (tenant: Tenant) => void;
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

/**
 * Resolve a workspace slug to a Tenant. Known (seeded) tenants win;
 * otherwise a display tenant is derived from the slug so the header has
 * something correct to show on the server, before localStorage (which
 * holds the exact created-workspace name) is read on the client.
 */
export function tenantFromSlug(slug: string): Tenant {
  const known = mockTenants.find((t) => t.slug === slug);
  if (known) return known;
  return { id: `tn_${slug}`, name: titleCase(slug), slug };
}

/** Combine the seeded tenants with any created in-app, de-duped by id. */
function mergeTenants(base: Tenant[], extra: Tenant[]): Tenant[] {
  const seen = new Set(base.map((t) => t.id));
  return [...base, ...extra.filter((t) => !seen.has(t.id))];
}

/**
 * Provides the active tenant to the app shell. The active workspace is
 * derived from the URL slug (passed by the workspace layout), so the
 * header always matches the route. An effect then reconciles the name
 * and switcher list with the persisted created-workspaces on the client.
 *
 * SECURITY NOTE: this is a UI convenience only. Switching tenants here
 * changes what the frontend *displays*; it does not grant access to
 * another tenant's data. The backend must always validate that the
 * authenticated session belongs to the requested tenant on every
 * request, independent of this client-side selection.
 */
export function TenantProvider({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) {
  const initial = React.useMemo(() => tenantFromSlug(slug), [slug]);
  const [tenants, setTenants] = React.useState<Tenant[]>(() =>
    mergeTenants(mockTenants, mockTenants.some((t) => t.slug === slug) ? [] : [initial]),
  );
  const [tenant, setTenantState] = React.useState<Tenant>(initial);

  React.useEffect(() => {
    const created = getCreatedWorkspaces();
    const merged = mergeTenants(mockTenants, created);
    const resolved = merged.find((t) => t.slug === slug) ?? tenantFromSlug(slug);
    const withActive = merged.some((t) => t.slug === slug)
      ? merged
      : [...merged, resolved];

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcile with persisted workspaces on mount
    setTenants(withActive);
    setTenantState(resolved);
    // Remember this as the active workspace for a direct visit / refresh.
    setActiveWorkspace(resolved);
  }, [slug]);

  const setTenant = React.useCallback((next: Tenant) => {
    setTenantState(next);
    setActiveWorkspace(next);
  }, []);

  const value = React.useMemo(
    () => ({ tenant, tenants, setTenant }),
    [tenant, tenants, setTenant],
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
