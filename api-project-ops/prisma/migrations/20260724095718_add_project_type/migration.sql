-- AlterTable
ALTER TABLE "project" ADD COLUMN     "project_type_id" TEXT;

-- CreateTable
CREATE TABLE "project_type" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_plan_add" BOOLEAN NOT NULL DEFAULT true,
    "plan_id" TEXT,

    CONSTRAINT "project_type_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_type_workspace_id_idx" ON "project_type"("workspace_id");

-- CreateIndex
CREATE INDEX "project_type_plan_id_idx" ON "project_type"("plan_id");

-- CreateIndex
CREATE UNIQUE INDEX "project_type_workspace_id_name_key" ON "project_type"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "project_project_type_id_idx" ON "project"("project_type_id");

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_project_type_id_fkey" FOREIGN KEY ("project_type_id") REFERENCES "project_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_type" ADD CONSTRAINT "project_type_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_type" ADD CONSTRAINT "project_type_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
