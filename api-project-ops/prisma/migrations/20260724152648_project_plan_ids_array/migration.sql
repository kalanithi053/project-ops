/*
  Warnings:

  - You are about to drop the column `plan_id` on the `project` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "project" DROP CONSTRAINT "project_plan_id_fkey";

-- DropIndex
DROP INDEX "project_plan_id_idx";

-- AlterTable
ALTER TABLE "project" DROP COLUMN "plan_id",
ADD COLUMN     "plan_ids" TEXT[] DEFAULT ARRAY[]::TEXT[];
