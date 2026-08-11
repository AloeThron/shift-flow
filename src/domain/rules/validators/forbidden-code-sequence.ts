import type { RuleValidatorFn } from "@/domain/rules/types";
import { addDaysToDate, hoursBetween } from "@/domain/schedule/time";
import type { ConstraintViolation, ScheduleAssignment } from "@/domain/schedule/types";

/** HC-008 — ห้ามลำดับรหัสต่อกัน */
export const validateForbiddenCodeSequence: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as {
    sequences?: readonly { from: string; to: string }[];
    minGapHours?: number;
  };
  const sequences = params.sequences ?? [];
  if (sequences.length === 0) {
    return [];
  }

  const violations: ConstraintViolation[] = [];
  const byStaff = new Map<string, ScheduleAssignment[]>();
  for (const assignment of context.allAssignments) {
    const list = byStaff.get(assignment.staffId) ?? [];
    list.push(assignment);
    byStaff.set(assignment.staffId, list);
  }

  for (const [staffId, assignments] of byStaff) {
    const byDate = new Map<string, ScheduleAssignment[]>();
    for (const assignment of assignments) {
      const list = byDate.get(assignment.scheduleDate) ?? [];
      list.push(assignment);
      byDate.set(assignment.scheduleDate, list);
    }

    for (const sequence of sequences) {
      for (const [date, dayAssignments] of byDate) {
        const fromAssignment = dayAssignments.find((item) => {
          const code = context.shiftCodeById.get(item.shiftCodeId);
          return code?.code === sequence.from;
        });
        if (!fromAssignment) {
          continue;
        }

        const nextDate = addDaysToDate(date, 1);
        const nextDay = byDate.get(nextDate) ?? [];
        const toAssignment = nextDay.find((item) => {
          const code = context.shiftCodeById.get(item.shiftCodeId);
          return code?.code === sequence.to;
        });
        if (!toAssignment) {
          continue;
        }

        const gapHours = hoursBetween(fromAssignment.endAt, toAssignment.startAt);
        const minGap = params.minGapHours;
        const gapViolated = minGap !== undefined ? gapHours < minGap : true;

        if (gapViolated) {
          violations.push({
            code: "FORBIDDEN_CODE_SEQUENCE",
            source: "RULE",
            ruleTemplateId: ruleInstance.ruleTemplateId,
            ruleInstanceId: ruleInstance.id,
            severity: ruleInstance.severity,
            weight: ruleInstance.weight ?? undefined,
            messageTh: `ห้ามลำดับ ${sequence.from} → ${sequence.to} ในวันถัดไป`,
            staffId,
            assignmentId: toAssignment.id,
            scheduleDate: nextDate,
            details: { from: sequence.from, to: sequence.to, gapHours, minGapHours: minGap },
          });
        }
      }
    }
  }

  return violations;
};
