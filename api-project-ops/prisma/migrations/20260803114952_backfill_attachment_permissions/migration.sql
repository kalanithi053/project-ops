-- Backfills the new attachment.create / attachment.read / attachment.delete
-- permission codes into every existing workspace's catalog and default
-- roles. New PERMISSION_CATALOG entries are only seeded into
-- user_permission/role_permission at workspace-creation time (see
-- workspace-provisioning.ts), so workspaces provisioned before this feature
-- shipped would otherwise 403 on every attachment route. Mirrors
-- 20260730112546_backfill_timelog_permissions.

-- 1. Seed the catalog row for every workspace that doesn't have it yet.
INSERT INTO "user_permission" ("id", "workspace_id", "code", "description")
SELECT gen_random_uuid()::text, workspace.id, 'attachment.create', 'Upload project files'
FROM "workspace" AS workspace
WHERE NOT EXISTS (
  SELECT 1
  FROM "user_permission"
  WHERE "user_permission"."workspace_id" = workspace.id
    AND "user_permission"."code" = 'attachment.create'
);

INSERT INTO "user_permission" ("id", "workspace_id", "code", "description")
SELECT gen_random_uuid()::text, workspace.id, 'attachment.read', 'View and download project files'
FROM "workspace" AS workspace
WHERE NOT EXISTS (
  SELECT 1
  FROM "user_permission"
  WHERE "user_permission"."workspace_id" = workspace.id
    AND "user_permission"."code" = 'attachment.read'
);

INSERT INTO "user_permission" ("id", "workspace_id", "code", "description")
SELECT gen_random_uuid()::text, workspace.id, 'attachment.delete', 'Delete project files'
FROM "workspace" AS workspace
WHERE NOT EXISTS (
  SELECT 1
  FROM "user_permission"
  WHERE "user_permission"."workspace_id" = workspace.id
    AND "user_permission"."code" = 'attachment.delete'
);

-- 2. Grant all three to Owner/Admin/Member, and read-only to Viewer/Client —
--    matching DEFAULT_ROLES in src/common/constants/permissions.ts.
INSERT INTO "role_permission" ("role_id", "permission_id")
SELECT role.id, permission.id
FROM "user_role" AS role
JOIN "user_permission" AS permission
  ON permission.workspace_id = role.workspace_id
 AND permission.code IN ('attachment.create', 'attachment.read', 'attachment.delete')
WHERE role.name IN ('Owner', 'Admin', 'Member')
  AND NOT EXISTS (
    SELECT 1
    FROM "role_permission"
    WHERE "role_permission"."role_id" = role.id
      AND "role_permission"."permission_id" = permission.id
  );

INSERT INTO "role_permission" ("role_id", "permission_id")
SELECT role.id, permission.id
FROM "user_role" AS role
JOIN "user_permission" AS permission
  ON permission.workspace_id = role.workspace_id
 AND permission.code = 'attachment.read'
WHERE role.name IN ('Viewer', 'Client')
  AND NOT EXISTS (
    SELECT 1
    FROM "role_permission"
    WHERE "role_permission"."role_id" = role.id
      AND "role_permission"."permission_id" = permission.id
  );
