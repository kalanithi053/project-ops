-- DropIndex
DROP INDEX "otp_request_username_created_at_idx";

-- DropIndex
DROP INDEX "user_username_idx";

-- DropIndex
DROP INDEX "user_username_key";

-- AlterTable
ALTER TABLE "otp_request" DROP COLUMN "username",
ADD COLUMN     "email" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "user" DROP COLUMN "username",
ADD COLUMN     "static_otp" TEXT DEFAULT '123456',
ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE INDEX "otp_request_email_created_at_idx" ON "otp_request"("email", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

