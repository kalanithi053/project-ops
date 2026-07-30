/**
 * Loosely-typed API domain models. The backend wraps everything in the
 * standard envelope and the OpenAPI spec doesn't pin down response
 * shapes, so these keep the fields we rely on required-ish and allow the
 * rest through via an index signature. Tighten as the contract firms up.
 */

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  isDefault?: boolean;
  [key: string]: unknown;
}

/** A project type (chosen at project creation), e.g. "Standard" / "Blank". */
export interface ProjectType {
  id: string;
  name: string;
  description?: string;
  /** When false, projects of this type skip plan/module/seed-task provisioning. */
  isPlanAdd?: boolean;
  /** Summary of plans under this type (from GET /project-types). */
  plans?: Array<{ id: string; name: string; isActive?: boolean }>;
  [key: string]: unknown;
}

/** Nested project-type reference embedded in a Project (from GET /projects). */
export interface ProjectTypeRef {
  id: string;
  name: string;
  isPlanAdd?: boolean;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  projectTypeId?: string;
  projectType?: ProjectTypeRef | null;
  /** Plans the project was provisioned from. A scalar list, not one id. */
  planId?: string[];
  description?: string;
  startDate?: string;
  endDate?: string;
  ownerId?: string;
  /** Present on GET /projects (list) — `{ tasks, members }`. */
  _count?: { tasks?: number; members?: number };
  [key: string]: unknown;
}

/** A module attached to a project, with its per-project task allowance. */
export interface ProjectModuleInstance {
  id: string;
  projectId: string;
  moduleId: string;
  /** Tasks this instance may hold before overflow is counted. */
  taskLimit: number;
  /** Tasks created beyond `taskLimit` — metered, never rejected. */
  addonTask: number;
  module: { key: string; name: string };
  [key: string]: unknown;
}

/** GET /projects/:id — richer than the list shape. Note: no tasks. */
export interface ProjectDetail extends Project {
  moduleInstances?: Array<ProjectModuleInstance & { module: WorkspaceModule }>;
  members?: Array<{
    id: string;
    userId: string;
    roleId: string;
    status?: string;
    user?: { id: string; username: string };
  }>;
}

export interface Role {
  id: string;
  name: string;
  /** The role assigned to new members when none is specified. */
  isDefault?: boolean;
  /** Built-in role (currently "Owner") — cannot be deleted. */
  isSystem?: boolean;
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
  /** Plans belong to exactly one project type. */
  projectTypeId?: string;
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
  email: string;
}

export interface RegisterDto {
  firstName: string;
  lastName?: string;
  email: string;
}

export interface VerifyOtpDto {
  email: string;
  otp: string;
}

export interface CreateWorkspaceDto {
  name: string;
  slug?: string;
}

export interface CreateProjectDto {
  name: string;
  projectTypeId: string;
  startDate: string;
  endDate: string;
  description?: string;
  /**
   * Plans the project is provisioned from — an array, and required (min 1)
   * when the chosen project type has `isPlanAdd`. Each plan contributes its
   * default modules and a seed task per module.
   */
  planId?: string[];
}

export interface InviteMemberDto {
  username: string;
  roleId?: string;
}

/**
 * PATCH /plans/active — only the currently-active plan can be edited.
 * `name` and `isActive` are both required: the backend DTO is hand-written
 * rather than a PartialType, so a partial body is rejected with a 400.
 */
export interface UpdatePlanDto {
  name: string;
  isActive: boolean;
  features?: Record<string, unknown>;
}

