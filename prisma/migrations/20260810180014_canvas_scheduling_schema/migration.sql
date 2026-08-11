-- CreateEnum
CREATE TYPE "ScheduleRunStage" AS ENUM ('DAY_OFF', 'BALANCE');

-- CreateEnum
CREATE TYPE "PlannedNonWorkingDaySource" AS ENUM ('REQUEST', 'QUOTA', 'MANUAL');

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "isPinned" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "plannedOtHours" DECIMAL(4,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ScheduleRun" ADD COLUMN     "stage" "ScheduleRunStage" NOT NULL DEFAULT 'BALANCE';

-- AlterTable
ALTER TABLE "ShiftCode" ADD COLUMN     "isNightShift" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "otHours" DECIMAL(4,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "StaffProfile" ADD COLUMN     "rowOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "staffGroupId" TEXT;

-- CreateTable
CREATE TABLE "StaffGroup" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedNonWorkingDay" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleDraftId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "nonWorkingDayKindId" TEXT NOT NULL,
    "source" "PlannedNonWorkingDaySource" NOT NULL,
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlannedNonWorkingDay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffWorkloadMonthly" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "staffGroupId" TEXT,
    "plannedHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "otHours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "nightCount" INTEGER NOT NULL DEFAULT 0,
    "weekendCount" INTEGER NOT NULL DEFAULT 0,
    "holidayCount" INTEGER NOT NULL DEFAULT 0,
    "workedDays" INTEGER NOT NULL DEFAULT 0,
    "daysOff" INTEGER NOT NULL DEFAULT 0,
    "fteAtPeriod" DECIMAL(4,2) NOT NULL DEFAULT 1,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffWorkloadMonthly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffGroup_organizationId_sortOrder_idx" ON "StaffGroup"("organizationId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StaffGroup_organizationId_code_key" ON "StaffGroup"("organizationId", "code");

-- CreateIndex
CREATE INDEX "PlannedNonWorkingDay_organizationId_scheduleDraftId_idx" ON "PlannedNonWorkingDay"("organizationId", "scheduleDraftId");

-- CreateIndex
CREATE INDEX "PlannedNonWorkingDay_organizationId_staffProfileId_localDat_idx" ON "PlannedNonWorkingDay"("organizationId", "staffProfileId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedNonWorkingDay_scheduleDraftId_staffProfileId_localDa_key" ON "PlannedNonWorkingDay"("scheduleDraftId", "staffProfileId", "localDate");

-- CreateIndex
CREATE INDEX "StaffWorkloadMonthly_organizationId_yearMonth_idx" ON "StaffWorkloadMonthly"("organizationId", "yearMonth");

-- CreateIndex
CREATE INDEX "StaffWorkloadMonthly_organizationId_staffGroupId_yearMonth_idx" ON "StaffWorkloadMonthly"("organizationId", "staffGroupId", "yearMonth");

-- CreateIndex
CREATE UNIQUE INDEX "StaffWorkloadMonthly_organizationId_staffProfileId_yearMont_key" ON "StaffWorkloadMonthly"("organizationId", "staffProfileId", "yearMonth");

-- CreateIndex
CREATE INDEX "ScheduleRun_organizationId_scheduleDraftId_stage_idx" ON "ScheduleRun"("organizationId", "scheduleDraftId", "stage");

-- CreateIndex
CREATE INDEX "StaffProfile_organizationId_staffGroupId_rowOrder_idx" ON "StaffProfile"("organizationId", "staffGroupId", "rowOrder");

-- AddForeignKey
ALTER TABLE "StaffGroup" ADD CONSTRAINT "StaffGroup_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_staffGroupId_fkey" FOREIGN KEY ("staffGroupId") REFERENCES "StaffGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedNonWorkingDay" ADD CONSTRAINT "PlannedNonWorkingDay_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedNonWorkingDay" ADD CONSTRAINT "PlannedNonWorkingDay_scheduleDraftId_fkey" FOREIGN KEY ("scheduleDraftId") REFERENCES "ScheduleDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedNonWorkingDay" ADD CONSTRAINT "PlannedNonWorkingDay_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlannedNonWorkingDay" ADD CONSTRAINT "PlannedNonWorkingDay_nonWorkingDayKindId_fkey" FOREIGN KEY ("nonWorkingDayKindId") REFERENCES "NonWorkingDayKind"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWorkloadMonthly" ADD CONSTRAINT "StaffWorkloadMonthly_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWorkloadMonthly" ADD CONSTRAINT "StaffWorkloadMonthly_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffWorkloadMonthly" ADD CONSTRAINT "StaffWorkloadMonthly_staffGroupId_fkey" FOREIGN KEY ("staffGroupId") REFERENCES "StaffGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
