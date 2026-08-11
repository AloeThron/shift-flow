import { eachDateInRange } from "@/domain/schedule/time";

import type { PublishedRosterGridCell, PublishedRosterGridRow } from "./types";

/** assignment ดิบสำหรับประกอบตาราง share */
export type PublishedRosterAssignmentInput = {
  staffProfileId: string;
  displayName: string;
  localDate: string;
  shiftCode: string | null;
  nonWorkingDayKindCode: string | null;
  startsAt: string | null;
  endsAt: string | null;
};

/** ประกอบตารางเวร pivot คน × วัน สำหรับหน้า share */
export function buildPublishedRosterGrid(input: {
  periodStart: string;
  periodEnd: string;
  staff: readonly { id: string; displayName: string }[];
  assignments: readonly PublishedRosterAssignmentInput[];
}): {
  dates: readonly string[];
  rows: readonly PublishedRosterGridRow[];
} {
  const dates = eachDateInRange(input.periodStart, input.periodEnd);
  const cellByKey = new Map<string, PublishedRosterGridCell>();

  for (const assignment of input.assignments) {
    const isNonWorkingDay = assignment.nonWorkingDayKindCode !== null;
    const displayCode = isNonWorkingDay ? assignment.nonWorkingDayKindCode : assignment.shiftCode;

    cellByKey.set(`${assignment.staffProfileId}:${assignment.localDate}`, {
      localDate: assignment.localDate,
      displayCode,
      isNonWorkingDay,
      startsAt: assignment.startsAt,
      endsAt: assignment.endsAt,
    });
  }

  const staffOrder = [...input.staff].sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "th"),
  );

  const rows: PublishedRosterGridRow[] = staffOrder.map((person) => ({
    staffProfileId: person.id,
    displayName: person.displayName,
    cells: dates.map(
      (date) =>
        cellByKey.get(`${person.id}:${date}`) ?? {
          localDate: date,
          displayCode: null,
          isNonWorkingDay: false,
          startsAt: null,
          endsAt: null,
        },
    ),
  }));

  return { dates, rows };
}
