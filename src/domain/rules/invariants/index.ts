import type { InvariantValidatorFn } from "@/domain/rules/types";
import { validateApprovedLeaveBlock } from "./approved-leave-block";
import { validateMidnightIntegrity } from "./midnight-integrity";
import { validateNoTimeOverlap } from "./no-time-overlap";
import { validateUnconfirmedCodeBlocked } from "./unconfirmed-code-blocked";

/** invariant ทั้งหมดที่ engine บังคับเสมอ */
export const ENGINE_INVARIANTS: readonly InvariantValidatorFn[] = [
  validateNoTimeOverlap,
  validateApprovedLeaveBlock,
  validateUnconfirmedCodeBlocked,
  validateMidnightIntegrity,
];

/** รัน invariant ทั้งชุด */
export function runEngineInvariants(context: Parameters<InvariantValidatorFn>[0]) {
  return ENGINE_INVARIANTS.flatMap((validator) => validator(context));
}

export {
  validateApprovedLeaveBlock,
  validateMidnightIntegrity,
  validateNoTimeOverlap,
  validateUnconfirmedCodeBlocked,
};
