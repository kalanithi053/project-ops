-- CreateEnum
CREATE TYPE "work_type_category" AS ENUM ('task', 'incident', 'bug');

-- CreateTable
CREATE TABLE "work_type" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "category" "work_type_category" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "work_type_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_type_workspace_id_idx" ON "work_type"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_type_workspace_id_name_key" ON "work_type"("workspace_id", "name");

-- AddForeignKey
ALTER TABLE "work_type" ADD CONSTRAINT "work_type_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
