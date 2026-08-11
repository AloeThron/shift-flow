-- CreateEnum
CREATE TYPE "OtDerivationMode" AS ENUM ('SHIFT_CODE_ONLY', 'PLANNED_OVERRIDE_ALLOWED');

-- CreateTable
CREATE TABLE "SchedulingPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "historyWindowMonths" INTEGER NOT NULL DEFAULT 6,
    "fairnessLookbackMonths" INTEGER NOT NULL DEFAULT 6,
    "planningHorizonMonths" INTEGER NOT NULL DEFAULT 1,
    "publishLeadDays" INTEGER NOT NULL DEFAULT 7,
    "otDerivationMode" "OtDerivationMode" NOT NULL DEFAULT 'SHIFT_CODE_ONLY',
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchedulingPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SchedulingPolicy_organizationId_effectiveFrom_effectiveTo_idx" ON "SchedulingPolicy"("organizationId", "effectiveFrom", "effectiveTo");

-- AddForeignKey
ALTER TABLE "SchedulingPolicy" ADD CONSTRAINT "SchedulingPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
