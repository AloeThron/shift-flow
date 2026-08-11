import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import {
    findStarterPackEntry,
    loadStarterPackManifest,
    resolveStarterPackDirectory,
} from "./load-manifest";
import { parseOptionalNumber, parseStarterPackCsv, splitPipeCodes } from "./parse-csv";
import {
    parseOrganizationYaml,
    parseRuleInstancesYaml,
    parseSchedulingPolicyYaml,
} from "./parse-yaml";
import {
    departmentRowSchema,
    holidayRowSchema,
    organizationYamlSchema,
    rosterMonthSampleRowSchema,
    schedulingPolicyYamlSchema,
    shiftCodeRowSchema,
    shiftDemandRowSchema,
    staffShiftAuthorizationRowSchema,
    staffGradeRowSchema,
    staffGroupRowSchema,
    staffRowSchema,
} from "./schemas";
import type { RosterMonthSampleRow, StarterPackSnapshot } from "./types";

/** อ่านไฟล์ CSV แล้ว parse ด้วย Zod */
function readCsvRows<T>(
  packDir: string,
  fileName: string,
  schema: {
    safeParse: (input: unknown) => {
      success: boolean;
      data?: T;
      error?: { issues: { message: string }[] };
    };
  },
): readonly T[] {
  const content = readFileSync(join(packDir, fileName), "utf8");
  const rows = parseStarterPackCsv(content);

  return rows.map((row, index) => {
    const parsed = schema.safeParse(row);
    if (!parsed.success || !parsed.data) {
      throw new Error(
        `${fileName} แถว ${index + 2}: ${parsed.error?.issues.map((issue) => issue.message).join(", ") ?? "ไม่ถูกต้อง"}`,
      );
    }
    return parsed.data;
  });
}

