-- DropForeignKey
ALTER TABLE "incident" DROP CONSTRAINT "incident_task_id_fkey";

-- DropIndex
DROP INDEX "incident_task_id_idx";

-- AlterTable
ALTER TABLE "incident" DROP COLUMN "task_id";

