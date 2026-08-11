-- CreateTable
CREATE TABLE "PayRuleVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "config" JSONB NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayRuleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayRuleVersion_organizationId_effectiveFrom_effectiveTo_idx" ON "PayRuleVersion"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "PayRuleVersion_organizationId_versionNumber_key" ON "PayRuleVersion"("organizationId", "versionNumber");

-- AddForeignKey
ALTER TABLE "PayRuleVersion" ADD CONSTRAINT "PayRuleVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
