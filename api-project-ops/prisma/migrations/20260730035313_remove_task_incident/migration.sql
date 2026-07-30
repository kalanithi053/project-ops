/*
  Warnings:

  - You are about to drop the column `incident_id` on the `comment` table. All the data in the column will be lost.
  - You are about to drop the column `task_id` on the `comment` table. All the data in the column will be lost.
  - You are about to drop the `incident` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `task` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "comment" DROP CONSTRAINT "comment_incident_id_fkey";

-- DropForeignKey
ALTER TABLE "comment" DROP CONSTRAINT "comment_task_id_fkey";

-- DropForeignKey
ALTER TABLE "incident" DROP CONSTRAINT "incident_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "incident" DROP CONSTRAINT "incident_project_id_fkey";

-- DropForeignKey
ALTER TABLE "incident" DROP CONSTRAINT "incident_qa_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "incident" DROP CONSTRAINT "incident_reported_by_fkey";

-- DropForeignKey
ALTER TABLE "incident" DROP CONSTRAINT "incident_status_id_fkey";

-- DropForeignKey
ALTER TABLE "incident" DROP CONSTRAINT "incident_workspace_id_fkey";

-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_created_by_fkey";

-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_module_instance_id_fkey";

-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_priority_id_fkey";

-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_project_id_fkey";

-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_qa_assignee_id_fkey";

-- DropForeignKey
ALTER TABLE "task" DROP CONSTRAINT "task_status_id_fkey";

-- DropIndex
DROP INDEX "comment_incident_id_idx";

-- DropIndex
DROP INDEX "comment_task_id_idx";

-- AlterTable
ALTER TABLE "comment" DROP COLUMN "incident_id",
DROP COLUMN "task_id";

-- DropTable
DROP TABLE "incident";

-- DropTable
DROP TABLE "task";
