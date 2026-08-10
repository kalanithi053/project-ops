-- Grants the existing workitem.update permission code to every workspace's
-- Client role. New PERMISSION_CATALOG grants for existing roles are only
-- applied at workspace-creation time (see workspace-provisioning.ts), so
-- workspaces provisioned before this change would otherwise 403 when a
-- Client tries to update a work item's status. Mirrors
-- 20260803114952_backfill_attachment_permissions.
--
-- workitem.update itself already exists in every workspace's user_permission
-- catalog (it's part of the original PERMISSION_CATALOG), so this only needs
-- to add the role_permission link — no catalog row to seed. Application code
-- (WorkItemsService.assertClientCanUpdate) further restricts what this grant
-- actually lets a Client do: only change statusId, and only on work items
-- where they're the assignee or QA assignee.

INSERT INTO "role_permission" ("role_id", "permission_id")
SELECT role.id, permission.id
FROM "user_role" AS role
JOIN "user_permission" AS permission
  ON permission.workspace_id = role.workspace_id
 AND permission.code = 'workitem.update'
WHERE role.name = 'Client'
  AND NOT EXISTS (
    SELECT 1
    FROM "role_permission"
    WHERE "role_permission"."role_id" = role.id
      AND "role_permission"."permission_id" = permission.id
  );
