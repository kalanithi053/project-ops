-- AlterTable
ALTER TABLE "comment" ADD COLUMN     "work_item_id" TEXT;

-- CreateIndex
CREATE INDEX "comment_work_item_id_idx" ON "comment"("work_item_id");

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
