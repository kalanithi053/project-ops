-- AlterTable
ALTER TABLE "incident" ADD COLUMN     "assignee_id" TEXT;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
