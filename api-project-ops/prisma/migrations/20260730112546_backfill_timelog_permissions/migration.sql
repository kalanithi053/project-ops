-- Backfills the new timelog.read / timelog.manage permission codes into every
-- existing workspace's catalog and default roles. New PERMISSION_CATALOG
-- entries are only seeded into user_permission/role_permission at
-- workspace-creation time (see workspace-provisioning.ts), so workspaces
-- provisioned before this feature shipped would otherwise 403 on every
-- time-log route.

-- 1. Seed the catalog row for every workspace that doesn't have it yet.
INSERT INTO "user_permission" ("id", "workspace_id", "code", "description")
SELECT gen_random_uuid()::text, workspace.id, 'timelog.read', 'View time logs'
FROM "workspace" AS workspace
WHERE NOT EXISTS (
  SELECT 1
  FROM "user_permission"
  WHERE "user_permission"."workspace_id" = workspace.id
    AND "user_permission"."code" = 'timelog.read'
);

INSERT INTO "user_permission" ("id", "workspace_id", "code", "description")
SELECT
  gen_random_uuid()::text,
  workspace.id,
  'timelog.manage',
  'Log time (manual or timer) and edit/delete your own entries'
FROM "workspace" AS workspace
WHERE NOT EXISTS (
  SELECT 1
  FROM "user_permission"
  WHERE "user_permission"."workspace_id" = workspace.id
    AND "user_permission"."code" = 'timelog.manage'
);

-- 2. Grant both codes to Owner/Admin/Member, and read-only to Viewer —
--    matching DEFAULT_ROLES in src/common/constants/permissions.ts. Client
--    gets neither, also matching DEFAULT_ROLES.
INSERT INTO "role_permission" ("role_id", "permission_id")
SELECT role.id, permission.id
FROM "user_role" AS role
JOIN "user_permission" AS permission
  ON permission.workspace_id = role.workspace_id
 AND permission.code IN ('timelog.read', 'timelog.manage')
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
 AND permission.code = 'timelog.read'
WHERE role.name = 'Viewer'
  AND NOT EXISTS (
    SELECT 1
    FROM "role_permission"
    WHERE "role_permission"."role_id" = role.id
      AND "role_permission"."permission_id" = permission.id
  );