/** โหลด starter pack จาก id หรือ alias */
export function loadStarterPack(
  packIdOrAlias: string,
  baseDir = process.cwd(),
): StarterPackSnapshot {
  const manifest = loadStarterPackManifest(baseDir);
  const entry = findStarterPackEntry(manifest, packIdOrAlias);

  if (!entry) {
    throw new Error(`ไม่พบ starter pack: ${packIdOrAlias}`);
  }

  const packDir = resolveStarterPackDirectory(entry, baseDir);
  const organizationRaw = parseOrganizationYaml(
    readFileSync(join(packDir, "organization.yaml"), "utf8"),
  );
  const organizationParsed = organizationYamlSchema.safeParse(organizationRaw);

  if (!organizationParsed.success) {
    throw new Error(
      `organization.yaml ไม่ถูกต้อง: ${organizationParsed.error.issues.map((issue) => issue.message).join(", ")}`,
    );
  }

  const organization = organizationParsed.data;

  const schedulingPolicyRaw = parseSchedulingPolicyYaml(
    readFileSync(join(packDir, "scheduling_policy.yaml"), "utf8"),
  );
  const schedulingPolicyParsed = schedulingPolicyYamlSchema.safeParse(schedulingPolicyRaw);
  if (!schedulingPolicyParsed.success) {
    throw new Error(
      `scheduling_policy.yaml ไม่ถูกต้อง: ${schedulingPolicyParsed.error.issues.map((issue) => issue.message).join(", ")}`,
    );
  }

  const departmentRows = readCsvRows(packDir, "departments.csv", departmentRowSchema);
  const gradeRows = readCsvRows(packDir, "staff_grades.csv", staffGradeRowSchema);
  const staffGroupRows = readCsvRows(packDir, "staff_groups.csv", staffGroupRowSchema);
  const shiftCodeRows = readCsvRows(packDir, "shift_codes.csv", shiftCodeRowSchema);
  const staffRows = readCsvRows(packDir, "staff.csv", staffRowSchema);
  const staffShiftAuthRows = readCsvRows(
    packDir,
    "staff_shift_authorization.csv",
    staffShiftAuthorizationRowSchema,
  );
  const demandRows = readCsvRows(packDir, "shift_demands.csv", shiftDemandRowSchema);
  const holidayRows = readCsvRows(packDir, "holidays.csv", holidayRowSchema);
  const rosterMonthPath = join(packDir, "roster_month_sample.csv");
  const rosterMonthRows = existsSync(rosterMonthPath)
    ? readCsvRows(packDir, "roster_month_sample.csv", rosterMonthSampleRowSchema)
    : [];
  const ruleInstances = parseRuleInstancesYaml(
    readFileSync(join(packDir, "rule_instances.yaml"), "utf8"),
  );

  return {
    packId: entry.id,
    packPath: entry.path,
    organization: {
      name: organization.name,
      slug: organization.slug,
      timezone: organization.timezone,
      locale: organization.locale,
      descriptionTh: organization.description_th,
      descriptionEn: organization.description_en,
      disclaimer: organization.disclaimer,
      patternReference: organization.pattern_reference,
    },
    schedulingPolicy: {
      historyWindowMonths: schedulingPolicyParsed.data.history_window_months,
      fairnessLookbackMonths: schedulingPolicyParsed.data.fairness_lookback_months,
      planningHorizonMonths: schedulingPolicyParsed.data.planning_horizon_months,
      publishLeadDays: schedulingPolicyParsed.data.publish_lead_days,
      otDerivationMode: schedulingPolicyParsed.data.ot_derivation_mode,
      effectiveFrom: schedulingPolicyParsed.data.effective_from,
    },
    departments: departmentRows.map((row) => ({
      code: row.code,
      displayNameTh: row.display_name_th,
      displayNameEn: row.display_name_en,
      sortOrder: row.sort_order,
      active: row.active,
    })),
    staffGrades: gradeRows.map((row) => ({
      code: row.code,
      displayNameTh: row.display_name_th,
      sortOrder: row.sort_order,
      canWorkNights: row.can_work_nights,
    })),
    staffGroups: staffGroupRows.map((row) => ({
      code: row.code,
      displayNameTh: row.display_name_th,
      sortOrder: row.sort_order,
      active: row.active,
    })),
    shiftCodes: shiftCodeRows.map((row) => ({
      canonicalCode: row.canonical_code,
      departmentCode: row.department_code,
      startTime: row.start_time,
      endTime: row.end_time,
      standardHours: parseOptionalNumber(row.standard_hours),
      otHours: row.ot_hours,
      isNightShift: row.is_night_shift,
      staffGradeCodes: splitPipeCodes(row.staff_grade_codes),
      needsConfirmation: row.needs_confirmation,
      active: row.active,
    })),
    staff: staffRows.map((row) => ({
      staffCode: row.staff_code,
      displayName: row.display_name,
      gradeCode: row.grade_code,
      staffGroupCode: row.staff_group_code,
      staffGroupSection: row.staff_group_section,
      rowOrder: row.row_order,
      email: row.email,
      fte: row.fte,
      contractType: row.contract_type,
      active: row.active,
    })),
    staffShiftAuthorization: staffShiftAuthRows.map((row) => ({
      staffCode: row.staff_code,
      shiftCode: row.shift_code,
      level: row.level,
      authorizedDate: row.authorized_date,
      expiryDate: row.expiry_date || null,
      authorizerStaffCode: row.authorizer_staff_code,
    })),
    shiftDemands: demandRows.map((row) => ({
      canonicalCode: row.canonical_code,
      dayType: row.day_type,
      minCount: row.min_count,
      requiresLead: row.requires_lead,
    })),
    holidays: holidayRows.map((row) => ({
      localDate: row.local_date,
      nameTh: row.name_th,
      nameEn: row.name_en,
    })),
    rosterMonthSample: rosterMonthRows.map((row): RosterMonthSampleRow => ({
      staffCode: row.staff_code,
      localDate: row.local_date,
      canonicalCode: row.canonical_code,
      notes: row.notes ?? "",
    })),
    ruleInstances,
  };
}

/** โหลดทุก pack ที่ลงทะเบียนใน manifest */
export function loadAllStarterPacks(baseDir = process.cwd()): StarterPackSnapshot[] {
  const manifest = loadStarterPackManifest(baseDir);
  return manifest.packs.map((pack) => loadStarterPack(pack.id, baseDir));
}
