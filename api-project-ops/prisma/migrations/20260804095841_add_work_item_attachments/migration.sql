-- AlterTable
ALTER TABLE "attachment" ADD COLUMN     "work_item_id" TEXT;

-- CreateIndex
CREATE INDEX "attachment_work_item_id_idx" ON "attachment"("work_item_id");

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;
