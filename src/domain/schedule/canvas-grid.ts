import { eachDateInRange } from "@/domain/schedule/time";

/** หมวดย่อยภายใน StaffGroup — กำหนด manual ต่อคน */
export type StaffGroupSection = "RESULT_CAPABLE" | "RESULT_NOT_CAPABLE" | "PART_TIME";

/** ลำดับ section คงที่ใน canvas */
export const STAFF_GROUP_SECTION_ORDER: readonly StaffGroupSection[] = [
  "RESULT_CAPABLE",
  "RESULT_NOT_CAPABLE",
  "PART_TIME",
] as const;

/** ป้าย section ภาษาไทย */
export const STAFF_GROUP_SECTION_LABELS: Record<StaffGroupSection, string> = {
  RESULT_CAPABLE: "ออกผลได้",
  RESULT_NOT_CAPABLE: "ออกผลไม่ได้",
  PART_TIME: "Part time",
};

/** เซลล์ใน canvas — รวม assignment และ planned off */
export type ScheduleCanvasCell = {
  readonly assignmentId: string | null;
  readonly shiftCodeId: string | null;
  readonly shiftCode: string | null;
  readonly isPinned: boolean;
  readonly plannedOtHours: number;
  readonly isPlannedOff: boolean;
  readonly plannedOffLocked: boolean;
  readonly nonWorkingDayKindCode: string | null;
};

/** แถวพนักงานใน canvas */
export type ScheduleCanvasStaffRow = {
  readonly staffProfileId: string;
  readonly staffCode: string;
  readonly staffName: string;
  readonly staffGroupId: string | null;
  readonly staffGroupSection: StaffGroupSection;
  readonly rowOrder: number;
  readonly cells: readonly ScheduleCanvasCell[];
};

/** หัวข้อกลุ่มใน canvas */
export type ScheduleCanvasGroupHeader = {
  readonly kind: "group";
  readonly groupId: string | null;
  readonly groupCode: string;
  readonly displayName: string;
};

/** หัวข้อหมวดย่อยภายในกลุ่ม */
export type ScheduleCanvasSectionHeader = {
  readonly kind: "section";
  readonly groupId: string | null;
  readonly groupKey: string;
  readonly section: StaffGroupSection;
  readonly displayName: string;
  /** ไม่มีพนักงานในหมวดนี้ — ใช้ซ่อน/แสดงใน UI */
  readonly isEmpty: boolean;
};

/** แถวพนักงานใน canvas */
export type ScheduleCanvasStaffEntry = {
  readonly kind: "staff";
  readonly row: ScheduleCanvasStaffRow;
};

export type ScheduleCanvasRow =
  | ScheduleCanvasGroupHeader
  | ScheduleCanvasSectionHeader
  | ScheduleCanvasStaffEntry;

/** ตาราง canvas pivot คน × วัน พร้อมกลุ่ม */
export type ScheduleCanvasGrid = {
  readonly dates: readonly string[];
  readonly holidayDates: readonly string[];
  readonly rows: readonly ScheduleCanvasRow[];
};

/** assignment ดิบสำหรับประกอบ canvas */
export type CanvasAssignmentInput = {
  readonly id: string;
  readonly staffProfileId: string;
  readonly localDate: string;
  readonly shiftCodeId: string | null;
  readonly shiftCode: string | null;
  readonly isPinned: boolean;
  readonly plannedOtHours: number;
};

/** planned off ดิบ */
export type CanvasPlannedOffInput = {
  readonly staffProfileId: string;
  readonly localDate: string;
  readonly locked: boolean;
  readonly kindCode: string;
};

/** staff สำหรับ canvas */
export type CanvasStaffInput = {
  readonly id: string;
  readonly staffCode: string;
  readonly displayName: string;
  readonly staffGroupId: string | null;
  readonly staffGroupSection: StaffGroupSection;
  readonly rowOrder: number;
};

/** กลุ่ม staff */
export type CanvasStaffGroupInput = {
  readonly id: string;
  readonly code: string;
  readonly displayName: string;
  readonly sortOrder: number;
};

const UNGROUPED_KEY = "__ungrouped__";

/** สร้างเซลล์ว่าง */
function emptyCell(): ScheduleCanvasCell {
  return {
    assignmentId: null,
    shiftCodeId: null,
    shiftCode: null,
    isPinned: false,
    plannedOtHours: 0,
    isPlannedOff: false,
    plannedOffLocked: false,
    nonWorkingDayKindCode: null,
  };
}

/** เรียง staff ภายใน section */
function compareStaffRows(left: CanvasStaffInput, right: CanvasStaffInput): number {
  return left.rowOrder - right.rowOrder || left.staffCode.localeCompare(right.staffCode, "en");
}