/** PATCH /modules/:id — `key` and `planId` are immutable server-side. */
export interface UpdateModuleDto {
  name?: string;
  defaultTaskLimit?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

// ---- Workspace settings ----

/**
 * Workflow bucket a ticket status belongs to. Mirrors the backend
 * `StatusCategory` enum; boards group columns by this, so it's a closed set
 * rather than a free-text label.
 */
export const STATUS_CATEGORIES = [
  "new",
  "todo",
  "in_progress",
  "ready_qa",
  "review",
  "done",
  "blocked",
] as const;

export type StatusCategory = (typeof STATUS_CATEGORIES)[number];

/** Human labels for `StatusCategory`, for selects and table cells. */
export const STATUS_CATEGORY_LABELS: Record<StatusCategory, string> = {
  new: "New",
  todo: "To Do",
  in_progress: "In Progress",
  ready_qa: "Ready for QA",
  review: "Review",
  done: "Done",
  blocked: "Blocked",
};

export interface TicketStatus {
  id: string;
  name: string;
  color?: string | null;
  order: number;
  isDefault: boolean;
  canDelete: boolean;
  category: StatusCategory;
  [key: string]: unknown;
}

export interface Priority {
  id: string;
  name: string;
  color?: string | null;
  order: number;
  isDefault: boolean;
  [key: string]: unknown;
}

/** How a WorkType is grouped for activity-log/report purposes. */
export type WorkTypeCategory = "task" | "incident" | "bug";

/** A workspace's work-item classification (task/incident/bug/…), GET /work-types. */
export interface WorkType {
  id: string;
  workspaceId: string;
  name: string;
  color?: string | null;
  category: WorkTypeCategory;
  isActive: boolean;
  [key: string]: unknown;
}

/** An entry in the workspace's permission catalog. */
export interface Permission {
  id: string;
  code: string;
  description?: string | null;
}

/** Module summary as embedded in a plan inside the settings bundle. */
export interface PlanModule {
  id: string;
  key: string;
  name: string;
  defaultTaskLimit: number;
  isDefault: boolean;
  isActive: boolean;
}

/** A plan with its provisioned modules (settings bundle shape). */
export interface PlanWithModules extends Plan {
  modules: PlanModule[];
}

/**
 * GET /workspace/settings — the single bootstrap payload for the settings
 * area. Deliberately ungated on the backend, which matters: GET /roles
 * requires `role.manage`, so this is the only role source a non-admin can
 * read.
 */
export interface WorkspaceSettings {
  workspace: Workspace & {
    ownerId: string;
    createdAt: string;
    updatedAt: string;
  };
  /** Id of the first active plan, or null when none is active. */
  activePlan: string | null;
  plans: PlanWithModules[];
  ticketStatuses: TicketStatus[];
  priorities: Priority[];
  projectTypes: ProjectType[];
  roles: Role[];
  permissions: Permission[];
}

/** GET /workspace/permission — the caller's own role and permission codes. */
export interface MyPermissions {
  scope: "workspace";
  workspaceId: string;
  role: { id: string; name: string } | null;
  permissions: string[];
}

/** Membership lifecycle, shared by workspace and project members. */
export type MembershipStatus = "invited" | "active" | "removed";

/** A person's membership of a single project. */
export interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  roleId: string;
  invitedBy?: string | null;
  status: MembershipStatus;
  joinedAt?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  role?: { id: string; name: string };
  [key: string]: unknown;
}

/**
 * POST /projects/:projectId/members. Unlike the workspace equivalent,
 * `roleId` is required — there's no default-role fallback on this route.
 */
export interface InviteProjectMemberDto {
  email: string;
  roleId: string;
}

/** PATCH /projects/:projectId/members/:memberId */
export interface UpdateProjectMemberDto {
  roleId?: string;
  status?: MembershipStatus;
}

/** GET /project/:projectId/permission — the caller's access to one project. */
export interface ProjectPermissions {
  scope: "project";
  projectId: string;
  isMember: boolean;
  role: { id: string; name: string } | null;
  permissions: string[];
}

// ---- Settings request DTOs ----

/** PATCH /workspace/settings */
export interface UpdateWorkspaceSettingsDto {
  name?: string;
  slug?: string;
}

/** PATCH /users/me — `username` is not updatable. */
export interface UpdateMeDto {
  firstName?: string;
  lastName?: string;
  email?: string;
}

