/**
 * Authenticated user shape used throughout the shell.
 *
 * This is intentionally decoupled from any specific auth provider
 * (NextAuth, Clerk, custom JWT, etc.) so the real integration can
 * populate it later without UI changes.
 */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  role: string;
  /** Permission strings granted to this user, e.g. "project:view". */
  permissions: string[];
}

export interface Notification {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  read: boolean;
}
