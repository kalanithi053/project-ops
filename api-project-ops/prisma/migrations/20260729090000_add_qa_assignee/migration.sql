-- AlterTable
ALTER TABLE "task" ADD COLUMN "qa_assignee_id" TEXT;
ALTER TABLE "incident" ADD COLUMN "qa_assignee_id" TEXT;

-- CreateIndex
CREATE INDEX "task_qa_assignee_id_idx" ON "task"("qa_assignee_id");
CREATE INDEX "incident_qa_assignee_id_idx" ON "incident"("qa_assignee_id");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_qa_assignee_id_fkey" FOREIGN KEY ("qa_assignee_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "incident" ADD CONSTRAINT "incident_qa_assignee_id_fkey" FOREIGN KEY ("qa_assignee_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
