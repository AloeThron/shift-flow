-- CreateEnum
CREATE TYPE "ContractType" AS ENUM ('FULL_TIME', 'PART_TIME', 'NO_GUARANTEED_HOURS');

-- CreateEnum
CREATE TYPE "AvailabilityKind" AS ENUM ('UNAVAILABLE', 'PREFERENCE');

-- CreateEnum
CREATE TYPE "LeaveDurationKind" AS ENUM ('FULL_DAY', 'PARTIAL');

-- CreateEnum
CREATE TYPE "LeaveRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RuleSeverity" AS ENUM ('HARD', 'SOFT');

-- CreateEnum
CREATE TYPE "OverrideClass" AS ENUM ('NEVER', 'APPROVER_REQUIRED', 'SCHEDULER_ALLOWED');

-- CreateEnum
CREATE TYPE "ScheduleDraftStatus" AS ENUM ('EDITING', 'VALIDATED');

-- CreateEnum
CREATE TYPE "ScheduleVersionStatus" AS ENUM ('DRAFT', 'VALIDATED', 'PUBLISHED', 'LOCKED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ScheduleRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SwapRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'APPROVED', 'COMMITTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CoverageRequestStatus" AS ENUM ('OPEN', 'CLAIMED', 'APPROVED', 'COMMITTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AcknowledgementStatus" AS ENUM ('PENDING', 'ACKNOWLEDGED');

-- CreateEnum
CREATE TYPE "RosterCellStatus" AS ENUM ('ASSIGNED', 'OFF', 'LEAVE', 'UNKNOWN', 'NO_SHIFT');

-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('UPLOADED', 'DRY_RUN', 'COMMITTED', 'FAILED', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'PUBLISH', 'LOCK', 'SUPERSEDE', 'OVERRIDE', 'IMPORT', 'APPROVE', 'REJECT', 'ACKNOWLEDGE', 'RUN_SOLVER');

-- CreateTable
CREATE TABLE "Department" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkArea" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "departmentId" TEXT,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffGrade" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "canWorkNights" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffGrade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffGradeId" TEXT NOT NULL,
    "userId" TEXT,
    "staffCode" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "email" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmploymentContract" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "contractType" "ContractType" NOT NULL,
    "fte" DECIMAL(4,2) NOT NULL,
    "targetHoursPerMonth" DECIMAL(6,2),
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmploymentContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competency" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "requiresSupervision" BOOLEAN NOT NULL DEFAULT false,
    "defaultValidityMonths" INTEGER NOT NULL DEFAULT 24,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCompetencyAuthorization" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "level" TEXT,
    "activityOrInstrument" TEXT,
    "authorizedByStaffId" TEXT,
    "assessedAt" DATE NOT NULL,
    "expiresAt" DATE NOT NULL,
    "requiresSupervision" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffCompetencyAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "kind" "AvailabilityKind" NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaveRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "status" "LeaveRequestStatus" NOT NULL DEFAULT 'PENDING',
    "durationKind" "LeaveDurationKind" NOT NULL,
    "categoryCode" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "reason" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeaveRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NonWorkingDayKind" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "blocksScheduling" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NonWorkingDayKind_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftCode" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workAreaId" TEXT,
    "canonicalCode" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "crossesMidnight" BOOLEAN NOT NULL DEFAULT false,
    "standardHours" DECIMAL(4,2),
    "allowedGradeCodes" TEXT[],
    "needsConfirmation" BOOLEAN NOT NULL DEFAULT false,
    "deprecated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftCodeAlias" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shiftCodeId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftCodeAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shiftCodeId" TEXT NOT NULL,
    "workAreaId" TEXT,
    "name" TEXT NOT NULL,
    "requiredCompetencyIds" TEXT[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftInstance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "shiftTemplateId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeParsingRule" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeParsingRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workAreaId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minHeadcount" INTEGER NOT NULL,
    "requiredCompetencyId" TEXT,
    "requiresLead" BOOLEAN NOT NULL DEFAULT false,
    "weekdayMask" INTEGER NOT NULL DEFAULT 127,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "appliesOnHolidays" BOOLEAN NOT NULL DEFAULT false,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayCalendar" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayCalendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HolidayDate" (
    "id" TEXT NOT NULL,
    "holidayCalendarId" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HolidayDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleInstance" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "ruleTemplateId" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "severity" "RuleSeverity" NOT NULL,
    "weight" DECIMAL(6,2),
    "overrideClass" "OverrideClass" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleSetVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "effectiveFrom" DATE NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleSetVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigChangeEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "field" TEXT,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfigChangeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleCycle" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleDraft" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleCycleId" TEXT NOT NULL,
    "draftNumber" INTEGER NOT NULL,
    "status" "ScheduleDraftStatus" NOT NULL DEFAULT 'EDITING',
    "baseVersionId" TEXT,
    "optimisticVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleDraft_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleVersion" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleCycleId" TEXT NOT NULL,
    "scheduleDraftId" TEXT,
    "versionNumber" INTEGER NOT NULL,
    "status" "ScheduleVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "ruleSetVersionId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "publishedByUserId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "supersededByVersionId" TEXT,
    "publishReason" TEXT,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleVersionId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "shiftCodeId" TEXT,
    "shiftInstanceId" TEXT,
    "workAreaId" TEXT,
    "localDate" DATE NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overrideApprovedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleRun" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleDraftId" TEXT NOT NULL,
    "ruleSetVersionId" TEXT NOT NULL,
    "status" "ScheduleRunStatus" NOT NULL DEFAULT 'PENDING',
    "inputChecksum" TEXT NOT NULL,
    "solverVersion" TEXT NOT NULL,
    "randomSeed" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "resultSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SwapRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "initiatorStaffId" TEXT NOT NULL,
    "acceptorStaffId" TEXT,
    "status" "SwapRequestStatus" NOT NULL DEFAULT 'PENDING',
    "assignmentAId" TEXT,
    "assignmentBId" TEXT,
    "reason" TEXT,
    "approvedByUserId" TEXT,
    "expiresAt" TIMESTAMP(3),
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwapRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoverageRequest" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "workAreaId" TEXT,
    "claimedByStaffId" TEXT,
    "status" "CoverageRequestStatus" NOT NULL DEFAULT 'OPEN',
    "localDate" DATE NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "deadlineAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "approvedByUserId" TEXT,
    "committedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CoverageRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Acknowledgement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "scheduleVersionId" TEXT NOT NULL,
    "staffProfileId" TEXT NOT NULL,
    "status" "AcknowledgementStatus" NOT NULL DEFAULT 'PENDING',
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Acknowledgement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterImportBatch" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "uploadedByUserId" TEXT,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'UPLOADED',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RosterImportCell" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "rosterImportBatchId" TEXT NOT NULL,
    "staffCode" TEXT NOT NULL,
    "localDate" DATE NOT NULL,
    "rawCode" TEXT NOT NULL,
    "parsedShiftCodeId" TEXT,
    "confidence" TEXT,
    "status" "RosterCellStatus" NOT NULL,
    "rowIndex" INTEGER NOT NULL,
    "colIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RosterImportCell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorStaffProfileId" TEXT,
    "action" "AuditAction" NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "reason" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Department_organizationId_active_idx" ON "Department"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Department_organizationId_code_key" ON "Department"("organizationId", "code");

-- CreateIndex
CREATE INDEX "WorkArea_organizationId_active_idx" ON "WorkArea"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "WorkArea_organizationId_code_key" ON "WorkArea"("organizationId", "code");

-- CreateIndex
CREATE INDEX "StaffGrade_organizationId_active_idx" ON "StaffGrade"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "StaffGrade_organizationId_code_key" ON "StaffGrade"("organizationId", "code");

-- CreateIndex
CREATE INDEX "StaffProfile_organizationId_active_idx" ON "StaffProfile"("organizationId", "active");

-- CreateIndex
CREATE INDEX "StaffProfile_organizationId_staffGradeId_idx" ON "StaffProfile"("organizationId", "staffGradeId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_organizationId_staffCode_key" ON "StaffProfile"("organizationId", "staffCode");

-- CreateIndex
CREATE INDEX "EmploymentContract_organizationId_staffProfileId_idx" ON "EmploymentContract"("organizationId", "staffProfileId");

-- CreateIndex
CREATE INDEX "EmploymentContract_organizationId_effectiveFrom_effectiveTo_idx" ON "EmploymentContract"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "Competency_organizationId_active_idx" ON "Competency"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Competency_organizationId_code_key" ON "Competency"("organizationId", "code");

-- CreateIndex
CREATE INDEX "StaffCompetencyAuthorization_organizationId_staffProfileId_idx" ON "StaffCompetencyAuthorization"("organizationId", "staffProfileId");

-- CreateIndex
CREATE INDEX "StaffCompetencyAuthorization_organizationId_expiresAt_idx" ON "StaffCompetencyAuthorization"("organizationId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffCompetencyAuthorization_organizationId_staffProfileId__key" ON "StaffCompetencyAuthorization"("organizationId", "staffProfileId", "competencyId", "assessedAt");

-- CreateIndex
CREATE INDEX "Availability_organizationId_staffProfileId_idx" ON "Availability"("organizationId", "staffProfileId");

-- CreateIndex
CREATE INDEX "Availability_organizationId_startsAt_endsAt_idx" ON "Availability"("organizationId", "startsAt", "endsAt");

-- CreateIndex
CREATE INDEX "LeaveRequest_organizationId_staffProfileId_status_idx" ON "LeaveRequest"("organizationId", "staffProfileId", "status");

-- CreateIndex
CREATE INDEX "LeaveRequest_organizationId_startDate_endDate_idx" ON "LeaveRequest"("organizationId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "NonWorkingDayKind_organizationId_active_idx" ON "NonWorkingDayKind"("organizationId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "NonWorkingDayKind_organizationId_code_key" ON "NonWorkingDayKind"("organizationId", "code");

-- CreateIndex
CREATE INDEX "ShiftCode_organizationId_deprecated_idx" ON "ShiftCode"("organizationId", "deprecated");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftCode_organizationId_canonicalCode_key" ON "ShiftCode"("organizationId", "canonicalCode");

-- CreateIndex
CREATE INDEX "ShiftCodeAlias_organizationId_shiftCodeId_idx" ON "ShiftCodeAlias"("organizationId", "shiftCodeId");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftCodeAlias_organizationId_alias_key" ON "ShiftCodeAlias"("organizationId", "alias");

-- CreateIndex
CREATE INDEX "ShiftTemplate_organizationId_active_idx" ON "ShiftTemplate"("organizationId", "active");

-- CreateIndex
CREATE INDEX "ShiftInstance_organizationId_localDate_idx" ON "ShiftInstance"("organizationId", "localDate");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftInstance_organizationId_shiftTemplateId_localDate_key" ON "ShiftInstance"("organizationId", "shiftTemplateId", "localDate");

-- CreateIndex
CREATE INDEX "CodeParsingRule_organizationId_active_priority_idx" ON "CodeParsingRule"("organizationId", "active", "priority");

-- CreateIndex
CREATE INDEX "CoverageRequirement_organizationId_workAreaId_active_idx" ON "CoverageRequirement"("organizationId", "workAreaId", "active");

-- CreateIndex
CREATE INDEX "CoverageRequirement_organizationId_effectiveFrom_effectiveT_idx" ON "CoverageRequirement"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "HolidayCalendar_organizationId_effectiveFrom_effectiveTo_idx" ON "HolidayCalendar"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE UNIQUE INDEX "HolidayDate_holidayCalendarId_localDate_key" ON "HolidayDate"("holidayCalendarId", "localDate");

-- CreateIndex
CREATE INDEX "RuleInstance_organizationId_ruleTemplateId_enabled_idx" ON "RuleInstance"("organizationId", "ruleTemplateId", "enabled");

-- CreateIndex
CREATE INDEX "RuleInstance_organizationId_effectiveFrom_effectiveTo_idx" ON "RuleInstance"("organizationId", "effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "RuleSetVersion_organizationId_effectiveFrom_idx" ON "RuleSetVersion"("organizationId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "RuleSetVersion_organizationId_versionNumber_key" ON "RuleSetVersion"("organizationId", "versionNumber");

-- CreateIndex
CREATE INDEX "ConfigChangeEvent_organizationId_entityType_entityId_idx" ON "ConfigChangeEvent"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "ConfigChangeEvent_organizationId_createdAt_idx" ON "ConfigChangeEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ScheduleCycle_organizationId_periodStart_periodEnd_idx" ON "ScheduleCycle"("organizationId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "ScheduleDraft_organizationId_status_idx" ON "ScheduleDraft"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleDraft_organizationId_scheduleCycleId_draftNumber_key" ON "ScheduleDraft"("organizationId", "scheduleCycleId", "draftNumber");

-- CreateIndex
CREATE INDEX "ScheduleVersion_organizationId_status_idx" ON "ScheduleVersion"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleVersion_organizationId_scheduleCycleId_versionNumbe_key" ON "ScheduleVersion"("organizationId", "scheduleCycleId", "versionNumber");

-- CreateIndex
CREATE INDEX "Assignment_organizationId_scheduleVersionId_idx" ON "Assignment"("organizationId", "scheduleVersionId");

-- CreateIndex
CREATE INDEX "Assignment_organizationId_staffProfileId_localDate_idx" ON "Assignment"("organizationId", "staffProfileId", "localDate");

-- CreateIndex
CREATE INDEX "Assignment_organizationId_localDate_idx" ON "Assignment"("organizationId", "localDate");

-- CreateIndex
CREATE INDEX "ScheduleRun_organizationId_status_idx" ON "ScheduleRun"("organizationId", "status");

-- CreateIndex
CREATE INDEX "ScheduleRun_organizationId_scheduleDraftId_idx" ON "ScheduleRun"("organizationId", "scheduleDraftId");

-- CreateIndex
CREATE INDEX "SwapRequest_organizationId_status_idx" ON "SwapRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX "CoverageRequest_organizationId_status_deadlineAt_idx" ON "CoverageRequest"("organizationId", "status", "deadlineAt");

-- CreateIndex
CREATE INDEX "Acknowledgement_organizationId_status_idx" ON "Acknowledgement"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Acknowledgement_organizationId_scheduleVersionId_staffProfi_key" ON "Acknowledgement"("organizationId", "scheduleVersionId", "staffProfileId");

-- CreateIndex
CREATE INDEX "RosterImportBatch_organizationId_status_idx" ON "RosterImportBatch"("organizationId", "status");

-- CreateIndex
CREATE INDEX "RosterImportCell_organizationId_rosterImportBatchId_idx" ON "RosterImportCell"("organizationId", "rosterImportBatchId");

-- CreateIndex
CREATE INDEX "RosterImportCell_organizationId_staffCode_localDate_idx" ON "RosterImportCell"("organizationId", "staffCode", "localDate");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_entityType_entityId_idx" ON "AuditEvent"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_createdAt_idx" ON "AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_organizationId_action_idx" ON "AuditEvent"("organizationId", "action");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkArea" ADD CONSTRAINT "WorkArea_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkArea" ADD CONSTRAINT "WorkArea_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffGrade" ADD CONSTRAINT "StaffGrade_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_staffGradeId_fkey" FOREIGN KEY ("staffGradeId") REFERENCES "StaffGrade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmploymentContract" ADD CONSTRAINT "EmploymentContract_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competency" ADD CONSTRAINT "Competency_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCompetencyAuthorization" ADD CONSTRAINT "StaffCompetencyAuthorization_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCompetencyAuthorization" ADD CONSTRAINT "StaffCompetencyAuthorization_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCompetencyAuthorization" ADD CONSTRAINT "StaffCompetencyAuthorization_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCompetencyAuthorization" ADD CONSTRAINT "StaffCompetencyAuthorization_authorizedByStaffId_fkey" FOREIGN KEY ("authorizedByStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaveRequest" ADD CONSTRAINT "LeaveRequest_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NonWorkingDayKind" ADD CONSTRAINT "NonWorkingDayKind_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCode" ADD CONSTRAINT "ShiftCode_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCode" ADD CONSTRAINT "ShiftCode_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCodeAlias" ADD CONSTRAINT "ShiftCodeAlias_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftCodeAlias" ADD CONSTRAINT "ShiftCodeAlias_shiftCodeId_fkey" FOREIGN KEY ("shiftCodeId") REFERENCES "ShiftCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_shiftCodeId_fkey" FOREIGN KEY ("shiftCodeId") REFERENCES "ShiftCode"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftTemplate" ADD CONSTRAINT "ShiftTemplate_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftInstance" ADD CONSTRAINT "ShiftInstance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftInstance" ADD CONSTRAINT "ShiftInstance_shiftTemplateId_fkey" FOREIGN KEY ("shiftTemplateId") REFERENCES "ShiftTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeParsingRule" ADD CONSTRAINT "CodeParsingRule_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRequirement" ADD CONSTRAINT "CoverageRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRequirement" ADD CONSTRAINT "CoverageRequirement_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayCalendar" ADD CONSTRAINT "HolidayCalendar_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HolidayDate" ADD CONSTRAINT "HolidayDate_holidayCalendarId_fkey" FOREIGN KEY ("holidayCalendarId") REFERENCES "HolidayCalendar"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleInstance" ADD CONSTRAINT "RuleInstance_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleSetVersion" ADD CONSTRAINT "RuleSetVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigChangeEvent" ADD CONSTRAINT "ConfigChangeEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleCycle" ADD CONSTRAINT "ScheduleCycle_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDraft" ADD CONSTRAINT "ScheduleDraft_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDraft" ADD CONSTRAINT "ScheduleDraft_scheduleCycleId_fkey" FOREIGN KEY ("scheduleCycleId") REFERENCES "ScheduleCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleDraft" ADD CONSTRAINT "ScheduleDraft_baseVersionId_fkey" FOREIGN KEY ("baseVersionId") REFERENCES "ScheduleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_scheduleCycleId_fkey" FOREIGN KEY ("scheduleCycleId") REFERENCES "ScheduleCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_scheduleDraftId_fkey" FOREIGN KEY ("scheduleDraftId") REFERENCES "ScheduleDraft"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_ruleSetVersionId_fkey" FOREIGN KEY ("ruleSetVersionId") REFERENCES "RuleSetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleVersion" ADD CONSTRAINT "ScheduleVersion_supersededByVersionId_fkey" FOREIGN KEY ("supersededByVersionId") REFERENCES "ScheduleVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "ScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shiftCodeId_fkey" FOREIGN KEY ("shiftCodeId") REFERENCES "ShiftCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_shiftInstanceId_fkey" FOREIGN KEY ("shiftInstanceId") REFERENCES "ShiftInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_workAreaId_fkey" FOREIGN KEY ("workAreaId") REFERENCES "WorkArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleRun" ADD CONSTRAINT "ScheduleRun_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleRun" ADD CONSTRAINT "ScheduleRun_scheduleDraftId_fkey" FOREIGN KEY ("scheduleDraftId") REFERENCES "ScheduleDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleRun" ADD CONSTRAINT "ScheduleRun_ruleSetVersionId_fkey" FOREIGN KEY ("ruleSetVersionId") REFERENCES "RuleSetVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_initiatorStaffId_fkey" FOREIGN KEY ("initiatorStaffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SwapRequest" ADD CONSTRAINT "SwapRequest_acceptorStaffId_fkey" FOREIGN KEY ("acceptorStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRequest" ADD CONSTRAINT "CoverageRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoverageRequest" ADD CONSTRAINT "CoverageRequest_claimedByStaffId_fkey" FOREIGN KEY ("claimedByStaffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_scheduleVersionId_fkey" FOREIGN KEY ("scheduleVersionId") REFERENCES "ScheduleVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Acknowledgement" ADD CONSTRAINT "Acknowledgement_staffProfileId_fkey" FOREIGN KEY ("staffProfileId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportBatch" ADD CONSTRAINT "RosterImportBatch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportCell" ADD CONSTRAINT "RosterImportCell_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportCell" ADD CONSTRAINT "RosterImportCell_rosterImportBatchId_fkey" FOREIGN KEY ("rosterImportBatchId") REFERENCES "RosterImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RosterImportCell" ADD CONSTRAINT "RosterImportCell_parsedShiftCodeId_fkey" FOREIGN KEY ("parsedShiftCodeId") REFERENCES "ShiftCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
