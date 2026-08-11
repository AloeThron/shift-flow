import type { RuleValidatorFn } from "@/domain/rules/types";
import { hoursBetween } from "@/domain/schedule/time";
import type { ConstraintViolation, ScheduleAssignment } from "@/domain/schedule/types";

/** HC-005 — พักขั้นต่ำระหว่างเวร */
export const validateMinRestBetweenShifts: RuleValidatorFn = (context, ruleInstance) => {
  const params = ruleInstance.params as { minRestHours?: number };
  const minRestHours = params.minRestHours ?? 11;
  const violations: ConstraintViolation[] = [];

  const byStaff = new Map<string, ScheduleAssignment[]>();
  for (const assignment of context.allAssignments) {
    const list = byStaff.get(assignment.staffId) ?? [];
    list.push(assignment);
    byStaff.set(assignment.staffId, list);
  }

  for (const [staffId, assignments] of byStaff) {
    const sorted = [...assignments].sort(
      (left, right) => Date.parse(left.startAt) - Date.parse(right.startAt),
    );
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const restHours = hoursBetween(previous.endAt, current.startAt);
      if (restHours < minRestHours) {
        violations.push({
          code: "MIN_REST_BETWEEN_SHIFTS",
          source: "RULE",
          ruleTemplateId: ruleInstance.ruleTemplateId,
          ruleInstanceId: ruleInstance.id,
          severity: ruleInstance.severity,
          weight: ruleInstance.weight ?? undefined,
          messageTh: `พักระหว่างเวร ${restHours.toFixed(1)} ชม. น้อยกว่าขั้นต่ำ ${minRestHours} ชม.`,
          staffId,
          assignmentId: current.id,
          scheduleDate: current.scheduleDate,
          details: { restHours, minRestHours },
        });
      }
    }
  }

  return violations;
};
