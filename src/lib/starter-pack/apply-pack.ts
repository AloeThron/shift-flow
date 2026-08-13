import { getRuleTemplate } from "@/domain/rules/registry";
import { buildAssignmentInterval, localDateTimeToIso } from "@/domain/schedule/time";
import { buildDemandName, dayTypeToWeekdayMask } from "@/domain/starter-pack/day-type";
import { validateNormalizedRuleParams } from "@/domain/starter-pack/normalize-rule-params";
import type {
  RosterMonthSampleRow,
  StarterPackApplyStats,
  StarterPackSnapshot,
} from "@/domain/starter-pack/types";
import type { Prisma, PrismaClient } from "@/generated/client/client";

/** ตัวเลือก apply starter pack */
export type ApplyStarterPackOptions = {
  organizationId: string;
  snapshot: StarterPackSnapshot;
  effectiveFrom?: Date;
  replaceExisting?: boolean;
  includeStaff?: boolean;
  includeHolidays?: boolean;
  /** สร้างตารางเวรเดือนตัวอย่างจาก roster_month_sample.csv แล้ว publish */
  includeDemoRoster?: boolean;
  actorUserId?: string;
};

const DEFAULT_NON_WORKING_KINDS = [
  { code: "VAC", displayName: "ลาพักร้อน", blocksScheduling: true },
  { code: "SICK", displayName: "ลาป่วย (operational)", blocksScheduling: true },
  { code: "OFF", displayName: "วันหยุดประจำ", blocksScheduling: true },
] as const;

/** client ที่ใช้ใน transaction ได้ */
type ApplyPackDbClient = Omit<
  PrismaClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$extends"
>;

/** ลบ schedule/workflow ที่อ้าง rule set และ staff ก่อน replace config */
async function clearOrganizationSchedule(
  db: ApplyPackDbClient,
  organizationId: string,
): Promise<void> {
  await db.plannedNonWorkingDay.deleteMany({ where: { organizationId } });
  await db.draftStaffDayOffQuota.deleteMany({ where: { organizationId } });
  await db.assignment.deleteMany({ where: { organizationId } });
  await db.scheduleRun.deleteMany({ where: { organizationId } });
  await db.scheduleVersion.updateMany({
    where: { organizationId },
    data: { supersededByVersionId: null },
  });
  await db.scheduleDraft.updateMany({
    where: { organizationId },
    data: { baseVersionId: null },
  });
  await db.scheduleVersion.deleteMany({ where: { organizationId } });
  await db.scheduleDraft.deleteMany({ where: { organizationId } });
  await db.scheduleCycle.deleteMany({ where: { organizationId } });
}

/** ช่วงวันที่ของตารางตัวอย่างจากแถว CSV */
function rosterSamplePeriod(
  rows: readonly RosterMonthSampleRow[],
): { periodStart: string; periodEnd: string } | null {
  if (rows.length === 0) {
    return null;
  }
  const dates = rows.map((row) => row.localDate).sort();
  return { periodStart: dates[0]!, periodEnd: dates[dates.length - 1]! };
}

