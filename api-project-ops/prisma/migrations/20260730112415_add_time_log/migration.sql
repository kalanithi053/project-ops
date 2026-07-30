-- CreateEnum
CREATE TYPE "time_log_billing_type" AS ENUM ('billable', 'non_billable');

-- CreateEnum
CREATE TYPE "time_log_source" AS ENUM ('manual', 'timer');

-- CreateTable
CREATE TABLE "time_log" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "work_item_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "log_date" DATE NOT NULL,
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "duration_minutes" INTEGER NOT NULL,
    "billing_type" "time_log_billing_type" NOT NULL DEFAULT 'billable',
    "source" "time_log_source" NOT NULL DEFAULT 'manual',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_log_workspace_id_idx" ON "time_log"("workspace_id");

-- CreateIndex
CREATE INDEX "time_log_project_id_idx" ON "time_log"("project_id");

-- CreateIndex
CREATE INDEX "time_log_work_item_id_idx" ON "time_log"("work_item_id");

-- CreateIndex
CREATE INDEX "time_log_user_id_idx" ON "time_log"("user_id");

-- AddForeignKey
ALTER TABLE "time_log" ADD CONSTRAINT "time_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_log" ADD CONSTRAINT "time_log_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_log" ADD CONSTRAINT "time_log_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_item"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_log" ADD CONSTRAINT "time_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
