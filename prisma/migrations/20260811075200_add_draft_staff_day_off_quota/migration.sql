-- CreateTable
CREATE TABLE "DraftStaffDayOffQuota" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleDraftId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "daysOffQuota" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DraftStaffDayOffQuota_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DraftStaffDayOffQuota_organizationId_scheduleDraftId_idx" ON "DraftStaffDayOffQuota"("organizationId", "scheduleDraftId");

-- CreateIndex
CREATE UNIQUE INDEX "DraftStaffDayOffQuota_scheduleDraftId_staffProfileId_key" ON "DraftStaffDayOffQuota"("scheduleDraftId", "staffProfileId");

-- AddForeignKey
ALTER TABLE "DraftStaffDayOffQuota" ADD CONSTRAINT "DraftStaffDayOffQuota_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftStaffDayOffQuota" ADD CONSTRAINT "DraftStaffDayOffQuota_scheduleDraftId_fkey" FOREIGN KEY ("scheduleDraftId") REFERENCES "ScheduleDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DraftStaffDayOffQuota" ADD CONSTRAINT "DraftStaffDayOffQuota_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
