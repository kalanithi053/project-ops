/**
 * Temporary mock permission set for the current user.
 *
 * SECURITY NOTE: this list only controls what the UI *shows*. It is not
 * a security boundary — it will be replaced by the permission set
 * returned from the authenticated session/RBAC API, and every mutating
 * or data-fetching endpoint must independently re-check authorization
 * on the backend regardless of what the frontend renders.
 */
export const mockPermissions: string[] = [
  "project:view",
  "project:create",
  "task:view",
  "sprint:view",
  "team:view",
  "user:view",
  "developer:view",
  "resource:view",
  "capacity:view",
  "timesheet:view",
  "report:view",
  // Intentionally omitted so the Administration section demonstrates
  // permission-gated hiding: "tenant:manage", "role:manage", "audit:view"
];
