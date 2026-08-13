import { readFileSync } from "node:fs";
import { join } from "node:path";

import { buildAssignmentInterval } from "@/domain/schedule/time";
import type {
  ScheduleAssignment,
  ScheduleEngineInput,
  ShiftCodeSnapshot,
  StaffSnapshot,
} from "@/domain/schedule/types";

const DATASET = join(process.cwd(), "demo/validation-dataset");
const PACK = join(process.cwd(), "demo/starter-packs/pilot-lab-example");
const TIMEZONE = "Asia/Bangkok";

type RosterRow = {
  staffCode: string;
  localDate: string;
  rawCode: string;
  status: string;
};

type StaffRow = {
  staffCode: string;
  grade: string;
};

/** อ่าน CSV แบบง่าย */
function readCsv(path: string): string[][] {
  const text = readFileSync(path, "utf8").trim();
  return text
    .split("\n")
    .slice(1)
    .map((line) => line.split(",").map((part) => part.trim()));
}

/** ปกติ lookup key — trim + lowercase */
function normalizeToken(value: string): string {
  return value.trim().toLowerCase();
}

const NON_WORKING_CODES = new Set(["vac", "sick"]);

/** map grade จาก validation dataset → staff group */
function gradeToStaffGroupId(grade: string): string {
  switch (grade) {
    case "HEAD":
      return "grp-head";
    case "MT":
    case "PT":
      return "grp-mt";
    default:
      return "grp-asst";
  }
}

/** FTE ตาม grade ใน validation dataset */
function gradeToFte(grade: string): number {
  return grade === "PT" ? 0.5 : 1;
}

/** สร้าง shift codes จาก pilot-lab-example */
function buildShiftCodeSnapshots(): ShiftCodeSnapshot[] {
  const rows = readCsv(join(PACK, "shift_codes.csv"));
  return rows.map((parts, index) => ({
    id: `sc-${index}`,
    code: parts[0] ?? "",
    departmentId: parts[1] ? `dept-${parts[1]}` : undefined,
    startTime: parts[2] || "08:00",
    endTime: parts[3] || "16:00",
    standardHours: Number(parts[4] ?? 0),
    otHours: Number(parts[5] ?? 0),
    isNightShift: parts[6] === "true",
    allowedGradeIds: (parts[7] ?? "").split("|").filter(Boolean),
    needsConfirmation: parts[8] === "true",
    active: parts[9] !== "false",
  }));
}

/** หา shift code จาก raw token แบบ canonical เท่านั้น */
function findShiftCodeByRawToken(
  rawCode: string,
  shiftCodes: ShiftCodeSnapshot[],
): ShiftCodeSnapshot | undefined {
  const trimmed = rawCode.trim();
  if (!trimmed || trimmed === "?" || trimmed === "[แดง]") {
    return undefined;
  }
  if (NON_WORKING_CODES.has(normalizeToken(trimmed))) {
    return undefined;
  }

  return shiftCodes.find((entry) => normalizeToken(entry.code) === normalizeToken(trimmed));
}

/** โหลด roster_long จาก validation dataset */
export function loadValidationRosterRows(): readonly RosterRow[] {
  const rows = readCsv(join(DATASET, "roster_long.csv"));
  return rows.map((parts) => ({
    staffCode: parts[0] ?? "",
    localDate: parts[1] ?? "",
    rawCode: parts[3] ?? "",
    status: parts[8] ?? "",
  }));
}

/** โหลด staff_master จาก validation dataset */
export function loadValidationStaffRows(): readonly StaffRow[] {
  const rows = readCsv(join(DATASET, "staff_master.csv"));
  return rows.map((parts) => ({
    staffCode: parts[0] ?? "",
    grade: parts[1] ?? "ASSISTANT",
  }));
}

/** แปลง roster row เป็น assignment ถ้า map ได้ */
function rosterRowToAssignment(
  row: RosterRow,
  shiftCodes: ShiftCodeSnapshot[],
  offShiftCode: ShiftCodeSnapshot,
): ScheduleAssignment | undefined {
  if (row.status === "OFF") {
    const interval = buildAssignmentInterval(offShiftCode, row.localDate, TIMEZONE);
    return {
      id: `${row.staffCode}:${row.localDate}`,
      staffId: row.staffCode,
      shiftCodeId: offShiftCode.id,
      scheduleDate: row.localDate,
      startAt: interval.startAt,
      endAt: interval.endAt,
    };
  }

  if (row.status !== "ASSIGNED") {
    return undefined;
  }

  const shiftCode = findShiftCodeByRawToken(row.rawCode, shiftCodes);
  if (!shiftCode) {
    return undefined;
  }

  const interval = buildAssignmentInterval(shiftCode, row.localDate, TIMEZONE);
  return {
    id: `${row.staffCode}:${row.localDate}`,
    staffId: row.staffCode,
    shiftCodeId: shiftCode.id,
    scheduleDate: row.localDate,
    startAt: interval.startAt,
    endAt: interval.endAt,
    plannedOtHours: 0,
  };
}

/** สร้าง ScheduleEngineInput จาก validation dataset */
export function buildValidationScheduleInput(options: {
  cycleStartDate: string;
  cycleEndDate: string;
  includeHistoricalAssignments?: boolean;
}): {
  input: ScheduleEngineInput;
  allAssignments: readonly ScheduleAssignment[];
  shiftCodes: readonly ShiftCodeSnapshot[];
} {
  const shiftCodes = buildShiftCodeSnapshots();
  const offShiftCode = shiftCodes.find((entry) => entry.code === "off");
  if (!offShiftCode) {
    throw new Error("missing off shift code in pilot-lab-example");
  }

  const staffRows = loadValidationStaffRows();
  const staff: StaffSnapshot[] = staffRows.map((row) => ({
    id: row.staffCode,
    gradeId: row.grade,
    staffGroupId: gradeToStaffGroupId(row.grade),
    fte: gradeToFte(row.grade),
    shiftAuthorizations: [],
  }));

  const rosterRows = loadValidationRosterRows();
  const allAssignments = rosterRows
    .map((row) => rosterRowToAssignment(row, shiftCodes, offShiftCode))
    .filter((assignment): assignment is ScheduleAssignment => assignment !== undefined);

  const cycleAssignments = allAssignments.filter(
    (assignment) =>
      assignment.scheduleDate >= options.cycleStartDate &&
      assignment.scheduleDate <= options.cycleEndDate,
  );

  const historicalAssignments = options.includeHistoricalAssignments
    ? allAssignments.filter((assignment) => assignment.scheduleDate < options.cycleStartDate)
    : [];

  const input: ScheduleEngineInput = {
    organizationId: "org-validation",
    timezone: TIMEZONE,
    cycleStartDate: options.cycleStartDate,
    cycleEndDate: options.cycleEndDate,
    assignments: cycleAssignments,
    staff,
    shiftCodes,
    shiftDemands: [],
    ruleInstances: [],
    plannedNonWorkingDays: [],
    holidayDates: [],
  };

  return {
    input,
    allAssignments: [...historicalAssignments, ...cycleAssignments],
    shiftCodes,
  };
}
