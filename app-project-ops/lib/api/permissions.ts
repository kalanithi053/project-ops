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
  WORKITEM_CREATE: "workitem.create",
  WORKITEM_READ: "workitem.read",
  WORKITEM_UPDATE: "workitem.update",
  WORKITEM_DELETE: "workitem.delete",
  COMMENT_CREATE: "comment.create",
  MEMBER_INVITE: "member.invite",
  MEMBER_REMOVE: "member.remove",
  ROLE_MANAGE: "role.manage",
  MODULE_MANAGE: "module.manage",
  TICKETSTATUS_MANAGE: "ticketstatus.manage",
  PRIORITY_MANAGE: "priority.manage",
  WORKTYPE_MANAGE: "worktype.manage",
  PROJECTTYPE_MANAGE: "projecttype.manage",
  PLAN_MANAGE: "plan.manage",
  HUB_MANAGE: "hub.manage",
  PERMISSION_READ: "permission.read",
  WORKSPACE_MANAGE: "workspace.manage",
  TIMELOG_READ: "timelog.read",
  TIMELOG_MANAGE: "timelog.manage",
  ATTACHMENT_CREATE: "attachment.create",
  ATTACHMENT_READ: "attachment.read",
  ATTACHMENT_DELETE: "attachment.delete",
} as const;

export type PermissionCode = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
