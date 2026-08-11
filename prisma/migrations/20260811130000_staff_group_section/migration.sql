-- CreateEnum
CREATE TYPE "StaffGroupSection" AS ENUM ('RESULT_CAPABLE', 'RESULT_NOT_CAPABLE', 'PART_TIME');

-- AlterTable
ALTER TABLE "StaffProfile" ADD COLUMN "staffGroupSection" "StaffGroupSection" NOT NULL DEFAULT 'RESULT_CAPABLE';

-- DropIndex
DROP INDEX "StaffProfile_organizationId_staffGroupId_rowOrder_idx";

-- CreateIndex
CREATE INDEX "StaffProfile_organizationId_staffGroupId_staffGroupSection_rowOrder_idx" ON "StaffProfile"("organizationId", "staffGroupId", "staffGroupSection", "rowOrder");
