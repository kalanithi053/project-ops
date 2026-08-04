-- Horizontal partitioning: activity_log and time_log, RANGE by month.
--
-- Postgres can't ALTER an existing table into a partitioned one in place, so
-- each table is: renamed aside, recreated as a partitioned parent (with the
-- partition key folded into the primary key, since Postgres requires that),
-- given a handful of monthly partitions bracketing the current data plus a
-- DEFAULT catch-all so no insert ever fails, backfilled from the old table,
-- reindexed, re-fenced with its foreign keys, then the old table is dropped.
--
-- No retention/archival tooling here (out of scope) — future months need
-- their own partitions created before they're needed, same as the DEFAULT
-- partition's contents should eventually be split out as it grows.

-- =============================================================================
-- activity_log — RANGE by created_at
-- =============================================================================

ALTER TABLE "activity_log" RENAME TO "activity_log_old";
-- Index-backed objects (the PK and both named indexes) are unique schema-wide,
-- not per-table, and the old table is about to be dropped anyway — drop them
-- so the new partitioned table can reuse the same names.
ALTER TABLE "activity_log_old" DROP CONSTRAINT "activity_log_pkey";
DROP INDEX "activity_log_workspace_id_idx";
DROP INDEX "activity_log_entity_type_entity_id_idx";

CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");

CREATE TABLE "activity_log_y2026m06" PARTITION OF "activity_log"
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE "activity_log_y2026m07" PARTITION OF "activity_log"
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE "activity_log_y2026m08" PARTITION OF "activity_log"
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE "activity_log_y2026m09" PARTITION OF "activity_log"
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
-- Catch-all for anything outside the pre-created window (older backfilled
-- rows, or future rows once retention tooling should have added a partition
-- but hasn't yet) — without this, an out-of-range insert would just fail.
CREATE TABLE "activity_log_default" PARTITION OF "activity_log" DEFAULT;

INSERT INTO "activity_log"
    ("id", "workspace_id", "project_id", "entity_type", "entity_id", "action", "user_id", "metadata", "created_at")
SELECT "id", "workspace_id", "project_id", "entity_type", "entity_id", "action", "user_id", "metadata", "created_at"
FROM "activity_log_old";

-- Indexes created on the partitioned parent propagate to every partition.
CREATE INDEX "activity_log_workspace_id_idx" ON "activity_log"("workspace_id");
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log"("entity_type", "entity_id");

ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "activity_log_old";

-- =============================================================================
-- time_log — RANGE by log_date
-- =============================================================================

ALTER TABLE "time_log" RENAME TO "time_log_old";
ALTER TABLE "time_log_old" DROP CONSTRAINT "time_log_pkey";
DROP INDEX "time_log_workspace_id_idx";
DROP INDEX "time_log_project_id_idx";
DROP INDEX "time_log_work_item_id_idx";
DROP INDEX "time_log_user_id_idx";

CREATE TABLE "time_log" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "work_item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "log_date" DATE NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "duration_minutes" INTEGER NOT NULL,
    "billing_type" "time_log_billing_type" NOT NULL DEFAULT 'billable',
    "source" "time_log_source" NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_log_pkey" PRIMARY KEY ("id", "log_date")
) PARTITION BY RANGE ("log_date");

CREATE TABLE "time_log_y2026m06" PARTITION OF "time_log"
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');
CREATE TABLE "time_log_y2026m07" PARTITION OF "time_log"
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');
CREATE TABLE "time_log_y2026m08" PARTITION OF "time_log"
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');
CREATE TABLE "time_log_y2026m09" PARTITION OF "time_log"
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');
CREATE TABLE "time_log_default" PARTITION OF "time_log" DEFAULT;

INSERT INTO "time_log"
    ("id", "workspace_id", "project_id", "work_item_id", "user_id", "log_date", "start_time", "end_time",
     "duration_minutes", "billing_type", "source", "notes", "created_at", "updated_at")
SELECT "id", "workspace_id", "project_id", "work_item_id", "user_id", "log_date", "start_time", "end_time",
       "duration_minutes", "billing_type", "source", "notes", "created_at", "updated_at"
FROM "time_log_old";

CREATE INDEX "time_log_workspace_id_idx" ON "time_log"("workspace_id");
CREATE INDEX "time_log_project_id_idx" ON "time_log"("project_id");
CREATE INDEX "time_log_work_item_id_idx" ON "time_log"("work_item_id");
CREATE INDEX "time_log_user_id_idx" ON "time_log"("user_id");

ALTER TABLE "time_log" ADD CONSTRAINT "time_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "time_log" ADD CONSTRAINT "time_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "time_log" ADD CONSTRAINT "time_log_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "time_log" ADD CONSTRAINT "time_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

DROP TABLE "time_log_old";
