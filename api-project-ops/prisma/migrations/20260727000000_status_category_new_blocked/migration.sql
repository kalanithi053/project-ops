-- AlterEnum
-- Add missing 'new' and 'blocked' values to status_category enum.
ALTER TYPE "status_category" ADD VALUE 'new';
ALTER TYPE "status_category" ADD VALUE 'blocked';
