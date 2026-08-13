import { canvasStaffRows, type ScheduleCanvasGrid } from "@/domain/schedule/canvas-grid";
import type { ConstraintViolation, FeasibilityIssue } from "@/domain/schedule/types";
import type { CanvasDepartmentOption } from "@/lib/scheduling/load-canvas-draft";

export type LabelMap = ReadonlyMap<string, string>;

/** สร้าง map ชื่อพนักงานจาก grid */
export function buildStaffLabelMap(grid: ScheduleCanvasGrid): LabelMap {
  return new Map(
    canvasStaffRows(grid).map((row) => [row.staffProfileId, `${row.staffCode} · ${row.staffName}`]),
  );
}

/** สร้าง map ชื่อแผนก */
export function buildDepartmentLabelMap(departments: readonly CanvasDepartmentOption[]): LabelMap {
  return new Map(departments.map((dept) => [dept.id, `${dept.code} · ${dept.displayName}`]));
}

/** @deprecated ใช้ buildDepartmentLabelMap */
export const buildWorkAreaLabelMap = buildDepartmentLabelMap;

/** resolve label จาก map — fallback เป็น id ย่อ */
export function resolveLabel(map: LabelMap, id: string | undefined): string | null {
  if (!id) {
    return null;
  }

  const label = map.get(id);
  if (label) {
    return label;
  }

  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

/** จัดรูปวันที่ให้อ่านง่าย */
export function formatScheduleDateLabel(date: string | undefined): string | null {
  if (!date) {
    return null;
  }

  const parsed = Date.parse(`${date}T12:00:00`);
  if (Number.isNaN(parsed)) {
    return date;
  }

  return new Intl.DateTimeFormat("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(parsed));
}

/** อ่านตัวเลขจาก details */
function readNumber(details: Readonly<Record<string, unknown>>, key: string): number | null {
  const value = details[key];
  return typeof value === "number" ? value : null;
}

/** อ่าน string จาก details */
function readString(details: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = details[key];
  return typeof value === "string" ? value : null;
}

/** อ่าน array ของ string จาก details */
function readStringArray(
  details: Readonly<Record<string, unknown>>,
  key: string,
): readonly string[] {
  const value = details[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

/** สรุป details ตาม code — ไม่ dump ทั้ง Record */
export function formatViolationDetails(
  code: string,
  details: Readonly<Record<string, unknown>> | undefined,
): string | null {
  if (!details) {
    return null;
  }

  const parts: string[] = [];

  switch (code) {
    case "MIN_REST_BETWEEN_SHIFTS": {
      const restHours = readNumber(details, "restHours");
      const minRestHours = readNumber(details, "minRestHours");
      if (restHours !== null && minRestHours !== null) {
        parts.push(`พัก ${restHours.toFixed(1)}/${minRestHours} ชม.`);
      }
      break;
    }
    case "MAX_CONSECUTIVE_DAYS":
    case "MAX_CONSECUTIVE_NIGHTS": {
      const streak = readNumber(details, "streak");
      const streakStart = readString(details, "streakStart");
      if (streak !== null) {
        parts.push(`streak ${streak} วัน`);
      }
      if (streakStart) {
        parts.push(`เริ่ม ${formatScheduleDateLabel(streakStart) ?? streakStart}`);
      }
      break;
    }
    case "OT_LIMIT": {
      const otHours = readNumber(details, "otHours") ?? readNumber(details, "orgOtHours");
      const maxHours =
        readNumber(details, "maxOtHoursPerStaffPerCycle") ??
        readNumber(details, "maxOtHoursPerOrgPerCycle");
      if (otHours !== null && maxHours !== null) {
        parts.push(`OT ${otHours.toFixed(1)}/${maxHours} ชม.`);
      }
      break;
    }
    case "DAY_OFF_QUOTA": {
      const offCount = readNumber(details, "offCount");
      const requiredOffDays = readNumber(details, "requiredOffDays");
      const weekendOffCount = readNumber(details, "weekendOffCount");
      const minWeekendDaysOff = readNumber(details, "minWeekendDaysOff");
      if (offCount !== null && requiredOffDays !== null) {
        parts.push(`หยุด ${offCount}/${requiredOffDays} วัน`);
      } else if (weekendOffCount !== null && minWeekendDaysOff !== null) {
        parts.push(`หยุดสุดสัปดาห์ ${weekendOffCount}/${minWeekendDaysOff} วัน`);
      }
      break;
    }
    case "MAX_STAFF_OFF_PER_DAY": {
      const offCount = readNumber(details, "offCount");
      const maxOff = readNumber(details, "maxOff");
      const staffIds = readStringArray(details, "staffIds");
      if (offCount !== null && maxOff !== null) {
        parts.push(`หยุด ${offCount}/${maxOff} คน`);
      }
      if (staffIds.length > 0) {
        parts.push(`${staffIds.length} คน`);
      }
      break;
    }
    case "REQUIRED_COVERAGE": {
      const matched = readNumber(details, "matched");
      const minCount = readNumber(details, "minCount");
      if (matched !== null && minCount !== null) {
        parts.push(`coverage ${matched}/${minCount} คน`);
      }
      break;
    }
    case "GRADE_CODE_WHITELIST": {
      const shiftCode = readString(details, "shiftCode");
      if (shiftCode) {
        parts.push(`รหัส ${shiftCode}`);
      }
      break;
    }
    case "FORBIDDEN_CODE_SEQUENCE": {
      const from = readString(details, "from");
      const to = readString(details, "to");
      const gapHours = readNumber(details, "gapHours");
      const minGapHours = readNumber(details, "minGapHours");
      if (from && to) {
        parts.push(`${from}→${to}`);
      }
      if (gapHours !== null && minGapHours !== null) {
        parts.push(`ช่องว่าง ${gapHours.toFixed(1)}/${minGapHours} ชม.`);
      }
      break;
    }
    case "FAIR_DISTRIBUTION": {
      const value = readNumber(details, "value");
      const minValue = readNumber(details, "minValue");
      const maxValue = readNumber(details, "maxValue");
      const toleranceHours = readNumber(details, "toleranceHours");
      if (value !== null && minValue !== null && maxValue !== null) {
        parts.push(`ค่า ${value.toFixed(1)} (ช่วง ${minValue.toFixed(1)}–${maxValue.toFixed(1)})`);
      }
      if (toleranceHours !== null) {
        parts.push(`tolerance ±${toleranceHours}`);
      }
      break;
    }
    case "NO_TIME_OVERLAP":
      parts.push("assignment ทับเวลา");
      break;
    default:
      break;
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

/** บรรทัดเมตาของ violation */
export function formatViolationMeta(
  violation: ConstraintViolation,
  staffLabelById: LabelMap,
  departmentLabelById: LabelMap,
): string | null {
  const parts = [
    resolveLabel(staffLabelById, violation.staffId),
    formatScheduleDateLabel(violation.scheduleDate),
    resolveLabel(departmentLabelById, violation.departmentId),
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : null;
}

export type CoverageGapDisplay = {
  readonly headline: string;
  readonly meta: string;
};

/** สรุป coverage gap / blocking feasibility ต่อ issue */
export function formatCoverageGapDisplay(
  issue: FeasibilityIssue,
  departmentLabelById: LabelMap,
  shiftCodeLabelById: LabelMap = new Map(),
): CoverageGapDisplay {
  if (issue.kind === "MISSING_SHIFT_AUTH") {
    const shiftCodeLabel = resolveLabel(shiftCodeLabelById, issue.shiftCodeId);
    return {
      headline: issue.messageTh,
      meta: [
        formatScheduleDateLabel(issue.scheduleDate),
        shiftCodeLabel ? `รหัส ${shiftCodeLabel}` : null,
        resolveLabel(departmentLabelById, issue.departmentId),
        "ตั้งสิทธิที่ การตั้งค่า → บุคลากร → เลือก staff → สิทธิปฏิบัติงาน",
        "เว้นวันหมดอายุ = ไม่หมดอายุ",
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · "),
    };
  }

  if (issue.kind === "UNCONFIRMED_CODE") {
    const shiftCodeLabel = resolveLabel(shiftCodeLabelById, issue.shiftCodeId);
    return {
      headline: issue.messageTh,
      meta: [
        formatScheduleDateLabel(issue.scheduleDate),
        shiftCodeLabel ? `รหัส ${shiftCodeLabel}` : null,
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · "),
    };
  }

  if (issue.kind === "INSUFFICIENT_STAFF" && issue.requiredCount !== undefined) {
    const shiftCodeLabel = resolveLabel(shiftCodeLabelById, issue.shiftCodeId);
    return {
      headline: issue.messageTh,
      meta: [
        formatScheduleDateLabel(issue.scheduleDate),
        shiftCodeLabel ? `รหัส ${shiftCodeLabel}` : null,
        issue.availableCount !== undefined ? `ว่าง ${issue.availableCount} คน` : null,
      ]
        .filter((part): part is string => Boolean(part))
        .join(" · "),
    };
  }

  const shortfall = issue.shortfallCount ?? 0;
  const departmentLabel = resolveLabel(departmentLabelById, issue.departmentId) ?? "ไม่ระบุแผนก";
  const shiftCodeLabel = resolveLabel(shiftCodeLabelById, issue.shiftCodeId);
  const timeRange = issue.startTime && issue.endTime ? `${issue.startTime}–${issue.endTime}` : null;

  const headlineParts = [`ขาด ${shortfall} คน`, departmentLabel];
  if (shiftCodeLabel) {
    headlineParts.push(shiftCodeLabel);
  }
  if (timeRange) {
    headlineParts.push(timeRange);
  }

  const matched = issue.matchedCount ?? 0;
  const required = issue.requiredCount ?? 0;
  const potentialCount = issue.staffIds?.length ?? 0;

  const metaParts = [
    formatScheduleDateLabel(issue.scheduleDate),
    required > 0 ? `ต้องการ ${required}` : null,
    `จัดแล้ว ${matched}`,
    potentialCount > 0 ? `ว่างที่อาจเติม ${potentialCount}` : null,
  ].filter((part): part is string => Boolean(part));

  return {
    headline: headlineParts.join(" · "),
    meta: metaParts.join(" · "),
  };
}

/** กรอง issue ที่แสดงใน CoverageGapSection */
export function filterCoverageGapIssues(
  issues: readonly FeasibilityIssue[],
): readonly FeasibilityIssue[] {
  return issues.filter(
    (issue) =>
      issue.kind === "COVERAGE_GAP" ||
      issue.kind === "INSUFFICIENT_STAFF" ||
      issue.kind === "MISSING_SHIFT_AUTH" ||
      issue.kind === "UNCONFIRMED_CODE",
  );
}

/** นับวันที่ไม่ซ้ำของ coverage gap */
export function countUniqueCoverageGapDates(issues: readonly FeasibilityIssue[]): number {
  const dates = new Set<string>();
  for (const issue of filterCoverageGapIssues(issues)) {
    if (issue.scheduleDate) {
      dates.add(issue.scheduleDate);
    }
  }
  return dates.size;
}

/** badge สรุป coverage gap */
export function coverageGapSectionBadge(issues: readonly FeasibilityIssue[]): {
  readonly gapCount: number;
  readonly uniqueDateCount: number;
} {
  const gaps = filterCoverageGapIssues(issues);
  return {
    gapCount: gaps.length,
    uniqueDateCount: countUniqueCoverageGapDates(issues),
  };
}
