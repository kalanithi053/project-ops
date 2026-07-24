-- AlterTable
ALTER TABLE "task" ADD COLUMN     "priority_id" TEXT;

-- CreateTable
CREATE TABLE "priority" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "priority_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "priority_workspace_id_idx" ON "priority"("workspace_id");

-- CreateIndex
CREATE UNIQUE INDEX "priority_workspace_id_name_key" ON "priority"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "task_priority_id_idx" ON "task"("priority_id");

-- AddForeignKey
ALTER TABLE "task" ADD CONSTRAINT "task_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "priority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "priority" ADD CONSTRAINT "priority_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
