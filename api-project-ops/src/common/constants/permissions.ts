/**
 * Central permission catalog. These codes are seeded into every workspace's
 * UserPermission table and referenced by @RequirePermission('...') on routes.
 */
export const PERMISSIONS = {
  PROJECT_CREATE: 'project.create',
  PROJECT_READ: 'project.read',
  PROJECT_UPDATE: 'project.update',
  PROJECT_DELETE: 'project.delete',

  WORKITEM_CREATE: 'workitem.create',
  WORKITEM_READ: 'workitem.read',
  WORKITEM_UPDATE: 'workitem.update',
  WORKITEM_DELETE: 'workitem.delete',

  COMMENT_CREATE: 'comment.create',

  MEMBER_INVITE: 'member.invite',
  MEMBER_REMOVE: 'member.remove',

  ROLE_MANAGE: 'role.manage',
  MODULE_MANAGE: 'module.manage',
  TICKETSTATUS_MANAGE: 'ticketstatus.manage',
  PRIORITY_MANAGE: 'priority.manage',
  WORKTYPE_MANAGE: 'worktype.manage',
  PROJECTTYPE_MANAGE: 'projecttype.manage',
  PLAN_MANAGE: 'plan.manage',
  HUB_MANAGE: 'hub.manage',
  PERMISSION_READ: 'permission.read',
  WORKSPACE_MANAGE: 'workspace.manage',

  TIMELOG_READ: 'timelog.read',
  TIMELOG_MANAGE: 'timelog.manage',

  ATTACHMENT_CREATE: 'attachment.create',
  ATTACHMENT_READ: 'attachment.read',
  ATTACHMENT_DELETE: 'attachment.delete',
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export interface PermissionDefinition {
  code: PermissionCode;
  description: string;
}

/** Full catalog with human-readable descriptions (seeded per workspace). */
export const PERMISSION_CATALOG: PermissionDefinition[] = [
  { code: PERMISSIONS.PROJECT_CREATE, description: 'Create projects' },
  { code: PERMISSIONS.PROJECT_READ, description: 'View projects' },
  { code: PERMISSIONS.PROJECT_UPDATE, description: 'Edit projects' },
  { code: PERMISSIONS.PROJECT_DELETE, description: 'Delete projects' },
  { code: PERMISSIONS.WORKITEM_CREATE, description: 'Create work items' },
  { code: PERMISSIONS.WORKITEM_READ, description: 'View work items' },
  { code: PERMISSIONS.WORKITEM_UPDATE, description: 'Edit work items' },
  { code: PERMISSIONS.WORKITEM_DELETE, description: 'Delete work items' },
  {
    code: PERMISSIONS.COMMENT_CREATE,
    description: 'Create comments (with @mentions)',
  },
  { code: PERMISSIONS.MEMBER_INVITE, description: 'Invite members' },
  { code: PERMISSIONS.MEMBER_REMOVE, description: 'Remove members' },
  {
    code: PERMISSIONS.ROLE_MANAGE,
    description: 'Manage roles and permissions',
  },
  { code: PERMISSIONS.MODULE_MANAGE, description: 'Manage workspace modules' },
  {
    code: PERMISSIONS.TICKETSTATUS_MANAGE,
    description: 'Manage ticket statuses',
  },
  { code: PERMISSIONS.PRIORITY_MANAGE, description: 'Manage priorities' },
  { code: PERMISSIONS.WORKTYPE_MANAGE, description: 'Manage work types' },
  { code: PERMISSIONS.PROJECTTYPE_MANAGE, description: 'Manage project types' },
  { code: PERMISSIONS.PLAN_MANAGE, description: 'Manage the workspace plan' },
  { code: PERMISSIONS.HUB_MANAGE, description: 'Manage HubSpot hubs' },
  {
    code: PERMISSIONS.PERMISSION_READ,
    description: 'View the permission catalog',
  },
  {
    code: PERMISSIONS.WORKSPACE_MANAGE,
    description: 'Manage workspace settings',
  },
  { code: PERMISSIONS.TIMELOG_READ, description: 'View time logs' },
  {
    code: PERMISSIONS.TIMELOG_MANAGE,
    description: 'Log time (manual or timer) and edit/delete your own entries',
  },
  { code: PERMISSIONS.ATTACHMENT_CREATE, description: 'Upload project files' },
  {
    code: PERMISSIONS.ATTACHMENT_READ,
    description: 'View and download project files',
  },
  { code: PERMISSIONS.ATTACHMENT_DELETE, description: 'Delete project files' },
] as const;

export const ALL_PERMISSION_CODES: PermissionCode[] = PERMISSION_CATALOG.map(
  (p) => p.code,
);

/**
 * Default per-workspace roles and the permission codes each one holds.
 * Used by the seed script and by workspace bootstrapping.
 */
export const DEFAULT_ROLES: Array<{
  name: string;
  isDefault: boolean;
  isSystem: boolean;
  /** Workspace-wide dashboard visibility instead of just-your-own-items — see UserRole.isManagerTier. */
  isManagerTier: boolean;
  permissions: PermissionCode[];
}> = [
  {
    name: 'Owner',
    isDefault: false,
    isSystem: true,
    isManagerTier: true,
    permissions: ALL_PERMISSION_CODES,
  },
  {
    name: 'Admin',
    isDefault: false,
    isSystem: false,
    isManagerTier: true,
    permissions: [
      PERMISSIONS.PROJECT_CREATE,
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.PROJECT_UPDATE,
      PERMISSIONS.PROJECT_DELETE,
      PERMISSIONS.WORKITEM_CREATE,
      PERMISSIONS.WORKITEM_READ,
      PERMISSIONS.WORKITEM_UPDATE,
      PERMISSIONS.WORKITEM_DELETE,
      PERMISSIONS.COMMENT_CREATE,
      PERMISSIONS.MEMBER_INVITE,
      PERMISSIONS.MEMBER_REMOVE,
      PERMISSIONS.ROLE_MANAGE,
      PERMISSIONS.MODULE_MANAGE,
      PERMISSIONS.TICKETSTATUS_MANAGE,
      PERMISSIONS.PRIORITY_MANAGE,
      PERMISSIONS.WORKTYPE_MANAGE,
      PERMISSIONS.PROJECTTYPE_MANAGE,
      PERMISSIONS.PERMISSION_READ,
      PERMISSIONS.TIMELOG_READ,
      PERMISSIONS.TIMELOG_MANAGE,
      PERMISSIONS.ATTACHMENT_CREATE,
      PERMISSIONS.ATTACHMENT_READ,
      PERMISSIONS.ATTACHMENT_DELETE,
    ],
  },
  {
    name: 'Member',
    isDefault: true,
    isSystem: false,
    isManagerTier: false,
    permissions: [
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.WORKITEM_CREATE,
      PERMISSIONS.WORKITEM_READ,
      PERMISSIONS.WORKITEM_UPDATE,
      PERMISSIONS.WORKITEM_DELETE,
      PERMISSIONS.COMMENT_CREATE,
      PERMISSIONS.TIMELOG_READ,
      PERMISSIONS.TIMELOG_MANAGE,
      PERMISSIONS.ATTACHMENT_CREATE,
      PERMISSIONS.ATTACHMENT_READ,
      PERMISSIONS.ATTACHMENT_DELETE,
    ],
  },
  {
    name: 'Viewer',
    isDefault: false,
    isSystem: false,
    isManagerTier: false,
    permissions: [
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.WORKITEM_READ,
      PERMISSIONS.TIMELOG_READ,
      PERMISSIONS.ATTACHMENT_READ,
    ],
  },
  {
    // External customer role: can follow the work and comment on it. Also
    // gets WORKITEM_UPDATE, but WorkItemsService restricts them to changing
    // only the status of work items where they're the assignee or QA
    // assignee — see WorkItemsService.assertClientCanUpdate.
    name: 'Client',
    isDefault: false,
    isSystem: false,
    isManagerTier: true,
    permissions: [
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.WORKITEM_READ,
      PERMISSIONS.WORKITEM_UPDATE,
      PERMISSIONS.COMMENT_CREATE,
      PERMISSIONS.ATTACHMENT_READ,
      PERMISSIONS.TIMELOG_READ,
      PERMISSIONS.TIMELOG_MANAGE,
    ],
  },
];