/** สร้างแถว staff พร้อมเซลล์ */
function buildStaffEntry(
  person: CanvasStaffInput,
  dates: readonly string[],
  assignmentByKey: ReadonlyMap<string, CanvasAssignmentInput>,
  plannedOffByKey: ReadonlyMap<string, CanvasPlannedOffInput>,
): ScheduleCanvasStaffEntry {
  const cells: ScheduleCanvasCell[] = dates.map((date) => {
    const key = `${person.id}:${date}`;
    const off = plannedOffByKey.get(key);
    const assignment = assignmentByKey.get(key);

    if (off) {
      return {
        assignmentId: assignment?.id ?? null,
        shiftCodeId: assignment?.shiftCodeId ?? null,
        shiftCode: assignment?.shiftCode ?? null,
        isPinned: assignment?.isPinned ?? false,
        plannedOtHours: assignment?.plannedOtHours ?? 0,
        isPlannedOff: true,
        plannedOffLocked: off.locked,
        nonWorkingDayKindCode: off.kindCode,
      };
    }

    if (assignment) {
      return {
        assignmentId: assignment.id,
        shiftCodeId: assignment.shiftCodeId,
        shiftCode: assignment.shiftCode,
        isPinned: assignment.isPinned,
        plannedOtHours: assignment.plannedOtHours,
        isPlannedOff: false,
        plannedOffLocked: false,
        nonWorkingDayKindCode: null,
      };
    }

    return emptyCell();
  });

  return {
    kind: "staff",
    row: {
      staffProfileId: person.id,
      staffCode: person.staffCode,
      staffName: person.displayName,
      staffGroupId: person.staffGroupId,
      staffGroupSection: person.staffGroupSection,
      rowOrder: person.rowOrder,
      cells,
    },
  };
}

/** ประกอบตาราง canvas จาก staff, กลุ่ม, assignment และ planned off */
export function buildScheduleCanvasGrid(input: {
  readonly periodStart: string;
  readonly periodEnd: string;
  readonly holidayDates: readonly string[];
  readonly staffGroups: readonly CanvasStaffGroupInput[];
  readonly staff: readonly CanvasStaffInput[];
  readonly assignments: readonly CanvasAssignmentInput[];
  readonly plannedOff: readonly CanvasPlannedOffInput[];
}): ScheduleCanvasGrid {
  const dates = eachDateInRange(input.periodStart, input.periodEnd);
  const assignmentByKey = new Map<string, CanvasAssignmentInput>();
  const plannedOffByKey = new Map<string, CanvasPlannedOffInput>();

  for (const assignment of input.assignments) {
    assignmentByKey.set(`${assignment.staffProfileId}:${assignment.localDate}`, assignment);
  }

  for (const off of input.plannedOff) {
    plannedOffByKey.set(`${off.staffProfileId}:${off.localDate}`, off);
  }

  const groupOrder = [...input.staffGroups].sort((left, right) => left.sortOrder - right.sortOrder);
  const groupById = new Map(groupOrder.map((group) => [group.id, group]));

  const staffByGroup = new Map<string, CanvasStaffInput[]>();
  for (const person of input.staff) {
    const key = person.staffGroupId ?? UNGROUPED_KEY;
    const bucket = staffByGroup.get(key) ?? [];
    bucket.push(person);
    staffByGroup.set(key, bucket);
  }

  const orderedGroupKeys: string[] = groupOrder.map((group) => group.id);
  if (staffByGroup.has(UNGROUPED_KEY)) {
    orderedGroupKeys.push(UNGROUPED_KEY);
  }

  const rows: ScheduleCanvasRow[] = [];

  for (const groupKey of orderedGroupKeys) {
    if (groupKey === UNGROUPED_KEY) {
      rows.push({
        kind: "group",
        groupId: null,
        groupCode: UNGROUPED_KEY,
        displayName: "ไม่ระบุกลุ่ม",
      });
    } else {
      const group = groupById.get(groupKey);
      rows.push({
        kind: "group",
        groupId: groupKey,
        groupCode: group?.code ?? groupKey,
        displayName: group?.displayName ?? groupKey,
      });
    }

    const members = staffByGroup.get(groupKey) ?? [];

    for (const section of STAFF_GROUP_SECTION_ORDER) {
      const sectionMembers = members
        .filter((person) => person.staffGroupSection === section)
        .sort(compareStaffRows);

      rows.push({
        kind: "section",
        groupId: groupKey === UNGROUPED_KEY ? null : groupKey,
        groupKey,
        section,
        displayName: STAFF_GROUP_SECTION_LABELS[section],
        isEmpty: sectionMembers.length === 0,
      });

      for (const person of sectionMembers) {
        rows.push(buildStaffEntry(person, dates, assignmentByKey, plannedOffByKey));
      }
    }
  }

  return { dates, holidayDates: input.holidayDates, rows };
}

/** ดึงรายการ staff rows จาก grid */
export function canvasStaffRows(grid: ScheduleCanvasGrid): readonly ScheduleCanvasStaffRow[] {
  return grid.rows
    .filter((row): row is ScheduleCanvasStaffEntry => row.kind === "staff")
    .map((row) => row.row);
}