/** publish ตารางเวรเดือนตัวอย่างหลัง apply config */
async function publishDemoRoster(
  db: ApplyPackDbClient,
  options: {
    organizationId: string;
    snapshot: StarterPackSnapshot;
    staffByCode: ReadonlyMap<string, string>;
    shiftCodeByCanonical: ReadonlyMap<string, string>;
    departmentByCode: ReadonlyMap<string, string>;
    actorUserId?: string;
  },
): Promise<number> {
  const {
    organizationId,
    snapshot,
    staffByCode,
    shiftCodeByCanonical,
    departmentByCode,
    actorUserId,
  } = options;

  const period = rosterSamplePeriod(snapshot.rosterMonthSample);
  if (!period || staffByCode.size === 0) {
    return 0;
  }

  const ruleSet = await db.ruleSetVersion.findFirst({
    where: { organizationId },
    orderBy: { versionNumber: "desc" },
  });
  if (!ruleSet) {
    return 0;
  }

  const shiftMeta = new Map(
    snapshot.shiftCodes.map((row) => [
      row.canonicalCode,
      {
        startTime: row.startTime,
        endTime: row.endTime,
        departmentCode: row.departmentCode,
        otHours: row.otHours,
      },
    ]),
  );

  const cycle = await db.scheduleCycle.create({
    data: {
      organizationId,
      name: `ตัวอย่าง ${period.periodStart.slice(0, 7)}`,
      periodStart: new Date(period.periodStart),
      periodEnd: new Date(period.periodEnd),
    },
  });

  const draft = await db.scheduleDraft.create({
    data: {
      organizationId,
      scheduleCycleId: cycle.id,
      draftNumber: 1,
      status: "EDITING",
    },
  });

  const publishedVersion = await db.scheduleVersion.create({
    data: {
      organizationId,
      scheduleCycleId: cycle.id,
      scheduleDraftId: draft.id,
      versionNumber: 1,
      status: "PUBLISHED",
      ruleSetVersionId: ruleSet.id,
      publishedAt: new Date(),
      publishedByUserId: actorUserId,
      publishReason: `Demo roster from starter pack ${snapshot.packId}`,
    },
  });

  const timezone = snapshot.organization.timezone;
  const assignmentRows = snapshot.rosterMonthSample.flatMap((row) => {
    const staffProfileId = staffByCode.get(row.staffCode);
    const resolvedCode = row.canonicalCode;
    const shiftCodeId = shiftCodeByCanonical.get(resolvedCode);
    const meta = shiftMeta.get(resolvedCode);
    if (!staffProfileId || !shiftCodeId || !meta) {
      return [];
    }

    // รหัสไม่มีเวลา (เช่น off) — เก็บเซลล์ด้วยช่วงศูนย์ที่เที่ยงคืนท้องถิ่น
    const hasTimes = Boolean(meta.startTime && meta.endTime);
    const interval = hasTimes
      ? buildAssignmentInterval(
          {
            startTime: meta.startTime,
            endTime: meta.endTime,
          },
          row.localDate,
          timezone,
        )
      : {
          startAt: localDateTimeToIso(row.localDate, "00:00", timezone),
          endAt: localDateTimeToIso(row.localDate, "00:00", timezone),
        };

    return [
      {
        organizationId,
        scheduleVersionId: publishedVersion.id,
        staffProfileId,
        shiftCodeId,
        localDate: new Date(row.localDate),
        startsAt: new Date(interval.startAt),
        endsAt: new Date(interval.endAt),
        plannedOtHours: meta.otHours,
      },
    ];
  });

  if (assignmentRows.length > 0) {
    await db.assignment.createMany({ data: assignmentRows });
  }

  return assignmentRows.length;
}

/** ลบ config domain เดิมของ org ก่อน apply ใหม่ */
async function clearOrganizationConfig(
  db: ApplyPackDbClient,
  organizationId: string,
  includeStaff: boolean,
): Promise<void> {
  await clearOrganizationSchedule(db, organizationId);

  await db.staffWorkloadMonthly.deleteMany({ where: { organizationId } });
  await db.schedulingPolicy.deleteMany({ where: { organizationId } });
  await db.ruleInstance.deleteMany({ where: { organizationId } });
  await db.ruleSetVersion.deleteMany({ where: { organizationId } });
  await db.shiftCodeDemand.deleteMany({ where: { organizationId } });
  await db.holidayDate.deleteMany({
    where: { holidayCalendar: { organizationId } },
  });
  await db.holidayCalendar.deleteMany({ where: { organizationId } });
  await db.shiftInstance.deleteMany({ where: { organizationId } });
  await db.shiftTemplate.deleteMany({ where: { organizationId } });
  await db.staffShiftAuthorization.deleteMany({ where: { organizationId } });
  await db.shiftCode.deleteMany({ where: { organizationId } });

  if (includeStaff) {
    await db.employmentContract.deleteMany({ where: { organizationId } });
    await db.staffProfile.deleteMany({ where: { organizationId } });
  }

  await db.staffGroup.deleteMany({ where: { organizationId } });
  await db.staffGrade.deleteMany({ where: { organizationId } });
  await db.nonWorkingDayKind.deleteMany({ where: { organizationId } });
  await db.department.deleteMany({ where: { organizationId } });
}

