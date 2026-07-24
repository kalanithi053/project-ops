-- DropForeignKey
ALTER TABLE "project_type" DROP CONSTRAINT "project_type_plan_id_fkey";

-- DropIndex
DROP INDEX "project_type_plan_id_idx";

-- AlterTable
ALTER TABLE "plan" ADD COLUMN     "project_type_id" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "project_type" DROP COLUMN "plan_id";

-- CreateIndex
CREATE INDEX "plan_project_type_id_idx" ON "plan"("project_type_id");

-- AddForeignKey
ALTER TABLE "plan" ADD CONSTRAINT "plan_project_type_id_fkey" FOREIGN KEY ("project_type_id") REFERENCES "project_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

