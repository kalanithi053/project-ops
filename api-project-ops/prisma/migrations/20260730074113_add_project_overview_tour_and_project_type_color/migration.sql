-- AlterTable
ALTER TABLE "user" ADD COLUMN     "is_project_overview_tour_done" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "project_overview_tour_completed_at" TIMESTAMP(3);
