/**
 * Central permission catalog. These codes are seeded into every workspace's
 * UserPermission table and referenced by @RequirePermission('...') on routes.
 */
export const PERMISSIONS = {
  PROJECT_CREATE: 'project.create',
  PROJECT_READ: 'project.read',
  PROJECT_UPDATE: 'project.update',
  PROJECT_DELETE: 'project.delete',

  TASK_CREATE: 'task.create',
  TASK_READ: 'task.read',
  TASK_UPDATE: 'task.update',
  TASK_DELETE: 'task.delete',

  MEMBER_INVITE: 'member.invite',
  MEMBER_REMOVE: 'member.remove',

  ROLE_MANAGE: 'role.manage',
  MODULE_MANAGE: 'module.manage',
  TICKETSTATUS_MANAGE: 'ticketstatus.manage',
  PLAN_MANAGE: 'plan.manage',
  PERMISSION_READ: 'permission.read',
  WORKSPACE_MANAGE: 'workspace.manage',
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
  { code: PERMISSIONS.TASK_CREATE, description: 'Create tasks' },
  { code: PERMISSIONS.TASK_READ, description: 'View tasks' },
  { code: PERMISSIONS.TASK_UPDATE, description: 'Edit tasks' },
  { code: PERMISSIONS.TASK_DELETE, description: 'Delete tasks' },
  { code: PERMISSIONS.MEMBER_INVITE, description: 'Invite members' },
  { code: PERMISSIONS.MEMBER_REMOVE, description: 'Remove members' },
  { code: PERMISSIONS.ROLE_MANAGE, description: 'Manage roles and permissions' },
  { code: PERMISSIONS.MODULE_MANAGE, description: 'Manage workspace modules' },
  {
    code: PERMISSIONS.TICKETSTATUS_MANAGE,
    description: 'Manage ticket statuses',
  },
  { code: PERMISSIONS.PLAN_MANAGE, description: 'Manage the workspace plan' },
  { code: PERMISSIONS.PERMISSION_READ, description: 'View the permission catalog' },
  {
    code: PERMISSIONS.WORKSPACE_MANAGE,
    description: 'Manage workspace settings',
  },
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
  permissions: PermissionCode[];
}> = [
  {
    name: 'Owner',
    isDefault: false,
    isSystem: true,
    permissions: ALL_PERMISSION_CODES,
  },
  {
    name: 'Admin',
    isDefault: false,
    isSystem: false,
    permissions: [
      PERMISSIONS.PROJECT_CREATE,
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.PROJECT_UPDATE,
      PERMISSIONS.PROJECT_DELETE,
      PERMISSIONS.TASK_CREATE,
      PERMISSIONS.TASK_READ,
      PERMISSIONS.TASK_UPDATE,
      PERMISSIONS.TASK_DELETE,
      PERMISSIONS.MEMBER_INVITE,
      PERMISSIONS.MEMBER_REMOVE,
      PERMISSIONS.ROLE_MANAGE,
      PERMISSIONS.MODULE_MANAGE,
      PERMISSIONS.TICKETSTATUS_MANAGE,
      PERMISSIONS.PERMISSION_READ,
    ],
  },
  {
    name: 'Member',
    isDefault: true,
    isSystem: false,
    permissions: [
      PERMISSIONS.PROJECT_CREATE,
      PERMISSIONS.PROJECT_READ,
      PERMISSIONS.PROJECT_UPDATE,
      PERMISSIONS.TASK_CREATE,
      PERMISSIONS.TASK_READ,
      PERMISSIONS.TASK_UPDATE,
      PERMISSIONS.TASK_DELETE,
    ],
  },
  {
    name: 'Viewer',
    isDefault: false,
    isSystem: false,
    permissions: [PERMISSIONS.PROJECT_READ, PERMISSIONS.TASK_READ],
  },
];
