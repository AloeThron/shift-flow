import { demandAppliesToDate, eachDateInRange } from "@/domain/schedule/time";
import type { ScheduleEngineInput, ScheduleSlot } from "@/domain/schedule/types";

/** สร้าง ScheduleSlot จาก shift demands ของรอบ */
export function buildDemandSlots(input: ScheduleEngineInput): ScheduleSlot[] {
  const slots: ScheduleSlot[] = [];
  const dates = eachDateInRange(input.cycleStartDate, input.cycleEndDate);
  const shiftCodeById = new Map(input.shiftCodes.map((code) => [code.id, code]));

  for (const date of dates) {
    for (const demand of input.shiftDemands) {
      if (!demandAppliesToDate(demand, date, input.holidayDates)) {
        continue;
      }

      const shiftCode = shiftCodeById.get(demand.shiftCodeId);
      if (!shiftCode || !shiftCode.active || shiftCode.needsConfirmation) {
        continue;
      }

      for (let index = 0; index < demand.minCount; index += 1) {
        slots.push({
          id: `demand-${demand.id}-${date}-${index}`,
          scheduleDate: date,
          shiftCodeId: demand.shiftCodeId,
        });
      }
    }
  }

  return slots.sort((left, right) => {
    const dateCompare = left.scheduleDate.localeCompare(right.scheduleDate);
    if (dateCompare !== 0) {
      return dateCompare;
    }
    return left.id.localeCompare(right.id);
  });
}

/** @deprecated ใช้ buildDemandSlots แทน */
export const buildCoverageSlots = buildDemandSlots;
