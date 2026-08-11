import type { IncrementalValidationScope } from "@/domain/schedule/validate";

/** ตัวเลือกที่ popup เสนอได้ */
export type SuggestionAction =
  | { readonly kind: "SHIFT_CODE"; readonly shiftCodeId: string; readonly code: string }
  | { readonly kind: "PLANNED_OFF"; readonly nonWorkingDayKindId: string; readonly code: string }
  | {
      readonly kind: "SWAP_WITH";
      readonly counterpartStaffId: string;
      readonly counterpartCode: string;
    }
  | { readonly kind: "OVERRIDE"; readonly shiftCodeId: string; readonly code: string }
  | { readonly kind: "CLEAR" };

/** assignment ของคนอื่นในวันเดียว — ใช้สร้างตัวเลือกสลับ */
export type SameDayAssignmentRef = {
  readonly staffId: string;
  readonly staffDisplayName: string;
  readonly shiftCodeId: string;
  readonly code: string;
};

/** คีย์เรียงลำดับ lexicographic — เปิดเผยเพื่อ assert ในเทสต์ */
export type SuggestionRank = {
  readonly blocked: boolean;
  readonly coverageGapFilled: number;
  readonly fairnessGain: number;
  readonly softScoreDelta: number;
  readonly recentUsage: number;
};

/** ช่องว่าง demand ที่ยังขาดในวันเดียว */
export type CoverageGapSnapshot = {
  readonly requirementId: string;
  readonly shiftCodeId: string;
  readonly startAt: string;
  readonly endAt: string;
};

/** ชนิดวันหยุดที่วางแผน — อ้างจาก config ไม่ hardcode */
export type NonWorkingDayKindRef = {
  readonly id: string;
  readonly code: string;
  readonly displayName: string;
};

/** baseline ที่คำนวณครั้งเดียวตอนเปิด popup */
export type SuggestionBaseline = {
  readonly hardViolationKeys: ReadonlySet<string>;
  readonly softViolationKeys: ReadonlySet<string>;
  readonly softScore: number;
  readonly coverageGaps: readonly CoverageGapSnapshot[];
  readonly groupMean: number;
  readonly staffMetric: number;
  readonly recentUsageByCode: ReadonlyMap<string, number>;
  readonly scope: IncrementalValidationScope;
};

/** รายการแนะนำรหัสเวรต่อเซลล์ */
export type ShiftCodeSuggestion = {
  readonly action: SuggestionAction;
  readonly labelTh: string;
  readonly standardHours: number;
  readonly otHours: number;
  readonly isNightShift: boolean;
  readonly blockingReasonsTh: readonly string[];
  readonly warningsTh: readonly string[];
  readonly rank: SuggestionRank;
};

/** พารามิเตอร์จัดอันดับรหัสเวร */
export type RankShiftCodeCandidatesParams = {
  readonly staffId: string;
  readonly localDate: string;
  readonly baseline: SuggestionBaseline;
  readonly nonWorkingDayKinds: readonly NonWorkingDayKindRef[];
  readonly defaultOffKindId: string;
  readonly staffGroupId?: string;
  readonly sameDayAssignments?: readonly SameDayAssignmentRef[];
};
