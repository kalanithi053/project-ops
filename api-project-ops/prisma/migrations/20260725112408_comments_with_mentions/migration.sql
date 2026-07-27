-- CreateTable
CREATE TABLE "comment" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "task_id" TEXT,
    "incident_id" TEXT,
    "body" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_mention" (
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "comment_mention_pkey" PRIMARY KEY ("comment_id","user_id")
);

-- CreateIndex
CREATE INDEX "comment_workspace_id_idx" ON "comment"("workspace_id");

-- CreateIndex
CREATE INDEX "comment_task_id_idx" ON "comment"("task_id");

-- CreateIndex
CREATE INDEX "comment_incident_id_idx" ON "comment"("incident_id");

-- CreateIndex
CREATE INDEX "comment_mention_user_id_idx" ON "comment_mention"("user_id");

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_incident_id_fkey" FOREIGN KEY ("incident_id") REFERENCES "incident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment" ADD CONSTRAINT "comment_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mention" ADD CONSTRAINT "comment_mention_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_mention" ADD CONSTRAINT "comment_mention_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
