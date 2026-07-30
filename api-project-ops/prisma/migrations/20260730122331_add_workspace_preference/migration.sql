-- CreateEnum
CREATE TYPE "time_log_past_limit_unit" AS ENUM ('day', 'week', 'month');

-- CreateTable
CREATE TABLE "workspace_preference" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "allow_manual_time_log" BOOLEAN NOT NULL DEFAULT true,
    "allow_past_time_log" BOOLEAN NOT NULL DEFAULT false,
    "past_time_log_limit_value" INTEGER,
    "past_time_log_limit_unit" "time_log_past_limit_unit" NOT NULL DEFAULT 'day',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_preference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_preference_workspace_id_key" ON "workspace_preference"("workspace_id");

-- AddForeignKey
ALTER TABLE "workspace_preference" ADD CONSTRAINT "workspace_preference_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
