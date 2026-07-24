-- DropIndex
DROP INDEX "module_workspace_id_key_key";

-- AlterTable
ALTER TABLE "module" ADD COLUMN     "plan_id" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "module_plan_id_idx" ON "module"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "module_plan_id_key_key" ON "module"("plan_id", "key");

-- AddForeignKey
ALTER TABLE "module" ADD CONSTRAINT "module_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

