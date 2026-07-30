-- CreateEnum
CREATE TYPE "theme_mode" AS ENUM ('light', 'dark', 'system');

-- AlterTable
ALTER TABLE "workspace_member" ADD COLUMN     "theme" "theme_mode" NOT NULL DEFAULT 'system';
