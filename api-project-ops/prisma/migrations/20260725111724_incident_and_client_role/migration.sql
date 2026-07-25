-- CreateEnum
CREATE TYPE "incident_status" AS ENUM ('open', 'in_progress', 'resolved');

-- CreateTable
CREATE TABLE "incident" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "incident_status" NOT NULL DEFAULT 'open',
    "reported_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incident_workspace_id_idx" ON "incident"("workspace_id");

-- CreateIndex
CREATE INDEX "incident_task_id_idx" ON "incident"("task_id");

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incident" ADD CONSTRAINT "incident_reported_by_fkey" FOREIGN KEY ("reported_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
