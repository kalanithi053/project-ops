-- CreateEnum
CREATE TYPE "theme_color" AS ENUM ('blue', 'green', 'purple', 'red', 'orange', 'pink', 'gray', 'yellow');

-- AlterTable
ALTER TABLE "workspace_member" ADD COLUMN     "theme_color" "theme_color" NOT NULL DEFAULT 'blue';

-- CreateTable
CREATE TABLE "attachment" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "s3_key" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attachment_workspace_id_idx" ON "attachment"("workspace_id");

-- CreateIndex
CREATE INDEX "attachment_project_id_idx" ON "attachment"("project_id");

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
