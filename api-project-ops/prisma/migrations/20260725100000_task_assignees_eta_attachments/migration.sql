-- Estimated effort, in whole hours.
ALTER TABLE "task" ADD COLUMN "eta_hours" INTEGER;

-- Assignees move from a single FK column to a join table so a task can be
-- worked by several people.
CREATE TABLE "task_assignee" (
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_assignee_pkey" PRIMARY KEY ("task_id","user_id")
);

CREATE INDEX "task_assignee_user_id_idx" ON "task_assignee"("user_id");

-- Carry existing single assignments across before the column is dropped,
-- otherwise the migration would silently unassign every task.
INSERT INTO "task_assignee" ("task_id", "user_id")
SELECT "id", "assignee_id" FROM "task" WHERE "assignee_id" IS NOT NULL;

ALTER TABLE "task" DROP CONSTRAINT "task_assignee_id_fkey";
ALTER TABLE "task" DROP COLUMN "assignee_id";

ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_assignee" ADD CONSTRAINT "task_assignee_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Documents attached to a task. Bytes live on disk under the API's uploads
-- directory; this table holds the metadata and the randomised disk name.
CREATE TABLE "task_attachment" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "task_attachment_task_id_idx" ON "task_attachment"("task_id");

ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "task_attachment" ADD CONSTRAINT "task_attachment_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
