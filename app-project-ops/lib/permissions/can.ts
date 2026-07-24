/**
 * Determines whether the given permission set grants a specific action.
 *
 * This is a UX-level check only, used to decide what to render (e.g.
 * hiding a nav item or disabling a button). Backend authorization
 * remains the authoritative security boundary — every API route must
 * independently verify the caller's permissions.
 */
export function can(permissions: string[], permission?: string): boolean {
  if (!permission) return true;
  return permissions.includes(permission);
}
