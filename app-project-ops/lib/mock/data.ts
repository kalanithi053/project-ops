import type { Tenant } from "@/types/tenant";
import type { AuthUser, Notification } from "@/types/auth";
import { mockPermissions } from "@/config/permissions";

/**
 * Mock tenants for the tenant selector. Replace with a call to the
 * tenant API once authentication is wired up (see TenantProvider).
 */
export const mockTenants: Tenant[] = [
  { id: "tn_1", name: "Acme Engineering", slug: "acme-engineering" },
  { id: "tn_2", name: "Internal Platform", slug: "internal-platform" },
  { id: "tn_3", name: "Product Team", slug: "product-team" },
];

/**
 * Mock signed-in user. Replace with session data from the auth
 * provider once authentication is integrated.
 */
export const mockCurrentUser: AuthUser = {
  id: "usr_1",
  name: "Prithivi",
  email: "prithivi@acme-engineering.com",
  role: "Engineering Manager",
  permissions: mockPermissions,
};

/**
 * Mock notifications. Replace with data from the notifications API.
 */
export const mockNotifications: Notification[] = [
  {
    id: "ntf_1",
    title: "Project Alpha moved to QA",
    createdAt: "2026-07-23T07:10:00Z",
    read: false,
  },
  {
    id: "ntf_2",
    title: "John assigned TASK-102 to you",
    createdAt: "2026-07-23T05:45:00Z",
    read: false,
  },
  {
    id: "ntf_3",
    title: "Sprint 12 started",
    createdAt: "2026-07-22T09:00:00Z",
    read: true,
  },
  {
    id: "ntf_4",
    title: "Release v2.1 created",
    createdAt: "2026-07-21T14:30:00Z",
    read: true,
  },
];
