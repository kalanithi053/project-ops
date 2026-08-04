-- Vertical partitioning: split WorkItem.description into its own 1:1 table.
-- Order matters here (unlike the auto-generated diff): create the table,
-- backfill every existing row's description into it, only then drop the
-- column — so no data is lost in the move.

-- CreateTable
CREATE TABLE "work_item_detail" (
    "work_item_id" TEXT NOT NULL,
    "description" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_item_detail_pkey" PRIMARY KEY ("work_item_id")
);

-- AddForeignKey
ALTER TABLE "work_item_detail" ADD CONSTRAINT "work_item_detail_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: one detail row per existing work item, carrying over its
-- current description (including NULL) so the 1:1 relation is always
-- populated going forward.
INSERT INTO "work_item_detail" ("work_item_id", "description", "updated_at")
SELECT "id", "description", now() FROM "work_item";

-- AlterTable
ALTER TABLE "work_item" DROP COLUMN "description";
