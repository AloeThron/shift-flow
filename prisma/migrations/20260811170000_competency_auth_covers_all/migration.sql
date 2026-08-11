-- สิทธิปฏิบัติงาน: รองรับทุกทักษะ (coversAll) + competencyId เป็นทางเลือก
ALTER TABLE "StaffCompetencyAuthorization" ADD COLUMN "coversAllCompetencies" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "StaffCompetencyAuthorization" ALTER COLUMN "competencyId" DROP NOT NULL;

DROP INDEX IF EXISTS "StaffCompetencyAuthorization_organizationId_staffProfileId__key";

CREATE UNIQUE INDEX "StaffCompetencyAuthorization_org_staff_competency_key"
  ON "StaffCompetencyAuthorization" ("organizationId", "staffProfileId", "competencyId")
  WHERE "competencyId" IS NOT NULL AND "coversAllCompetencies" = false;

CREATE UNIQUE INDEX "StaffCompetencyAuthorization_org_staff_covers_all_key"
  ON "StaffCompetencyAuthorization" ("organizationId", "staffProfileId")
  WHERE "coversAllCompetencies" = true;
