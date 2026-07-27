/**
 * Permission codes, mirrored from the backend catalog
 * (api-project-ops · common/constants/permissions.ts). Used to gate UI
 * affordances. The backend is the real authority — this is UX only.
 */
export const PERMISSIONS = {
  PROJECT_CREATE: "project.create",
  PROJECT_READ: "project.read",
  PROJECT_UPDATE: "project.update",
  PROJECT_DELETE: "project.delete",
  TASK_CREATE: "task.create",
  TASK_READ: "task.read",
  TASK_UPDATE: "task.update",
  TASK_DELETE: "task.delete",
  MEMBER_INVITE: "member.invite",
  MEMBER_REMOVE: "member.remove",
  ROLE_MANAGE: "role.manage",
  MODULE_MANAGE: "module.manage",
  TICKETSTATUS_MANAGE: "ticketstatus.manage",
  PRIORITY_MANAGE: "priority.manage",
  PROJECTTYPE_MANAGE: "projecttype.manage",
  PLAN_MANAGE: "plan.manage",
  PERMISSION_READ: "permission.read",
  WORKSPACE_MANAGE: "workspace.manage",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
