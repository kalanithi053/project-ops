-- AlterTable
ALTER TABLE "incident" ADD COLUMN     "project_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "incident_project_id_idx" ON "incident"("project_id");

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

