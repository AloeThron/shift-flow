import type { RuleValidatorFn } from "@/domain/rules/types";
import { assignmentHoursInWindow } from "@/domain/schedule/time";
import type { ConstraintViolation, ScheduleAssignment } from "@/domain/schedule/types";

/** HC-006 — ชั่วโมงสูงสุดใน rolling window */
export const validateMaxHoursInWindow: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as {
    rollingWindowHours?: number;
    maxHoursInWindow?: number;
  };
  const rollingWindowHours = params.rollingWindowHours ?? 24;
  const maxHoursInWindow = params.maxHoursInWindow ?? 16;
  const windowMs = rollingWindowHours * 3_600_000;
  const violations: ConstraintViolation[] = [];

  const byStaff = new Map<string, ScheduleAssignment[]>();
  for (const assignment of context.allAssignments) {
    const list = byStaff.get(assignment.staffId) ?? [];
    list.push(assignment);
    byStaff.set(assignment.staffId, list);
  }

  for (const [staffId, assignments] of byStaff) {
    const eventPoints = new Set<number>();
    for (const assignment of assignments) {
      eventPoints.add(Date.parse(assignment.startAt));
      eventPoints.add(Date.parse(assignment.endAt));
    }

    for (const point of eventPoints) {
      const windowStart = point;
      const windowEnd = point + windowMs;
      const hours = assignments.reduce(
        (total, assignment) => total + assignmentHoursInWindow(assignment, windowStart, windowEnd),
        0,
      );

      if (hours > maxHoursInWindow) {
        violations.push({
          code: "MAX_HOURS_IN_WINDOW",
          source: "RULE",
          ruleTemplateId: ruleInstance.ruleTemplateId,
          ruleInstanceId: ruleInstance.id,
          severity: ruleInstance.severity,
          weight: ruleInstance.weight ?? undefined,
          messageTh: `ชั่วโมงสะสม ${hours.toFixed(1)} ชม. เกิน ${maxHoursInWindow} ชม. ใน ${rollingWindowHours} ชม.`,
          staffId,
          details: {
            hours,
            maxHoursInWindow,
            rollingWindowHours,
            windowStartIso: new Date(windowStart).toISOString(),
          },
        });
      }
    }
  }

  return violations;
};
