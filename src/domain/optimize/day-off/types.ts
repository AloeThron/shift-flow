import type {
  PlannedNonWorkingDaySnapshot,
  RuleInstanceSnapshot,
  ScheduleAssignment,
  ShiftCodeSnapshot,
  StaffSnapshot,
  StaffWorkloadMonthlySnapshot,
} from "@/domain/schedule/types";

/** ที่มาของวันหยุดที่วางแผน — สอดคล้อง Prisma PlannedNonWorkingDaySource */
export type PlannedNonWorkingDaySource = "REQUEST" | "QUOTA" | "MANUAL";

/** คำขอวันหยุดจาก staff — soft preference ใน Stage A */
export type DayOffRequest = {
  readonly staffId: string;
  readonly localDate: string;
};

/** วันหยุดย้อนหลังก่อนรอบ — ใช้คิด gap cost */
export type HistoricalOffDate = {
  readonly staffId: string;
  readonly localDate: string;
};

/** น้ำหนักต้นทุน arc staff→day — อ่านจาก rule weight หรือ override */
export type DayOffCostWeights = {
  readonly base: number;
  readonly request: number;
  readonly gap: number;
  readonly weekend: number;
};

/** อินพุต Stage A — ลงวันหยุดด้วย sequential greedy spacing */
export type DayOffPlanInput = {
  readonly organizationId: string;
  readonly scheduleDraftId: string;
  readonly cycleStartDate: string;
  readonly cycleEndDate: string;
  readonly holidayDates: readonly string[];
  readonly staff: readonly StaffSnapshot[];
  readonly shiftCodes?: readonly ShiftCodeSnapshot[];
  readonly assignments?: readonly ScheduleAssignment[];
  readonly ruleInstances: readonly RuleInstanceSnapshot[];
  readonly nonWorkingDayKindId: string;
  readonly dayOffRequests?: readonly DayOffRequest[];
  readonly plannedNonWorkingDays?: readonly PlannedNonWorkingDaySnapshot[];
  readonly historicalOffDates?: readonly HistoricalOffDate[];
  readonly staffWorkloadMonthly?: readonly StaffWorkloadMonthlySnapshot[];
  readonly costWeights?: Partial<DayOffCostWeights>;
  readonly staffDayOffQuotas?: Readonly<Record<string, number>>;
};

/** ผลลัพธ์วันหยุดที่วางแผน — คืนจาก Stage A */
export type PlannedNonWorkingDayPlan = {
  readonly staffId: string;
  readonly localDate: string;
  readonly nonWorkingDayKindId: string;
  readonly source: PlannedNonWorkingDaySource;
  readonly locked: boolean;
};

/** ผล Stage A */
export type DayOffPlanResult = {
  readonly feasible: boolean;
  readonly plannedNonWorkingDays: readonly PlannedNonWorkingDayPlan[];
  readonly totalCost: number;
  readonly solverVersion: string;
  readonly messageTh?: string;
};
