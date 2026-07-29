-- Move incidents onto the workspace-configured ticket-status pipeline.
ALTER TABLE "incident" ADD COLUMN "status_id" TEXT;

-- Legacy workspaces normally have provisioned statuses. For the exceptional
-- workspace that has incidents but no statuses, create a New status first.
INSERT INTO "ticket_status" ("id", "workspace_id", "name", "color", "order", "is_default", "category")
SELECT
  'incident-default-' || workspace.id,
  workspace.id,
  'New',
  '#e4f468ff',
  0,
  true,
  'new'::"status_category"
FROM "workspace" AS workspace
WHERE EXISTS (
  SELECT 1 FROM "incident" WHERE "incident"."workspace_id" = workspace.id
)
AND NOT EXISTS (
  SELECT 1 FROM "ticket_status" WHERE "ticket_status"."workspace_id" = workspace.id
);

-- Preserve the prior lifecycle by choosing equivalent configured categories.
UPDATE "incident" AS incident
SET "status_id" = (
  SELECT "ticket_status"."id"
  FROM "ticket_status"
  WHERE "ticket_status"."workspace_id" = incident."workspace_id"
  ORDER BY
    CASE
      WHEN incident."status" = 'open' AND "ticket_status"."category" = 'todo' THEN 0
      WHEN incident."status" = 'open' AND "ticket_status"."category" = 'new' THEN 1
      WHEN incident."status" = 'in_progress' AND "ticket_status"."category" = 'in_progress' THEN 0
      WHEN incident."status" = 'resolved' AND "ticket_status"."category" = 'done' THEN 0
      ELSE 2
  END,
  "ticket_status"."order" ASC
  LIMIT 1
);

ALTER TABLE "incident" ALTER COLUMN "status_id" SET NOT NULL;
ALTER TABLE "incident" DROP COLUMN "status";
ALTER TABLE "incident"
  ADD CONSTRAINT "incident_status_id_fkey"
  FOREIGN KEY ("status_id") REFERENCES "ticket_status"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "incident_status_id_idx" ON "incident"("status_id");
DROP TYPE "incident_status";