/** apply snapshot เข้า organization — ใช้ร่วมกับ transaction client ได้ */
async function applyStarterPackSnapshot(
  db: ApplyPackDbClient,
  options: ApplyStarterPackOptions,
): Promise<StarterPackApplyStats> {
  const {
    organizationId,
    snapshot,
    effectiveFrom = new Date("2026-01-01"),
    replaceExisting = true,
    includeDemoRoster = snapshot.rosterMonthSample.length > 0,
    includeStaff = true,
    includeHolidays = true,
    actorUserId,
  } = options;

  const skippedRuleTemplates: string[] = [];

  if (replaceExisting) {
    await clearOrganizationConfig(db, organizationId, includeStaff);
  }

  await db.organization.update({
    where: { id: organizationId },
    data: {
      name: snapshot.organization.name,
      timezone: snapshot.organization.timezone,
    },
  });

  const departmentByCode = new Map<string, string>();
  for (const row of snapshot.departments) {
    const department = await db.department.create({
      data: {
        organizationId,
        code: row.code,
        displayName: row.displayNameTh,
        sortOrder: row.sortOrder,
        active: row.active,
      },
    });
    departmentByCode.set(row.code, department.id);
  }

  const gradeByCode = new Map<string, string>();
  for (const row of snapshot.staffGrades) {
    const grade = await db.staffGrade.create({
      data: {
        organizationId,
        code: row.code,
        displayName: row.displayNameTh,
        sortOrder: row.sortOrder,
        canWorkNights: row.canWorkNights,
      },
    });
    gradeByCode.set(row.code, grade.id);
  }

  const staffGroupByCode = new Map<string, string>();
  for (const row of snapshot.staffGroups) {
    const group = await db.staffGroup.create({
      data: {
        organizationId,
        code: row.code,
        displayName: row.displayNameTh,
        sortOrder: row.sortOrder,
        active: row.active,
      },
    });
    staffGroupByCode.set(row.code, group.id);
  }

  const shiftCodeByCanonical = new Map<string, string>();
  for (const row of snapshot.shiftCodes) {
    const shiftCode = await db.shiftCode.create({
      data: {
        organizationId,
        departmentId: row.departmentCode ? departmentByCode.get(row.departmentCode) : undefined,
        canonicalCode: row.canonicalCode,
        startTime: row.startTime || null,
        endTime: row.endTime || null,
        standardHours: row.standardHours,
        otHours: row.otHours,
        isNightShift: row.isNightShift,
        allowedGradeCodes: [...row.staffGradeCodes],
        needsConfirmation: row.needsConfirmation,
        deprecated: !row.active,
      },
    });
    shiftCodeByCanonical.set(row.canonicalCode, shiftCode.id);
  }

  const staffByCode = new Map<string, string>();
  if (includeStaff) {
    for (const row of snapshot.staff) {
      const gradeId = gradeByCode.get(row.gradeCode);
      const staffGroupId = staffGroupByCode.get(row.staffGroupCode);
      if (!gradeId || !staffGroupId) {
        continue;
      }

      const profile = await db.staffProfile.create({
        data: {
          organizationId,
          staffGradeId: gradeId,
          staffGroupId,
          staffCode: row.staffCode,
          displayName: row.displayName,
          email: row.email,
          staffGroupSection: row.staffGroupSection,
          rowOrder: row.rowOrder,
          active: row.active,
        },
      });
      staffByCode.set(row.staffCode, profile.id);

      await db.employmentContract.create({
        data: {
          organizationId,
          staffProfileId: profile.id,
          contractType: row.contractType,
          fte: row.fte,
          effectiveFrom,
        },
      });
    }

    for (const row of snapshot.staffShiftAuthorization) {
      const staffId = staffByCode.get(row.staffCode);
      if (!staffId) {
        continue;
      }

      const coversAll = !row.shiftCode;
      const shiftCodeId = coversAll ? null : shiftCodeByCanonical.get(row.shiftCode);
      if (!coversAll && !shiftCodeId) {
        continue;
      }

      const authorizerId = row.authorizerStaffCode
        ? staffByCode.get(row.authorizerStaffCode)
        : undefined;

      await db.staffShiftAuthorization.create({
        data: {
          organizationId,
          staffProfileId: staffId,
          shiftCodeId,
          coversAllShiftCodes: coversAll,
          level: row.level,
          authorizedByStaffId: authorizerId,
          assessedAt: new Date(row.authorizedDate),
          expiresAt: row.expiryDate ? new Date(row.expiryDate) : null,
        },
      });
    }
  }

  await db.nonWorkingDayKind.createMany({
    data: DEFAULT_NON_WORKING_KINDS.map((kind) => ({
      organizationId,
      code: kind.code,
      displayName: kind.displayName,
      blocksScheduling: kind.blocksScheduling,
    })),
  });

  let demandCount = 0;
  for (const row of snapshot.shiftDemands) {
    const shiftCodeId = shiftCodeByCanonical.get(row.canonicalCode);
    if (!shiftCodeId) {
      continue;
    }

    const { weekdayMask, appliesOnHolidays } = dayTypeToWeekdayMask(row.dayType);

    await db.shiftCodeDemand.create({
      data: {
        organizationId,
        shiftCodeId,
        name: buildDemandName(row.canonicalCode, row.dayType),
        minHeadcount: row.minCount,
        requiresLead: row.requiresLead,
        weekdayMask,
        appliesOnHolidays,
        effectiveFrom,
        active: true,
      },
    });
    demandCount += 1;
  }

  let holidayDateCount = 0;
  if (includeHolidays && snapshot.holidays.length > 0) {
    const calendar = await db.holidayCalendar.create({
      data: {
        organizationId,
        name: `${snapshot.organization.name} — วันหยุดตัวอย่าง`,
        source: `starter-pack:${snapshot.packId}`,
        version: 1,
        effectiveFrom,
      },
    });

    for (const row of snapshot.holidays) {
      await db.holidayDate.create({
        data: {
          holidayCalendarId: calendar.id,
          localDate: new Date(row.localDate),
          name: row.nameTh,
        },
      });
      holidayDateCount += 1;
    }
  }

  let ruleInstanceCount = 0;
  for (const row of snapshot.ruleInstances) {
    const template = getRuleTemplate(row.ruleTemplateId);
    if (!template) {
      skippedRuleTemplates.push(row.ruleTemplateId);
      continue;
    }

    const validated = validateNormalizedRuleParams(row.ruleTemplateId, row.params);
    if (!validated.ok) {
      skippedRuleTemplates.push(row.ruleTemplateId);
      continue;
    }

    const severity = template.safetyLocked ? template.defaultSeverity : row.severity;
    const overrideClass = template.safetyLocked ? template.defaultOverrideClass : row.overrideClass;

    await db.ruleInstance.create({
      data: {
        organizationId,
        ruleTemplateId: row.ruleTemplateId,
        params: validated.data as Prisma.InputJsonValue,
        severity,
        weight: severity === "SOFT" ? 100 : null,
        overrideClass,
        enabled: row.enabled,
        effectiveFrom,
      },
    });
    ruleInstanceCount += 1;
  }

  await db.ruleSetVersion.create({
    data: {
      organizationId,
      versionNumber: 1,
      effectiveFrom,
      snapshot: {
        source: `demo/starter-packs/${snapshot.packPath}/rule_instances.yaml`,
        packId: snapshot.packId,
      },
      createdByUserId: actorUserId,
    },
  });

  await db.schedulingPolicy.create({
    data: {
      organizationId,
      historyWindowMonths: snapshot.schedulingPolicy.historyWindowMonths,
      fairnessLookbackMonths: snapshot.schedulingPolicy.fairnessLookbackMonths,
      planningHorizonMonths: snapshot.schedulingPolicy.planningHorizonMonths,
      publishLeadDays: snapshot.schedulingPolicy.publishLeadDays,
      otDerivationMode: snapshot.schedulingPolicy.otDerivationMode,
      effectiveFrom: new Date(snapshot.schedulingPolicy.effectiveFrom),
      version: 1,
    },
  });

  const rosterAssignments =
    includeDemoRoster && includeStaff
      ? await publishDemoRoster(db, {
          organizationId,
          snapshot,
          staffByCode,
          shiftCodeByCanonical,
          departmentByCode,
          actorUserId,
        })
      : 0;

  if (actorUserId) {
    await db.auditEvent.create({
      data: {
        organizationId,
        actorUserId,
        action: "UPDATE",
        entityType: "Organization",
        entityId: organizationId,
        after: {
          starterPackId: snapshot.packId,
          includeStaff,
          includeHolidays,
          includeDemoRoster,
          rosterAssignments,
        },
        reason: "Applied starter pack configuration",
      },
    });
  }

  return {
    departments: departmentByCode.size,
    staffGrades: gradeByCode.size,
    staffGroups: staffGroupByCode.size,
    shiftCodes: shiftCodeByCanonical.size,
    staffProfiles: staffByCode.size,
    staffShiftAuthorizations: includeStaff ? snapshot.staffShiftAuthorization.length : 0,
    shiftCodeDemands: demandCount,
    holidayDates: holidayDateCount,
    ruleInstances: ruleInstanceCount,
    rosterAssignments,
    skippedRuleTemplates,
  };
}

/** apply starter pack snapshot เข้า organization */
export async function applyStarterPack(
  prisma: PrismaClient,
  options: ApplyStarterPackOptions,
): Promise<StarterPackApplyStats> {
  return prisma.$transaction((tx) => applyStarterPackSnapshot(tx, options));
}
