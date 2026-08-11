-- Drop workflow tables removed from domain model
DROP TABLE IF EXISTS "Acknowledgement";
DROP TABLE IF EXISTS "SwapRequest";
DROP TABLE IF EXISTS "CoverageRequest";
DROP TABLE IF EXISTS "LeaveRequest";
DROP TABLE IF EXISTS "Availability";

-- Drop workflow enums
DROP TYPE IF EXISTS "AcknowledgementStatus";
DROP TYPE IF EXISTS "SwapRequestStatus";
DROP TYPE IF EXISTS "CoverageRequestStatus";
DROP TYPE IF EXISTS "LeaveRequestStatus";
DROP TYPE IF EXISTS "LeaveDurationKind";
DROP TYPE IF EXISTS "AvailabilityKind";

-- Convert legacy roles before shrinking enum
UPDATE "OrganizationMembership"
SET "role" = 'SCHEDULER'
WHERE "role" = 'APPROVER';

DELETE FROM "OrganizationMembership"
WHERE "role" IN ('STAFF', 'PAYROLL_VIEWER', 'AUDITOR');

-- Recreate OrganizationRole with two values
CREATE TYPE "OrganizationRole_new" AS ENUM ('SYSTEM_ADMIN', 'SCHEDULER');

ALTER TABLE "OrganizationMembership"
  ALTER COLUMN "role" TYPE "OrganizationRole_new"
  USING ("role"::text::"OrganizationRole_new");

DROP TYPE "OrganizationRole";
ALTER TYPE "OrganizationRole_new" RENAME TO "OrganizationRole";

-- CreateTable
CREATE TABLE "ScheduleShareLink" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleVersionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleShareLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleShareLink_tokenHash_key" ON "ScheduleShareLink"("tokenHash");

-- CreateIndex
CREATE INDEX "ScheduleShareLink_organizationId_scheduleVersionId_idx" ON "ScheduleShareLink"("organizationId", "scheduleVersionId");

-- CreateIndex
CREATE INDEX "ScheduleShareLink_organizationId_expiresAt_idx" ON "ScheduleShareLink"("organizationId", "expiresAt");

-- AddForeignKey
ALTER TABLE "ScheduleShareLink" ADD CONSTRAINT "ScheduleShareLink_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleShareLink" ADD CONSTRAINT "ScheduleShareLink_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "ScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
