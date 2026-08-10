-- AlterTable
ALTER TABLE "user_role" ADD COLUMN     "is_manager_tier" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: existing Owner/Admin/Client roles (across every workspace) start
-- out manager-tier, matching the name-based check this column replaces.
-- Newly-provisioned workspaces get this from DEFAULT_ROLES instead.
UPDATE "user_role" SET "is_manager_tier" = true WHERE "name" IN ('Owner', 'Admin', 'Client');
