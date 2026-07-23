-- CreateEnum
CREATE TYPE "project_mode" AS ENUM ('HubSpot', 'Dev');

-- AlterTable
ALTER TABLE "project" ADD COLUMN     "mode" "project_mode" NOT NULL DEFAULT 'Dev';
