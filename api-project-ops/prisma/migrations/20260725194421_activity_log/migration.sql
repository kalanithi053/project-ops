-- CreateTable
CREATE TABLE "activity_log" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activity_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "activity_log_workspace_id_idx" ON "activity_log"("workspace_id");

-- CreateIndex
CREATE INDEX "activity_log_entity_type_entity_id_idx" ON "activity_log"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
