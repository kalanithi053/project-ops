/**
 * Loosely-typed API domain models. The backend wraps everything in the
 * standard envelope and the OpenAPI spec doesn't pin down response
 * shapes, so these keep the fields we rely on required-ish and allow the
 * rest through via an index signature. Tighten as the contract firms up.
 */

export type ProjectMode = "HubSpot" | "Dev";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  mode: ProjectMode;
  description?: string;
  startDate?: string;
  endDate?: string;
  [key: string]: unknown;
}

export interface Role {
  id: string;
  name: string;
  /** Permission codes granted by this role (from GET /roles). */
  permissions?: string[];
  [key: string]: unknown;
}

/** Nested user record embedded in a workspace member. */
export interface MemberUser {
  id?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: unknown;
}

export interface WorkspaceMember {
  id: string;
  /** The member's user record (name/email live here). */
  user?: MemberUser;
  role?: Role | string;
  status?: string;
  // Some responses may also flatten these; kept optional for tolerance.
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  [key: string]: unknown;
}

export interface Plan {
  id: string;
  name: string;
  maxProjects?: number;
  maxMembers?: number;
  maxTasksPerModule?: number;
  features?: Record<string, unknown>;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface WorkspaceModule {
  id: string;
  planId?: string;
  key: string;
  name: string;
  defaultTaskLimit?: number;
  isDefault?: boolean;
  isActive?: boolean;
  [key: string]: unknown;
}

export interface Me {
  id?: string;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  [key: string]: unknown;
}

// ---- Request DTOs ----

export interface RequestOtpDto {
  username: string;
}

export interface RegisterDto {
  username: string;
  firstName: string;
  lastName?: string;
  email?: string;
}

export interface VerifyOtpDto {
  username: string;
  otp: string;
}

export interface CreateWorkspaceDto {
  name: string;
  slug?: string;
}

export interface CreateProjectDto {
  name: string;
  mode: ProjectMode;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export interface InviteMemberDto {
  username: string;
  roleId?: string;
}