/** POST /ticket-statuses */
export interface CreateTicketStatusDto {
  name: string;
  category: StatusCategory;
  color?: string;
  order?: number;
  isDefault?: boolean;
  canDelete?: boolean;
}

/** PATCH /ticket-statuses/:id */
export type UpdateTicketStatusDto = Partial<CreateTicketStatusDto>;

/** POST /priorities */
export interface CreatePriorityDto {
  name: string;
  color?: string;
  order?: number;
  isDefault?: boolean;
}

/** PATCH /priorities/:id */
export type UpdatePriorityDto = Partial<CreatePriorityDto>;

/**
 * POST /roles — `permissionCodes` is replace-all on update; sending `[]`
 * clears every permission on the role.
 */
export interface CreateRoleDto {
  name: string;
  isDefault?: boolean;
  permissionCodes?: string[];
}

/** PATCH /roles/:id */
export type UpdateRoleDto = Partial<CreateRoleDto>;

/**
 * POST /project-types — when `isPlanAdd` is true the backend also seeds the
 * Professional / Ultimate / Enterprise plan templates and their modules.
 */
export interface CreateProjectTypeDto {
  name: string;
  description?: string;
  isPlanAdd?: boolean;
}

/** PATCH /project-types/:id */
export type UpdateProjectTypeDto = Partial<CreateProjectTypeDto>;

/** POST /plans — creating a plan seeds the nine default modules under it. */
export interface CreatePlanDto {
  projectTypeId: string;
  name: string;
  features?: Record<string, unknown>;
  isActive?: boolean;
}

/**
 * PATCH /plans/:planId — renames a plan or updates its feature flags.
 * Activation is a separate endpoint, so `isActive` isn't accepted here.
 */
export interface UpdatePlanDetailsDto {
  name?: string;
  features?: Record<string, unknown>;
}

