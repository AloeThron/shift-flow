import type { InvariantValidatorFn } from "@/domain/rules/types";
import type { ConstraintViolation } from "@/domain/schedule/types";

/** HC-002 — ไม่จัดทับวันหยุด/ลาที่วางแผนและบล็อกการจัดเวร */
export const validateApprovedLeaveBlock: InvariantValidatorFn = (context) => {
  const violations: ConstraintViolation[] = [];

  for (const assignment of context.allAssignments) {
    for (const planned of context.plannedNonWorkingDays) {
      if (!planned.blocksScheduling) {
        continue;
      }
      if (planned.staffId !== assignment.staffId) {
        continue;
      }
      if (planned.localDate !== assignment.scheduleDate) {
        continue;
      }
      violations.push({
        code: "APPROVED_LEAVE_BLOCK",
        source: "INVARIANT",
        severity: "HARD",
        messageTh: "จัดเวรทับวันหยุด/ลาที่วางแผนไว้",
        staffId: assignment.staffId,
        assignmentId: assignment.id,
        scheduleDate: assignment.scheduleDate,
      });
    }
  }

  return violations;
};
