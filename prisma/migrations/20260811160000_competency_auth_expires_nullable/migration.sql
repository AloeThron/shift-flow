-- AlterTable: สิทธิปฏิบัติงาน — วันหมดอายุเป็นทางเลือก (null = ไม่หมดอายุ)
ALTER TABLE "StaffCompetencyAuthorization" ALTER COLUMN "expiresAt" DROP NOT NULL;
