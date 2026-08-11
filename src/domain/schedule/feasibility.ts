import { staffHasShiftAuthForInterval } from "@/domain/schedule/shift-auth";
import {
    buildAssignmentInterval,
    demandAppliesToDate,
    eachDateInRange,
    intervalsOverlap,
} from "@/domain/schedule/time";
import type {
    FeasibilityIssue,
    FeasibilityResult,
    ScheduleEngineInput,
    ScheduleSlot,
} from "@/domain/schedule/types";

/** ตรวจว่า staff ว่างในช่วงเวลา */
function isStaffAvailable(
  staffId: string,
  startAt: string,
  endAt: string,
  input: ScheduleEngineInput,
): boolean {
  for (const planned of input.plannedNonWorkingDays) {
    if (planned.staffId === staffId && planned.localDate === startAt.slice(0, 10)) {
      return false;
    }
  }

  for (const assignment of input.assignments) {
    if (assignment.staffId === staffId) {
      if (intervalsOverlap(startAt, endAt, assignment.startAt, assignment.endAt)) {
        return false;
      }
    }
  }

  return true;
}

/** นับ staff ที่ assign slot ได้ */
function eligibleStaffForSlot(
  slot: ScheduleSlot,
  shiftCode: ScheduleEngineInput["shiftCodes"][number],
  input: ScheduleEngineInput,
  interval: { startAt: string; endAt: string },
): readonly string[] {
  const eligible: string[] = [];

  for (const member of input.staff) {
    if (!shiftCode.allowedGradeIds.includes(member.gradeId)) {
      continue;
    }

    if (
      !staffHasShiftAuthForInterval(
        member.shiftAuthorizations,
        slot.shiftCodeId,
        Date.parse(interval.startAt),
        Date.parse(interval.endAt),
      )
    ) {
      continue;
    }

    if (!isStaffAvailable(member.id, interval.startAt, interval.endAt, input)) {
      continue;
    }

    eligible.push(member.id);
  }

  return eligible;
}

/** วิเคราะห์ feasibility ก่อน solver — แจ้งช่องว่างที่อธิบายได้ */
export function analyzeFeasibility(
  input: ScheduleEngineInput,
  slots: readonly ScheduleSlot[] = [],
): FeasibilityResult {
  const issues: FeasibilityIssue[] = [];
  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));

  for (const slot of slots) {
    const shiftCode = shiftCodeById.get(slot.shiftCodeId);
    if (!shiftCode) {
      issues.push({
        kind: "UNCONFIRMED_CODE",
        messageTh: "slot อ้างรหัสเวรที่ไม่มีใน snapshot",
        scheduleDate: slot.scheduleDate,
        shiftCodeId: slot.shiftCodeId,
      });
      continue;
    }

    if (shiftCode.needsConfirmation || !shiftCode.active) {
      issues.push({
        kind: "UNCONFIRMED_CODE",
        messageTh: `รหัส ${shiftCode.code} ยังไม่ยืนยัน — ไม่ควรนำไปจัด`,
        scheduleDate: slot.scheduleDate,
        shiftCodeId: shiftCode.id,
      });
      continue;
    }

    const interval = buildAssignmentInterval(shiftCode, slot.scheduleDate, input.timezone);
    const eligible = eligibleStaffForSlot(slot, shiftCode, input, interval);

    if (eligible.length === 0) {
      const withAuth = input.staff.filter((member) => {
        if (!shiftCode.allowedGradeIds.includes(member.gradeId)) {
          return false;
        }
        return staffHasShiftAuthForInterval(
          member.shiftAuthorizations,
          slot.shiftCodeId,
          Date.parse(interval.startAt),
          Date.parse(interval.endAt),
        );
      });

      issues.push({
        kind: withAuth.length === 0 ? "MISSING_SHIFT_AUTH" : "INSUFFICIENT_STAFF",
        messageTh:
          withAuth.length === 0
            ? "ไม่มี staff ที่มีสิทธิรหัสเวรนี้และว่างในช่วงนี้"
            : "ไม่มี staff ว่างสำหรับ slot นี้",
        scheduleDate: slot.scheduleDate,
        departmentId: shiftCode.departmentId,
        shiftCodeId: shiftCode.id,
        requiredCount: 1,
        availableCount: 0,
      });
    }
  }

  const dates = eachDateInRange(input.cycleStartDate, input.cycleEndDate);
  for (const date of dates) {
    for (const demand of input.shiftDemands) {
      if (!demandAppliesToDate(demand, date, input.holidayDates)) {
        continue;
      }

      const shiftCode = shiftCodeById.get(demand.shiftCodeId);
      if (!shiftCode) {
        continue;
      }

      const interval = buildAssignmentInterval(shiftCode, date, input.timezone);

      let matched = 0;
      for (const assignment of input.assignments) {
        if (assignment.shiftCodeId !== demand.shiftCodeId) {
          continue;
        }
        if (assignment.scheduleDate !== date) {
          continue;
        }
        matched += 1;
      }

      if (matched < demand.minCount) {
        const potentialStaff = input.staff.filter((member) => {
          if (
            !staffHasShiftAuthForInterval(
              member.shiftAuthorizations,
              demand.shiftCodeId,
              Date.parse(interval.startAt),
              Date.parse(interval.endAt),
            )
          ) {
            return false;
          }
          return isStaffAvailable(member.id, interval.startAt, interval.endAt, input);
        });

        const shortfallCount = demand.minCount - matched;

        issues.push({
          kind:
            matched === 0 && potentialStaff.length < demand.minCount
              ? "INSUFFICIENT_STAFF"
              : "COVERAGE_GAP",
          messageTh: `coverage ขาด ${shortfallCount} คน`,
          scheduleDate: date,
          departmentId: shiftCode.departmentId,
          shiftCodeId: demand.shiftCodeId,
          requirementId: demand.id,
          startTime: shiftCode.startTime,
          endTime: shiftCode.endTime,
          requiredCount: demand.minCount,
          matchedCount: matched,
          shortfallCount,
          availableCount: matched + potentialStaff.length,
          staffIds: potentialStaff.map((member) => member.id),
        });
      }
    }
  }

  const hardKinds: ReadonlySet<FeasibilityIssue["kind"]> = new Set([
    "INSUFFICIENT_STAFF",
    "MISSING_SHIFT_AUTH",
    "UNCONFIRMED_CODE",
  ]);

  const feasible = !issues.some((issue) => hardKinds.has(issue.kind));
  return { feasible, issues };
}
