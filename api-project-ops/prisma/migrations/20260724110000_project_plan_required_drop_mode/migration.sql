-- AlterTable
ALTER TABLE "project" DROP COLUMN "mode",
ADD COLUMN     "plan_id" TEXT;

-- DropEnum
DROP TYPE "project_mode";

-- CreateIndex
CREATE INDEX "project_plan_id_idx" ON "project"("plan_id");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

