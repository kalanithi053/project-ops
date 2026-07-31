-- AlterTable
ALTER TABLE "work_item" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "work_item_project_id_position_idx" ON "work_item"("project_id", "position");
