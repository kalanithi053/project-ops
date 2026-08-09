-- CreateEnum
CREATE TYPE "project_engagement_type" AS ENUM ('fixed_budget', 'time_and_material', 'retainer');

-- AlterTable
ALTER TABLE "plan" ADD COLUMN     "hub_id" TEXT;

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "engagement_type" "project_engagement_type",
ADD COLUMN     "estimated_date" TIMESTAMP(3),
ADD COLUMN     "estimated_hours" DOUBLE PRECISION,
ADD COLUMN     "hub_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "project_manager_id" TEXT,
ADD COLUMN     "sales_rep_id" TEXT;

-- CreateTable
CREATE TABLE "hub" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_type_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "hub_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "hub_workspace_id_idx" ON "hub"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "hub_project_type_id_name_key" ON "hub"("project_type_id", "name");

-- CreateIndex
CREATE INDEX "plan_hub_id_idx" ON "plan"("hub_id");

-- CreateIndex
CREATE INDEX "project_sales_rep_id_idx" ON "project"("sales_rep_id");

-- CreateIndex
CREATE INDEX "project_project_manager_id_idx" ON "project"("project_manager_id");

-- AddForeignKey
ALTER TABLE "plan" ADD CONSTRAINT "plan_hub_id_fkey" FOREIGN KEY ("hub_id") REFERENCES "hub"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub" ADD CONSTRAINT "hub_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hub" ADD CONSTRAINT "hub_project_type_id_fkey" FOREIGN KEY ("project_type_id") REFERENCES "project_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_sales_rep_id_fkey" FOREIGN KEY ("sales_rep_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project" ADD CONSTRAINT "project_project_manager_id_fkey" FOREIGN KEY ("project_manager_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
