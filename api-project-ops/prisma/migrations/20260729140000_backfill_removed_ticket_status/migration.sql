INSERT INTO "ticket_status" (
  "id",
  "workspace_id",
  "name",
  "color",
  "order",
  "is_default",
  "can_delete",
  "category"
)
SELECT
  'removed-' || workspace.id,
  workspace.id,
  'Removed',
  '#64748b',
  7,
  false,
  false,
  'removed'::"status_category"
FROM "workspace" AS workspace
WHERE NOT EXISTS (
  SELECT 1
  FROM "ticket_status"
  WHERE "ticket_status"."workspace_id" = workspace.id
    AND lower("ticket_status"."name") = 'removed'
);

UPDATE "ticket_status"
SET "can_delete" = false
WHERE lower("name") = 'removed';

UPDATE "ticket_status"
SET "category" = 'removed'::"status_category"
WHERE lower("name") = 'removed';
