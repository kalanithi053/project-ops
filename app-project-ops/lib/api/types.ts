/**
 * Loosely-typed API domain models. The backend wraps everything in the
 * standard envelope and the OpenAPI spec doesn't pin down response
 * shapes, so these keep the fields we rely on required-ish and allow the
 * rest through via an index signature. Tighten as the contract firms up.
 */

import type { ThemeMode } from "@/lib/store/theme-store";

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
  /** Drives the title accent bar on that type's work items. */
  color?: string | null;
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
  color?: string | null;
  isPlanAdd?: boolean;
  [key: string]: unknown;
}

/**
 * Commercial engagement model — distinct from `ProjectType` (HubSpot vs
 * Development). Drives which format the Estimation field takes: hours for
 * time_and_material, a target/renewal date for the other two.
 */
export type ProjectEngagementType =
  | "fixed_budget"
  | "time_and_material"
  | "retainer";

/** Nested Sales Rep / Project Manager reference embedded in a Project. */
export interface ProjectPersonRef {
  id: string;
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  projectTypeId?: string;
  projectType?: ProjectTypeRef | null;
  /** Plans the project was provisioned from. A scalar list, not one id. */
  planId?: string[];
  /** HubSpot Hubs this engagement covers. Only meaningful for HubSpot projects. */
  hubId?: string[];
  description?: string;
  startDate?: string;
  endDate?: string;
  ownerId?: string;
  salesRepId?: string | null;
  salesRep?: ProjectPersonRef | null;
  projectManagerId?: string | null;
  projectManager?: ProjectPersonRef | null;
  engagementType?: ProjectEngagementType | null;
  /** Estimated hours — populated only when engagementType is time_and_material. */
  estimatedHours?: number | null;
  /** Estimated/renewal date — populated only for fixed_budget/retainer. */
  estimatedDate?: string | null;
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
  module: {
    key: string;
    name: string;
    plan?: {
      id: string;
      name: string;
      hub?: { id: string; name: string } | null;
    };
  };
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
  /** Workspace-wide dashboard visibility for members with this role, instead of just their own assigned work. */
  isManagerTier?: boolean;
  /** Permission codes granted by this role (from GET /roles). */
  permissions?: string[];
  [key: string]: unknown;
}

/** A user's membership of a single project, as embedded under a workspace member. */
export interface ProjectMembershipSummary {
  id: string;
  projectId: string;
  status?: MembershipStatus;
  role?: { id: string; name: string };
  project?: { id: string; name: string };
}

/** Nested user record embedded in a workspace member. */
export interface MemberUser {
  id?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  /** This user's project memberships within the current workspace. */
  projectMembers?: ProjectMembershipSummary[];
  [key: string]: unknown;
}

