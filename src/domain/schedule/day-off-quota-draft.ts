import { countWeeksInCycle } from "@/domain/rules/helpers/schedule-metrics";
import type { RuleInstanceSnapshot } from "@/domain/schedule/types";

/** โควตาต่อ staff — ใช้ record เพื่อ serialize ข้าม server/client ได้ */
export type StaffDayOffQuotaByStaffId = Readonly<Record<string, number>>;

/** แถวโควตาที่บันทึกใน draft */
export type SavedStaffDayOffQuotaRow = {
  readonly staffProfileId: string;
  readonly daysOffQuota: number;
};

/** ผล validate โควตาครบทุกคน */
export type StaffDayOffQuotaValidation =
  | { readonly ok: true }
  | { readonly ok: false; readonly missingStaffIds: readonly string[] };

const MIN_DAYS_OFF_QUOTA = 0;
const MAX_DAYS_OFF_QUOTA = 31;

/** อ่าน rule DAY_OFF_QUOTA ที่เปิดใช้ */
function findEnabledDayOffQuotaRule(
  ruleInstances: readonly RuleInstanceSnapshot[],
): RuleInstanceSnapshot | undefined {
  return ruleInstances.find((rule) => rule.enabled && rule.ruleTemplateId === "DAY_OFF_QUOTA");
}

/** คำนวณโควตา default จาก rule DAY_OFF_QUOTA */
export function resolveDefaultDayOffQuota(
  cycleStartDate: string,
  cycleEndDate: string,
  ruleInstances: readonly RuleInstanceSnapshot[],
): number {
  const quotaRule = findEnabledDayOffQuotaRule(ruleInstances);
  if (!quotaRule) {
    return 0;
  }

  const params = quotaRule.params as {
    daysOffPerCycle?: number;
    daysOffPerWeek?: number;
  };

  if (params.daysOffPerCycle !== undefined) {
    return params.daysOffPerCycle;
  }

  if (params.daysOffPerWeek !== undefined) {
    return params.daysOffPerWeek * countWeeksInCycle(cycleStartDate, cycleEndDate);
  }

  return 0;
}

/** ตรวจว่าเป็นจำนวนเต็มโควตาที่ใช้ได้ */
export function isValidDayOffQuotaValue(value: number | null | undefined): value is number {
  return (
    value !== null &&
    value !== undefined &&
    Number.isInteger(value) &&
    value >= MIN_DAYS_OFF_QUOTA &&
    value <= MAX_DAYS_OFF_QUOTA
  );
}

/** รวมโควตาที่บันทึกแล้วกับ default ต่อ staff */
export function mergeStaffDayOffQuotas(
  staffIds: readonly string[],
  savedRows: readonly SavedStaffDayOffQuotaRow[],
  defaultQuota: number,
): StaffDayOffQuotaByStaffId {
  const savedByStaff = new Map(savedRows.map((row) => [row.staffProfileId, row.daysOffQuota]));
  const merged: Record<string, number> = {};

  for (const staffId of staffIds) {
    merged[staffId] = savedByStaff.get(staffId) ?? defaultQuota;
  }

  return merged;
}

/** ตรวจว่าทุก staff มีโควตาที่กรอกครบ */
export function validateStaffDayOffQuotasComplete(
  staffIds: readonly string[],
  quotas: ReadonlyMap<string, number | null | undefined>,
): StaffDayOffQuotaValidation {
  const missingStaffIds = staffIds.filter(
    (staffId) => !isValidDayOffQuotaValue(quotas.get(staffId)),
  );

  if (missingStaffIds.length > 0) {
    return { ok: false, missingStaffIds };
  }

  return { ok: true };
}

/** แปลง state UI เป็น record สำหรับ solver/validator */
export function staffDayOffQuotasForSolver(
  quotas: ReadonlyMap<string, number | null | undefined>,
): StaffDayOffQuotaByStaffId {
  const solverRecord: Record<string, number> = {};

  for (const [staffId, quota] of quotas) {
    if (isValidDayOffQuotaValue(quota)) {
      solverRecord[staffId] = quota;
    }
  }

  return solverRecord;
}

/** สร้าง map โควตาจาก payload ที่ serialize แล้ว */
export function staffDayOffQuotaMapFromRecord(
  quotas: StaffDayOffQuotaByStaffId,
): Map<string, number> {
  return new Map(Object.entries(quotas));
}

/** serialize record สำหรับ checksum */
export function serializeStaffDayOffQuotas(
  quotas: StaffDayOffQuotaByStaffId,
): readonly { readonly staffId: string; readonly daysOffQuota: number }[] {
  return Object.entries(quotas)
    .map(([staffId, daysOffQuota]) => ({ staffId, daysOffQuota }))
    .sort((left, right) => left.staffId.localeCompare(right.staffId, "en"));
}
