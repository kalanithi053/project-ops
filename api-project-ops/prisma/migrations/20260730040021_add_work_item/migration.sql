-- CreateTable
CREATE TABLE "work_item" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "module_instance_id" TEXT NOT NULL,
    "work_item_type_id" TEXT,
    "name" TEXT NOT NULL,
    "prefix" TEXT,
    "description" TEXT,
    "start_date" TIMESTAMP(3),
    "due_date" TIMESTAMP(3),
    "status_id" TEXT,
    "priority_id" TEXT,
    "assignee_id" TEXT,
    "qa_assignee_id" TEXT,
    "created_by" TEXT NOT NULL,
    "estimate_hours" DOUBLE PRECISION,
    "completed_hours" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_item_project_id_idx" ON "work_item"("project_id");

-- CreateIndex
CREATE INDEX "work_item_module_instance_id_idx" ON "work_item"("module_instance_id");

-- CreateIndex
CREATE INDEX "work_item_work_item_type_id_idx" ON "work_item"("work_item_type_id");

-- CreateIndex
CREATE INDEX "work_item_status_id_idx" ON "work_item"("status_id");

-- CreateIndex
CREATE INDEX "work_item_priority_id_idx" ON "work_item"("priority_id");

-- CreateIndex
CREATE INDEX "work_item_assignee_id_idx" ON "work_item"("assignee_id");

-- CreateIndex
CREATE INDEX "work_item_qa_assignee_id_idx" ON "work_item"("qa_assignee_id");

-- AddForeignKey
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_module_instance_id_fkey" FOREIGN KEY ("module_instance_id") REFERENCES "module_instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_work_item_type_id_fkey" FOREIGN KEY ("work_item_type_id") REFERENCES "work_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_status_id_fkey" FOREIGN KEY ("status_id") REFERENCES "ticket_status"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_priority_id_fkey" FOREIGN KEY ("priority_id") REFERENCES "priority"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_qa_assignee_id_fkey" FOREIGN KEY ("qa_assignee_id") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item" ADD CONSTRAINT "work_item_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