/** POST /modules — `key` must be lowercase snake_case. */
export interface CreateModuleDto {
  planId: string;
  key: string;
  name: string;
  defaultTaskLimit?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

// ---- Tasks ----

/** Nested refs embedded in a task by GET /projects/:projectId/tasks. */
export interface TaskStatusRef {
  id: string;
  name: string;
  category: StatusCategory;
  color?: string | null;
}

export interface TaskPriorityRef {
  id: string;
  name: string;
  color?: string | null;
}

export interface TaskAssigneeRef {
  id: string;
  username: string;
}

/** Join-table row as returned inside a task's `assignees`. */
export interface TaskAssignment {
  user: TaskAssigneeRef;
}

/** A document attached to a task. */
export interface TaskAttachment {
  id: string;
  taskId: string;
  /** Original upload name — what the UI shows and downloads as. */
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploader?: { id: string; username: string };
  /** Present only on the project-wide rollup. */
  task?: { id: string; name: string; prefix?: string | null };
}

export interface Task {
  id: string;
  projectId: string;
  moduleInstanceId?: string | null;
  name: string;
  /** Human key like "Pipelines - 1" or "W-T12". Server-generated. */
  prefix?: string | null;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  statusId?: string | null;
  priorityId?: string | null;
  /** WorkType this item is classified as (task/incident/bug). */
  workItemTypeId?: string | null;
  workItemType?: Pick<WorkType, "id" | "name" | "category"> | null;
  createdBy?: string;
  /** Flat ordering across the whole project, not per column. */
  position: number;
  /** Estimated effort in whole hours; null when not estimated. */
  estimateHours?: number | null;
  /** Hours of work completed so far; null when none have been logged. */
  completedHours?: number | null;
  /** Legacy frontend field retained while older cached responses expire. */
  etaHours?: number | null;
  createdAt?: string;
  updatedAt?: string;
  /**
   * Status and priority are only present on list/detail reads — POST and
   * PATCH include assignees but not these, so mutations refetch rather
   * than merge.
   */
  status?: TaskStatusRef | null;
  priority?: TaskPriorityRef | null;
  /** A task can be worked by several people. */
  assignees?: TaskAssignment[];
  assigneeId: string;
  qaAssigneeId?: string | null;
  qaAssignee?: TaskCommentUser | null;
  [key: string]: unknown;
}

export interface Incident {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  statusId: string;
  status: TaskStatusRef;
  assigneeId?: string | null;
  qaAssigneeId?: string | null;
  estimateHours?: number | null;
  completedHours?: number | null;
  createdAt: string;
  updatedAt: string;
  assignee?: TaskCommentUser | null;
  qaAssignee?: TaskCommentUser | null;
  [key: string]: unknown;
}

export interface CreateIncidentDto {
  title: string;
  description?: string;
  statusId?: string;
  assigneeId?: string;
  qaAssigneeId?: string;
  estimateHours?: number;
  completedHours?: number;
}

export interface UpdateIncidentDto extends Partial<CreateIncidentDto> {}

export interface ProjectReport {
  modules: Array<{
    id: string;
    module: string;
    used: number;
    limit: number;
    addon: number;
  }>;
  statusBreakdown: Array<{
    name: string;
    color?: string | null;
    count: number;
  }>;
  byPriority: Array<{ priority: string; statuses: Record<string, number> }>;
  /** Dynamic breakdown by WorkType — one entry per category/name in use. */
  byType: Array<{
    name: string;
    category: string;
    total: number;
    done: number;
  }>;
  progress: {
    totalItems: number;
    doneItems: number;
    percentComplete: number;
    stage: string;
  };
  user: Array<{
    name: string;
    totalItems: number;
    completedItems: number;
    totalEstimateHours: number;
    totalCompletedHours: number;
    /** Work item count per WorkType name. */
    byType: Record<string, number>;
  }>;
}

export interface WorkspaceReport {
  totalItems: number;
  byType: Array<{ name: string; count: number }>;
  statusBreakdown: Array<{ label: string; count: number }>;
}

/**
 * POST /projects/:projectId/tasks. `moduleInstanceId` is required when the
 * project's type has `isPlanAdd`.
 */
export interface CreateTaskDto {
  name: string;
  moduleInstanceId?: string;
  prefix?: string;
  description?: string;
  startDate?: string;
  dueDate?: string;
  statusId?: string;
  priorityId?: string;
  /** WorkType this item is classified as (task/incident/bug). */
  workItemTypeId?: string;
  /**
   * Replace-all on update: the array becomes the complete assignee set, and
   * omitting the key leaves existing assignees untouched.
   */
  assigneeId?: string;
  qaAssigneeId?: string;
  /** Estimated effort in whole hours. */
  estimateHours?: number;
  /** Hours of work completed so far. */
  completedHours?: number;
  position?: number;
}

/**
 * PATCH /projects/:projectId/tasks/:taskId.
 *
 * The backend applies every field as `dto.x ?? undefined`, so sending `null`
 * is a no-op — a value can be changed but not cleared through this API.
 */
export type UpdateTaskDto = Partial<CreateTaskDto>;

/** Human-readable audit entry returned by a task's activity endpoint. */
export interface TaskActivityEntry {
  id: string;
  entityType: "task";
  entityId: string;
  action:
    | "created"
    | "updated"
    | "status_changed"
    | "deleted"
    | "comment_added"
    | string;
  actor: string;
  createdAt: string;
  description: string;
  metadata?: Record<string, unknown> | null;
}

export interface IncidentActivityEntry extends Omit<TaskActivityEntry, "entityType"> {
  entityType: "incident";
}

export interface TaskCommentUser {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
}

export interface TaskComment {
  id: string;
  workspaceId: string;
  taskId: string | null;
  body: string;
  authorId: string;
  author: TaskCommentUser;
  mentions: Array<{ user: TaskCommentUser }>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskCommentDto {
  body: string;
  mentions?: string[];
}

/** Full replacement payload for a task comment. */
export type UpdateTaskCommentDto = CreateTaskCommentDto;
