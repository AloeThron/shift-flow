-- ยุบ WorkArea เข้า Department และแทน CoverageRequirement ด้วน ShiftCodeDemand

-- ลบ FK ที่อ้าง WorkArea / CoverageRequirement (เฉพาะเมื่อตารางยังมี)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'WorkArea') THEN
    ALTER TABLE "WorkArea" DROP CONSTRAINT IF EXISTS "WorkArea_departmentId_fkey";
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'CoverageRequirement') THEN
    ALTER TABLE "CoverageRequirement" DROP CONSTRAINT IF EXISTS "CoverageRequirement_workAreaId_fkey";
  END IF;
END $$;

ALTER TABLE "Assignment" DROP CONSTRAINT IF EXISTS "Assignment_workAreaId_fkey";
ALTER TABLE "ShiftCode" DROP CONSTRAINT IF EXISTS "ShiftCode_workAreaId_fkey";
ALTER TABLE "ShiftTemplate" DROP CONSTRAINT IF EXISTS "ShiftTemplate_workAreaId_fkey";

DROP TABLE IF EXISTS "CoverageRequirement";
DROP TABLE IF EXISTS "WorkArea";

ALTER TABLE "Assignment" DROP COLUMN IF EXISTS "workAreaId";

-- ShiftCode: รองรับสถานะกลางจาก migration ที่ fail ก่อนหน้า
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ShiftCode' AND column_name = 'workAreaId'
  ) THEN
    ALTER TABLE "ShiftCode" RENAME COLUMN "workAreaId" TO "departmentId";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ShiftCode' AND column_name = 'departmentId'
  ) THEN
    ALTER TABLE "ShiftCode" ADD COLUMN "departmentId" TEXT;
  END IF;
END $$;

UPDATE "ShiftCode" SET "departmentId" = NULL
WHERE "departmentId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Department" d WHERE d.id = "ShiftCode"."departmentId");

ALTER TABLE "ShiftCode" DROP CONSTRAINT IF EXISTS "ShiftCode_departmentId_fkey";
ALTER TABLE "ShiftCode" ADD CONSTRAINT "ShiftCode_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ShiftTemplate
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ShiftTemplate' AND column_name = 'workAreaId'
  ) THEN
    ALTER TABLE "ShiftTemplate" RENAME COLUMN "workAreaId" TO "departmentId";
  ELSIF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ShiftTemplate' AND column_name = 'departmentId'
  ) THEN
    ALTER TABLE "ShiftTemplate" ADD COLUMN "departmentId" TEXT;
  END IF;
END $$;

UPDATE "ShiftTemplate" SET "departmentId" = NULL
WHERE "departmentId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "Department" d WHERE d.id = "ShiftTemplate"."departmentId");

ALTER TABLE "ShiftTemplate" DROP CONSTRAINT IF EXISTS "ShiftTemplate_departmentId_fkey";
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_departmentId_fkey"
  FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "ShiftCodeDemand" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shiftCodeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minHeadcount" INTEGER NOT NULL,
    "requiredCompetencyId" TEXT,
    "requiresLead" BOOLEAN NOT NULL DEFAULT false,
    "weekdayMask" INTEGER NOT NULL DEFAULT 127,
    "appliesOnHolidays" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftCodeDemand_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShiftCodeDemand_organizationId_shiftCodeId_active_idx"
  ON "ShiftCodeDemand"("organizationId", "shiftCodeId", "active");
CREATE INDEX IF NOT EXISTS "ShiftCodeDemand_organizationId_effectiveFrom_effectiveTo_idx"
  ON "ShiftCodeDemand"("organizationId", "effectiveFrom", "effectiveTo");

ALTER TABLE "ShiftCodeDemand" DROP CONSTRAINT IF EXISTS "ShiftCodeDemand_organizationId_fkey";
ALTER TABLE "ShiftCodeDemand" ADD CONSTRAINT "ShiftCodeDemand_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ShiftCodeDemand" DROP CONSTRAINT IF EXISTS "ShiftCodeDemand_shiftCodeId_fkey";
ALTER TABLE "ShiftCodeDemand" ADD CONSTRAINT "ShiftCodeDemand_shiftCodeId_fkey"
  FOREIGN KEY ("shiftCodeId") REFERENCES "ShiftCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