export interface WorkspaceMember {
  id: string;
  roleId?: string;
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

/** PATCH /workspace-members/:memberId */
export interface UpdateWorkspaceMemberDto {
  roleId?: string;
  status?: MembershipStatus;
}

/** Nested Hub reference embedded in a Hub-scoped Plan. */
export interface PlanHubRef {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Plan {
  id: string;
  name: string;
  /** Plans belong to exactly one project type. */
  projectTypeId?: string;
  /** Set when this plan is a tier of a specific Hub (e.g. "Enterprise" under Sales Hub). */
  hubId?: string | null;
  hub?: PlanHubRef | null;
  features?: Record<string, unknown>;
  isActive?: boolean;
  [key: string]: unknown;
}

/**
 * A HubSpot Hub (Marketing/Sales/Service/Content/Operations/Commerce Hub).
 * Only meaningful under a plan-adding ProjectType (HubSpot). Each Hub's tiers
 * are ordinary hub-scoped `Plan` rows — see `Plan.hubId`.
 */
export interface Hub {
  id: string;
  name: string;
  projectTypeId?: string;
  color?: string | null;
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
  productTourCompletedAt?: string | null;
  isTourDone?: boolean;
  projectOverviewTourCompletedAt?: string | null;
  isProjectOverviewTourDone?: boolean;
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
  /**
   * HubSpot Hubs this engagement covers — only relevant when the project
   * type is plan-adding (HubSpot). Every selected plan that belongs to a Hub
   * must have that Hub included here.
   */
  hubId?: string[];
  salesRepId?: string;
  projectManagerId?: string;
  engagementType?: ProjectEngagementType;
  /** Only valid when engagementType is time_and_material. */
  estimatedHours?: number;
  /** Only valid when engagementType is fixed_budget or retainer. */
  estimatedDate?: string;
  /**
   * Explicit module choices for this project (existing catalog modules
   * and/or brand-new ones), each with its own task count. Falls back to
   * each selected plan's isDefault modules at their catalog task limit
   * when omitted.
   */
  moduleSelections?: ModuleSelectionDto[];
}

/**
 * One module to attach to the project being created. Either `moduleId` (an
 * existing catalog module) or `planId` + `name` (a brand-new module) must be
 * set — enforced server-side since it depends on which plans were selected.
 */
export interface ModuleSelectionDto {
  moduleId?: string;
  planId?: string;
  name?: string;
  taskLimit: number;
}

/**
 * PATCH /projects/:id — every CreateProjectDto field is editable, including
 * projectTypeId/planId/hubId/moduleSelections: changing projectTypeId
 * re-provisions the project the same way picking a type does on create, and
 * touching planId/hubId/moduleSelections reconciles the project's module
 * instances against the new selection (see ProjectsService.update()).
 * `null` clears a field; `undefined` (an omitted key) leaves it unchanged.
 */
export interface UpdateProjectDto {
  name?: string;
  startDate?: string;
  endDate?: string;
  description?: string;
  projectTypeId?: string;
  planId?: string[];
  hubId?: string[];
  moduleSelections?: ModuleSelectionDto[];
  salesRepId?: string | null;
  projectManagerId?: string | null;
  engagementType?: ProjectEngagementType | null;
  estimatedHours?: number | null;
  estimatedDate?: string | null;
}

export interface InviteMemberDto {
  email: string;
  roleId?: string;
}

/**
 * Adds a user to the workspace and, optionally, as a member of one or more
 * projects — each with its own role, since project access doesn't have to
 * mirror the workspace-wide one.
 */
export interface AddWorkspaceMemberDto extends InviteMemberDto {
  projectMemberships?: { projectId: string; roleId: string }[];
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
  "removed",
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
  removed: "Removed",
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
  hubs: Hub[];
  roles: Role[];
  permissions: Permission[];
  preferences: WorkspacePreferences;
}

/** GET /workspace/permission — the caller's own role and permission codes. */
export interface MyPermissions {
  scope: "workspace";
  workspaceId: string;
  role: { id: string; name: string; isManagerTier: boolean } | null;
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
  /** Workspace-wide dashboard visibility for members with this role, instead of just their own assigned work. */
  isManagerTier?: boolean;
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
  color?: string;
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
  /** Scopes the plan as a tier of this Hub instead of a generic plan. */
  hubId?: string;
}

/** POST /hubs — creating a Hub seeds its 3 tiers (HUB_TIERS) as empty plans. */
export interface CreateHubDto {
  projectTypeId: string;
  name: string;
  color?: string;
  isActive?: boolean;
}

/** PATCH /hubs/:hubId — projectTypeId is immutable after creation. */
export type UpdateHubDto = Partial<Omit<CreateHubDto, "projectTypeId">>;

/**
 * PATCH /plans/:planId — renames a plan, updates its feature flags, or
 * reassigns/clears its Hub. Activation is a separate endpoint, so `isActive`
 * isn't accepted here.
 */
export interface UpdatePlanDetailsDto {
  name?: string;
  features?: Record<string, unknown>;
  /** Set to null to un-scope the plan back to a generic (non-Hub) tier. */
  hubId?: string | null;
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

/** A file uploaded to a project (GET/POST /projects/:projectId/attachments). */
export interface ProjectAttachment {
  id: string;
  projectId: string;
  /** Original upload name — what the UI shows and downloads as. */
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploader?: {
    id: string;
    email: string;
    firstName?: string | null;
    lastName?: string | null;
  };
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
  workItemType?: Pick<WorkType, "id" | "name" | "category" | "color"> | null;
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
    color?: string | null;
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
    /** Real tracked time (TimeLog entries) against this project, in minutes. */
    loggedMinutes: number;
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
    | "time_logged"
    | string;
  actor: string;
  createdAt: string;
  description: string;
  metadata?: Record<string, unknown> | null;
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

export type TimeLogBillingType = "billable" | "non_billable";
export type TimeLogSource = "manual" | "timer";

export interface TimeLog {
  id: string;
  workspaceId: string;
  projectId: string;
  workItemId: string;
  userId: string;
  /** `YYYY-MM-DD` the entry is logged against. */
  date: string;
  /** Full ISO timestamp; null for a duration-only manual entry. */
  startTime?: string | null;
  /** Full ISO timestamp; null while a timer-sourced entry is still running. */
  endTime?: string | null;
  durationMinutes: number;
  billingType: TimeLogBillingType;
  source: TimeLogSource;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  user: TaskCommentUser;
  /** Present only on project-level (cross-work-item) reads. */
  workItem?: {
    id: string;
    name: string;
    prefix?: string | null;
    /** Present only on workspace-level reads (the team calendar/grid). */
    workItemType?: {
      id: string;
      name: string;
      category: string;
      color?: string | null;
    } | null;
  };
  /** Present only on workspace-level reads (the team calendar/grid). */
  project?: { id: string; name: string };
}

/** GET .../time-logs for one work item. */
export interface WorkItemTimeLogs {
  entries: TimeLog[];
  /** The caller's own in-progress timer entry, if any. */
  runningTimer: TimeLog | null;
}

/**
 * GET /time-logs/running — the caller's own running timer, regardless of
 * which work item or workspace started it. Powers the header widget, which
 * has no project/work-item route to scope a lookup to.
 */
export interface RunningTimerInfo extends TimeLog {
  workItem: { id: string; name: string; prefix?: string | null };
  workspaceSlug: string;
}

/**
 * POST .../time-logs. Either `durationMinutes` or the `startTime`/`endTime`
 * pair is required — when both a period and a duration are given, the
 * server derives the duration from the period instead of trusting the
 * client's number.
 */
export interface CreateTimeLogDto {
  date: string;
  durationMinutes?: number;
  startTime?: string;
  endTime?: string;
  billingType?: TimeLogBillingType;
  notes?: string;
}

export type UpdateTimeLogDto = Partial<CreateTimeLogDto>;

/** Query filters for the project-level Time Logs tab. */
export interface TimeLogFilters {
  startDate?: string;
  endDate?: string;
  userId?: string;
}

/** POST .../time-logs/timer/stop */
export interface StopTimerDto {
  notes?: string;
}

/** Why a work item showed up on the caller's attention list. */
export type AttentionReason = "overdue" | "due_soon" | "blocked";

/** Nested refs shared by the attention/priority/"my open items" dashboard endpoints. */
export interface WorkItemInsightRef {
  id: string;
  name: string;
  prefix?: string | null;
  dueDate?: string | null;
  project: { id: string; name: string };
  status?: { name: string; category: StatusCategory; color?: string | null } | null;
  priority?: { id: string; name: string; color?: string | null; order: number } | null;
  workItemType?: {
    id: string;
    name: string;
    category: WorkTypeCategory;
    color?: string | null;
  } | null;
}

/** GET /work-items/attention — the caller's own overdue/due-soon/blocked items. */
export interface AttentionItem extends WorkItemInsightRef {
  reason: AttentionReason;
}

export interface AttentionItemsResponse {
  total: number;
  items: AttentionItem[];
}

/** GET /work-items/priority — the caller's own open items in the workspace's top priority tiers. */
export type PriorityItem = WorkItemInsightRef;

export interface PriorityItemsResponse {
  total: number;
  items: PriorityItem[];
}

/** A work item's assignee, as embedded in the Owner/Admin/Client "team" dashboard views. */
export interface WorkItemAssigneeRef {
  id: string;
  email: string;
  name: string;
}

/** GET /work-items/attention/team — every workspace item needing attention, across every assignee. */
export interface TeamAttentionItem extends WorkItemInsightRef {
  reason: AttentionReason;
  assignee: WorkItemAssigneeRef | null;
}

export interface TeamAttentionItemsResponse {
  total: number;
  items: TeamAttentionItem[];
}

/** GET /work-items/priority/team — every workspace top-priority item, across every assignee. */
export interface TeamPriorityItem extends WorkItemInsightRef {
  assignee: WorkItemAssigneeRef | null;
}

export interface TeamPriorityItemsResponse {
  total: number;
  items: TeamPriorityItem[];
}

/**
 * GET /projects/utilization — one project's schedule/budget health, for the
 * Owner/Admin/Client dashboard. `basis` picks which fields are populated:
 * 'hours' (time_and_material, has an hours budget), 'date' (fixed_budget/
 * retainer, has a start→target date window), or 'none' (neither is set).
 */
export interface ProjectUtilization {
  id: string;
  name: string;
  engagementType?: ProjectEngagementType | null;
  loggedHours: number;
  basis: "hours" | "date" | "none";
  estimatedHours?: number | null;
  remainingHours?: number | null;
  percentOfHoursUsed?: number | null;
  startDate?: string | null;
  targetDate?: string | null;
  percentTimeElapsed?: number | null;
  /** Negative once past targetDate. */
  daysRemaining?: number | null;
  statusPercentComplete: number;
  totalWorkItems: number;
  doneWorkItems: number;
}

/** GET /work-items/mine — every open item assigned to the caller, for the quick time-log picker. */
export type MyOpenWorkItem = WorkItemInsightRef;

export interface MyOpenWorkItemsResponse {
  total: number;
  items: MyOpenWorkItem[];
}

/** GET /search — a single project/work item/member match, for the header's global search. */
export interface GlobalSearchResultItem {
  type: "project" | "workitem" | "member";
  id: string;
  title: string;
  subtitle?: string | null;
  /** Only set for a 'workitem' result — the project it belongs to, for building its URL. */
  projectId?: string;
}

export interface GlobalSearchResult {
  projects: GlobalSearchResultItem[];
  workItems: GlobalSearchResultItem[];
  members: GlobalSearchResultItem[];
}

export type TimeLogPastLimitUnit = "day" | "week" | "month";

/** Workspace-wide time-log restrictions, part of the settings bundle. */
export interface WorkspacePreferences {
  allowManualTimeLog: boolean;
  allowPastTimeLog: boolean;
  /** Null means unlimited (only meaningful while allowPastTimeLog is true). */
  pastTimeLogLimitValue: number | null;
  pastTimeLogLimitUnit: TimeLogPastLimitUnit;
}

/** PATCH /workspace/settings/preferences */
export type UpdateWorkspacePreferencesDto = Partial<WorkspacePreferences>;

/** GET /workspace-members/me — the caller's own membership row for this workspace. */
export interface MyWorkspaceMembership {
  id: string;
  roleId: string;
  status: MembershipStatus;
  isDefault: boolean;
  /** The member's own display-theme preference. Self-service, unrestricted by role. */
  theme: ThemeMode;
}

/** PATCH /workspace-members/me/theme */
export interface UpdateMyThemeDto {
  theme: ThemeMode;
}
