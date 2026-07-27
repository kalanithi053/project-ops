-- AlterTable
ALTER TABLE "incident" ADD COLUMN     "completed_hours" DOUBLE PRECISION,
ADD COLUMN     "estimate_hours" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "task" ADD COLUMN     "completed_hours" DOUBLE PRECISION,
ADD COLUMN     "estimate_hours" DOUBLE PRECISION;
