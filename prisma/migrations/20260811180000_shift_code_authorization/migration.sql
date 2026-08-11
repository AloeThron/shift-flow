-- Drop Competency layer; สิทธิปฏิบัติงานผูกรหัสเวรโดยตรง (ไม่ backfill)

-- DropForeignKey
ALTER TABLE "StaffCompetencyAuthorization" DROP CONSTRAINT IF EXISTS "StaffCompetencyAuthorization_competencyId_fkey";
ALTER TABLE "StaffCompetencyAuthorization" DROP CONSTRAINT IF EXISTS "StaffCompetencyAuthorization_staffProfileId_fkey";
ALTER TABLE "StaffCompetencyAuthorization" DROP CONSTRAINT IF EXISTS "StaffCompetencyAuthorization_authorizedByStaffId_fkey";
ALTER TABLE "StaffCompetencyAuthorization" DROP CONSTRAINT IF EXISTS "StaffCompetencyAuthorization_organizationId_fkey";

-- DropTable
DROP TABLE IF EXISTS "StaffCompetencyAuthorization";
DROP TABLE IF EXISTS "Competency";

-- AlterTable
ALTER TABLE "ShiftCodeDemand" DROP COLUMN IF EXISTS "requiredCompetencyId";
ALTER TABLE "ShiftTemplate" DROP COLUMN IF EXISTS "requiredCompetencyIds";

-- CreateTable
CREATE TABLE "StaffShiftAuthorization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "shiftCodeId" TEXT,
    "coversAllShiftCodes" BOOLEAN NOT NULL DEFAULT false,
    "level" TEXT,
    "authorizedByStaffId" TEXT,
    "assessedAt" DATE NOT NULL,
    "expiresAt" DATE,
    "requiresSupervision" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffShiftAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffShiftAuthorization_organizationId_staffProfileId_idx" ON "StaffShiftAuthorization"("organizationId", "staffProfileId");
CREATE INDEX "StaffShiftAuthorization_organizationId_expiresAt_idx" ON "StaffShiftAuthorization"("organizationId", "expiresAt");
CREATE INDEX "StaffShiftAuthorization_organizationId_staffProfileId_coversAllShiftCodes_idx" ON "StaffShiftAuthorization"("organizationId", "staffProfileId", "coversAllShiftCodes");
CREATE UNIQUE INDEX "StaffShiftAuthorization_organizationId_staffProfileId_shiftCodeId_key" ON "StaffShiftAuthorization"("organizationId", "staffProfileId", "shiftCodeId");

-- AddForeignKey
ALTER TABLE "StaffShiftAuthorization" ADD CONSTRAINT "StaffShiftAuthorization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffShiftAuthorization" ADD CONSTRAINT "StaffShiftAuthorization_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffShiftAuthorization" ADD CONSTRAINT "StaffShiftAuthorization_shiftCodeId_fkey" FOREIGN KEY ("shiftCodeId") REFERENCES "ShiftCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffShiftAuthorization" ADD CONSTRAINT "StaffShiftAuthorization_authorizedByStaffId_fkey" FOREIGN KEY ("authorizedByStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
