import { isWorkingAssignment } from "@/domain/rules/helpers/schedule-metrics";
import { eachDateInRange, resolveDayType } from "@/domain/schedule/time";
import type {
    PlannedNonWorkingDaySnapshot,
    RuleInstanceSnapshot,
    StaffSnapshot,
} from "@/domain/schedule/types";

import type {
    DayOffCostWeights,
    DayOffPlanInput,
    DayOffPlanResult,
    HistoricalOffDate,
    PlannedNonWorkingDayPlan,
    PlannedNonWorkingDaySource,
} from "./types";

export type {
    DayOffCostWeights,
    DayOffPlanInput,
    DayOffPlanResult,
    DayOffRequest,
    HistoricalOffDate,
    PlannedNonWorkingDayPlan,
    PlannedNonWorkingDaySource
} from "./types";

const SOLVER_VERSION = "stage-a-sequential-spacing@1";

/** น้ำหนักต้นทุนเริ่มต้น — จำนวนเต็มเพื่อ determinism */
const DEFAULT_COST_WEIGHTS: DayOffCostWeights = {
  base: 1_000,
  request: 800,
  gap: 50,
  weekend: 200,
};

/** พารามิเตอร์ DAY_OFF_QUOTA */
type DayOffQuotaParams = {
  daysOffPerCycle?: number;
  daysOffPerWeek?: number;
  minWeekendDaysOff?: number;
};

/** พารามิเตอร์ MAX_STAFF_OFF_PER_DAY */
type MaxStaffOffParams = {
  maxOffWeekday?: number;
  maxOffWeekend?: number;
  maxOffHoliday?: number;
  scope?: "GROUP" | "ORG";
};

/** สถานะคงที่ของ staff×day ก่อน solve */
type FixedOffCell = {
  readonly staffId: string;
  readonly localDate: string;
  readonly locked: boolean;
  readonly source?: PlannedNonWorkingDaySource;
};

/** คู่ staff×day ที่ greedy เลือก */
type AssignCandidate = {
  readonly staffId: string;
  readonly localDate: string;
  readonly cost: number;
};

/** ลงวันหยุด Stage A — คืน PlannedNonWorkingDay จาก sequential greedy spacing */
export function planDayOff(input: DayOffPlanInput): DayOffPlanResult {
  const cycleDates = eachDateInRange(input.cycleStartDate, input.cycleEndDate);
  const quotaRule = findEnabledRule(input.ruleInstances, "DAY_OFF_QUOTA");
  const maxOffRule = findEnabledRule(input.ruleInstances, "MAX_STAFF_OFF_PER_DAY");

  if (!quotaRule) {
    return infeasibleResult("ไม่พบ rule DAY_OFF_QUOTA ที่เปิดใช้งาน");
  }

  const quotaParams = quotaRule.params as DayOffQuotaParams;
  const maxOffParams = (maxOffRule?.params ?? { scope: "GROUP" }) as MaxStaffOffParams;
  const maxOffScope = maxOffParams.scope ?? "GROUP";
  const minWeekendDaysOff = quotaParams.minWeekendDaysOff ?? 0;
  const costWeights = mergeCostWeights(input.costWeights, quotaRule, maxOffRule);

  const requestKeys = buildRequestKeySet(input.dayOffRequests ?? []);
  const fixedCells = collectFixedOffCells(input, cycleDates);
  const fixedByStaff = groupFixedByStaff(fixedCells);
  const historicalByStaff = groupHistoricalOffByStaff(input.historicalOffDates ?? []);

  const quotaByStaff = new Map<string, number>();
  for (const member of input.staff) {
    const override = input.staffDayOffQuotas?.[member.id];
    quotaByStaff.set(
      member.id,
      override ?? resolveStaffQuota(input.cycleStartDate, input.cycleEndDate, quotaParams),
    );
  }

  const preflight = validatePreflight(
    input,
    cycleDates,
    quotaByStaff,
    fixedByStaff,
    maxOffParams,
    maxOffScope,
  );
  if (!preflight.ok) {
    return infeasibleResult(preflight.messageTh);
  }

  const totalSupply = [...quotaByStaff.values()].reduce((sum, quota) => sum + quota, 0);
  if (totalSupply === 0 && fixedCells.length === 0) {
    return {
      feasible: true,
      plannedNonWorkingDays: [],
      totalCost: 0,
      solverVersion: SOLVER_VERSION,
    };
  }

  const assignment = assignDayOffsSequentially({
    input,
    cycleDates,
    quotaByStaff,
    fixedByStaff,
    historicalByStaff,
    requestKeys,
    maxOffParams,
    maxOffScope,
    minWeekendDaysOff,
    costWeights,
  });

  if (!assignment.feasible) {
    return infeasibleResult(assignment.messageTh);
  }

  const planned = extractPlannedDays({
    input,
    cycleDates,
    assignedByStaff: assignment.assignedByStaff,
    fixedCells,
    requestKeys,
    fixedByStaff,
  });

  return {
    feasible: true,
    plannedNonWorkingDays: planned,
    totalCost: assignment.totalCost,
    solverVersion: SOLVER_VERSION,
  };
}

/** จัดวันหยุดแบบ global greedy — อัปเดต priorDates และ capacity หลังทุก assign */
function assignDayOffsSequentially(args: {
  input: DayOffPlanInput;
  cycleDates: readonly string[];
  quotaByStaff: ReadonlyMap<string, number>;
  fixedByStaff: ReadonlyMap<string, readonly FixedOffCell[]>;
  historicalByStaff: ReadonlyMap<string, readonly string[]>;
  requestKeys: ReadonlySet<string>;
  maxOffParams: MaxStaffOffParams;
  maxOffScope: "GROUP" | "ORG";
  minWeekendDaysOff: number;
  costWeights: DayOffCostWeights;
}):
  | { feasible: true; assignedByStaff: ReadonlyMap<string, readonly string[]>; totalCost: number }
  | { feasible: false; messageTh: string } {
  const sortedStaff = [...args.input.staff].sort((left, right) => left.id.localeCompare(right.id));
  const cycleDays = args.cycleDates.length;
  const remainingQuota = new Map<string, number>();
  const assignedByStaff = new Map<string, string[]>();
  const remainingCapacity = initRemainingCapacity({
    input: args.input,
    cycleDates: args.cycleDates,
    fixedByStaff: args.fixedByStaff,
    maxOffParams: args.maxOffParams,
    maxOffScope: args.maxOffScope,
  });

  for (const member of sortedStaff) {
    const fixedCount = args.fixedByStaff.get(member.id)?.length ?? 0;
    const quota = args.quotaByStaff.get(member.id) ?? 0;
    remainingQuota.set(member.id, quota - fixedCount);
    assignedByStaff.set(member.id, []);
  }

  let totalCost = 0;

  while (true) {
    const staffWithQuota = sortedStaff.filter((member) => (remainingQuota.get(member.id) ?? 0) > 0);
    if (staffWithQuota.length === 0) {
      break;
    }

    const candidates: AssignCandidate[] = [];

    for (const member of staffWithQuota) {
      const staffId = member.id;
      const quota = args.quotaByStaff.get(staffId) ?? 0;
      const fixedDates = args.fixedByStaff.get(staffId)?.map((cell) => cell.localDate) ?? [];
      const assignedDates = assignedByStaff.get(staffId) ?? [];
      const selectedDates = [...fixedDates, ...assignedDates];

      for (const date of args.cycleDates) {
        if (fixedDates.includes(date) || assignedDates.includes(date)) {
          continue;
        }
        if (isStaffBlockedOnDate(args.input, staffId, date)) {
          continue;
        }

        const scopeKey = resolveScopeKey(member, args.maxOffScope);
        const capacityKey = buildCapacityKey(date, scopeKey);
        const remaining = remainingCapacity.get(capacityKey);
        if (remaining !== undefined && remaining <= 0) {
          continue;
        }

        const cost = computeStaffDayCost({
          staffId,
          localDate: date,
          quota,
          cycleDays,
          minWeekendDaysOff: args.minWeekendDaysOff,
          fixedDates: selectedDates,
          historicalDates: args.historicalByStaff.get(staffId) ?? [],
          requestKeys: args.requestKeys,
          holidayDates: args.input.holidayDates,
          costWeights: args.costWeights,
        });

        candidates.push({ staffId, localDate: date, cost });
      }
    }

    if (candidates.length === 0) {
      const pendingStaff = staffWithQuota
        .map((member) => member.id)
        .filter((staffId) => (remainingQuota.get(staffId) ?? 0) > 0)
        .sort((left, right) => left.localeCompare(right));
      return {
        feasible: false,
        messageTh: `จัดวันหยุดไม่ครบโควตา — staff ${pendingStaff.join(", ")}`,
      };
    }

    candidates.sort((left, right) => {
      if (left.cost !== right.cost) {
        return left.cost - right.cost;
      }
      const staffCompare = left.staffId.localeCompare(right.staffId);
      if (staffCompare !== 0) {
        return staffCompare;
      }
      return left.localDate.localeCompare(right.localDate);
    });

    const best = candidates[0];
    totalCost += best.cost;

    const nextAssigned = [...(assignedByStaff.get(best.staffId) ?? []), best.localDate];
    assignedByStaff.set(best.staffId, nextAssigned);
    remainingQuota.set(best.staffId, (remainingQuota.get(best.staffId) ?? 0) - 1);

    const member = sortedStaff.find((entry) => entry.id === best.staffId);
    if (member) {
      const scopeKey = resolveScopeKey(member, args.maxOffScope);
      const capacityKey = buildCapacityKey(best.localDate, scopeKey);
      const remaining = remainingCapacity.get(capacityKey);
      if (remaining !== undefined) {
        remainingCapacity.set(capacityKey, remaining - 1);
      }
    }
  }

  return { feasible: true, assignedByStaff, totalCost };
}

/** สร้าง capacity คงเหลือต่อวัน×scope หลังหัก fixed off */
function initRemainingCapacity(args: {
  input: DayOffPlanInput;
  cycleDates: readonly string[];
  fixedByStaff: ReadonlyMap<string, readonly FixedOffCell[]>;
  maxOffParams: MaxStaffOffParams;
  maxOffScope: "GROUP" | "ORG";
}): Map<string, number> {
  const remainingCapacity = new Map<string, number>();
  const scopeKeysByDate = buildScopeKeysByDate(args.input.staff, args.maxOffScope, args.cycleDates);

  for (const date of args.cycleDates) {
    const dayType = resolveDayType(date, args.input.holidayDates);
    const maxOff = resolveMaxOffForDayType(dayType, args.maxOffParams);
    if (maxOff === undefined) {
      continue;
    }

    for (const scopeKey of scopeKeysByDate.get(date) ?? []) {
      const fixedCount = countFixedOffInScope(
        args.input.staff,
        args.fixedByStaff,
        date,
        scopeKey,
        args.maxOffScope,
      );
      remainingCapacity.set(buildCapacityKey(date, scopeKey), maxOff - fixedCount);
    }
  }

  return remainingCapacity;
}

/** คีย์ capacity ต่อวัน×scope */
function buildCapacityKey(localDate: string, scopeKey: string): string {
  return `${localDate}::${scopeKey}`;
}

/** นับ fixed off ใน scope ของวันนั้น */
function countFixedOffInScope(
  staff: readonly StaffSnapshot[],
  fixedByStaff: ReadonlyMap<string, readonly FixedOffCell[]>,
  date: string,
  scopeKey: string,
  scope: "GROUP" | "ORG",
): number {
  let count = 0;

  for (const member of staff) {
    if (resolveScopeKey(member, scope) !== scopeKey) {
      continue;
    }
    const fixedOnDate = fixedByStaff.get(member.id)?.some((cell) => cell.localDate === date);
    if (fixedOnDate) {
      count += 1;
    }
  }

  return count;
}

/** รวมน้ำหนักต้นทุน — rule weight ลดต้นทุนคำขอ */
function mergeCostWeights(
  overrides: Partial<DayOffCostWeights> | undefined,
  quotaRule: RuleInstanceSnapshot,
  maxOffRule: RuleInstanceSnapshot | undefined,
): DayOffCostWeights {
  const requestWeight = Math.max(
    0,
    Math.round((quotaRule.weight ?? DEFAULT_COST_WEIGHTS.request) * 100),
  );
  const gapWeight = Math.max(0, Math.round((maxOffRule?.weight ?? DEFAULT_COST_WEIGHTS.gap) * 100));

  return {
    base: overrides?.base ?? DEFAULT_COST_WEIGHTS.base,
    request:
      overrides?.request ?? (requestWeight > 0 ? requestWeight : DEFAULT_COST_WEIGHTS.request),
    gap: overrides?.gap ?? (gapWeight > 0 ? gapWeight : DEFAULT_COST_WEIGHTS.gap),
    weekend: overrides?.weekend ?? DEFAULT_COST_WEIGHTS.weekend,
  };
}

/** หา rule instance ที่เปิดใช้ */
function findEnabledRule(
  rules: readonly RuleInstanceSnapshot[],
  templateId: string,
): RuleInstanceSnapshot | undefined {
  return rules.find((rule) => rule.enabled && rule.ruleTemplateId === templateId);
}

/** คำนวณโควตาวันหยุดต่อคน */
function resolveStaffQuota(
  cycleStartDate: string,
  cycleEndDate: string,
  params: DayOffQuotaParams,
): number {
  if (params.daysOffPerCycle !== undefined) {
    return params.daysOffPerCycle;
  }
  if (params.daysOffPerWeek !== undefined) {
    const dayCount = eachDateInRange(cycleStartDate, cycleEndDate).length;
    const weeks = Math.max(1, Math.ceil(dayCount / 7));
    return Math.round(params.daysOffPerWeek * weeks);
  }
  return 0;
}

/** ตรวจเงื่อนไขก่อน solve */
function validatePreflight(
  input: DayOffPlanInput,
  cycleDates: readonly string[],
  quotaByStaff: ReadonlyMap<string, number>,
  fixedByStaff: ReadonlyMap<string, readonly FixedOffCell[]>,
  maxOffParams: MaxStaffOffParams,
  maxOffScope: "GROUP" | "ORG",
): { ok: true } | { ok: false; messageTh: string } {
  for (const member of input.staff) {
    const quota = quotaByStaff.get(member.id) ?? 0;
    const fixedCount = fixedByStaff.get(member.id)?.length ?? 0;
    if (fixedCount > quota) {
      return {
        ok: false,
        messageTh: `staff ${member.id} มีวันหยุดคงที่ ${fixedCount} วัน เกินโควตา ${quota} วัน`,
      };
    }
  }

  for (const date of cycleDates) {
    const dayType = resolveDayType(date, input.holidayDates);
    const maxOff = resolveMaxOffForDayType(dayType, maxOffParams);
    if (maxOff === undefined) {
      continue;
    }

    const offByScope = countFixedOffByScope(input.staff, fixedByStaff, date, maxOffScope);
    for (const [scopeKey, staffIds] of offByScope) {
      if (staffIds.length > maxOff) {
        return {
          ok: false,
          messageTh: `วันที่ ${date} (${scopeKey}) มีวันหยุดคงที่ ${staffIds.length} คน เกินเพดาน ${maxOff} คน`,
        };
      }
    }
  }

  return { ok: true };
}

/** เพดานคนหยุดตามประเภทวัน */
function resolveMaxOffForDayType(
  dayType: "WEEKDAY" | "WEEKEND" | "HOLIDAY",
  params: MaxStaffOffParams,
): number | undefined {
  switch (dayType) {
    case "HOLIDAY":
      return params.maxOffHoliday ?? params.maxOffWeekend ?? params.maxOffWeekday;
    case "WEEKEND":
      return params.maxOffWeekend ?? params.maxOffWeekday;
    case "WEEKDAY":
      return params.maxOffWeekday;
    default: {
      const exhaustive: never = dayType;
      return exhaustive;
    }
  }
}

/** นับวันหยุดคงที่ต่อ scope */
function countFixedOffByScope(
  staff: readonly StaffSnapshot[],
  fixedByStaff: ReadonlyMap<string, readonly FixedOffCell[]>,
  date: string,
  scope: "GROUP" | "ORG",
): ReadonlyMap<string, readonly string[]> {
  const counts = new Map<string, string[]>();

  for (const member of staff) {
    const fixedOnDate = fixedByStaff.get(member.id)?.some((cell) => cell.localDate === date);
    if (!fixedOnDate) {
      continue;
    }

    const key = resolveScopeKey(member, scope);
    const list = counts.get(key) ?? [];
    list.push(member.id);
    counts.set(key, list);
  }

  return counts;
}

/** คีย์ scope สำหรับ MAX_STAFF_OFF */
function resolveScopeKey(staff: StaffSnapshot, scope: "GROUP" | "ORG"): string {
  return scope === "GROUP" ? (staff.staffGroupId ?? "__ungrouped__") : "__org__";
}

/** รวบรวมวันหยุดคงที่ — blocksScheduling + planned locked */
function collectFixedOffCells(
  input: DayOffPlanInput,
  cycleDates: readonly string[],
): readonly FixedOffCell[] {
  const cells: FixedOffCell[] = [];
  const cycleDateSet = new Set(cycleDates);

  for (const planned of input.plannedNonWorkingDays ?? []) {
    if (!cycleDateSet.has(planned.localDate)) {
      continue;
    }
    if (planned.locked) {
      cells.push({
        staffId: planned.staffId,
        localDate: planned.localDate,
        locked: true,
        source: inferPlannedSource(planned, input),
      });
      continue;
    }
    if (planned.blocksScheduling) {
      const source = inferPlannedSource(planned, input);
      if (source === "QUOTA") {
        continue;
      }
      cells.push({
        staffId: planned.staffId,
        localDate: planned.localDate,
        locked: false,
        source,
      });
    }
  }

  return dedupeFixedCells(cells);
}

/** อนุมาน source จาก planned ที่มีอยู่ */
function inferPlannedSource(
  planned: PlannedNonWorkingDaySnapshot,
  input: DayOffPlanInput,
): PlannedNonWorkingDaySource {
  if (
    planned.source === "REQUEST" ||
    planned.source === "MANUAL" ||
    planned.source === "QUOTA"
  ) {
    return planned.source;
  }

  const requested = (input.dayOffRequests ?? []).some(
    (entry) => entry.staffId === planned.staffId && entry.localDate === planned.localDate,
  );
  if (requested) {
    return "REQUEST";
  }
  if (planned.locked) {
    return "MANUAL";
  }
  return "QUOTA";
}

/** ตัดซ้ำ staff×date */
function dedupeFixedCells(cells: readonly FixedOffCell[]): readonly FixedOffCell[] {
  const seen = new Set<string>();
  const unique: FixedOffCell[] = [];

  for (const cell of cells) {
    const key = `${cell.staffId}::${cell.localDate}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(cell);
  }

  return unique;
}

/** จัดกลุ่ม fixed off ต่อ staff */
function groupFixedByStaff(
  cells: readonly FixedOffCell[],
): ReadonlyMap<string, readonly FixedOffCell[]> {
  const groups = new Map<string, FixedOffCell[]>();
  for (const cell of cells) {
    const list = groups.get(cell.staffId) ?? [];
    list.push(cell);
    groups.set(cell.staffId, list);
  }
  return groups;
}

/** จัดกลุ่มวันหยุดย้อนหลังต่อ staff */
function groupHistoricalOffByStaff(
  rows: readonly HistoricalOffDate[],
): ReadonlyMap<string, readonly string[]> {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const list = groups.get(row.staffId) ?? [];
    list.push(row.localDate);
    groups.set(row.staffId, list);
  }
  return groups;
}

/** สร้าง key คำขอวันหยุด */
function buildRequestKeySet(
  requests: readonly { staffId: string; localDate: string }[],
): ReadonlySet<string> {
  return new Set(requests.map((entry) => `${entry.staffId}::${entry.localDate}`));
}

/** รายการ scope key ต่อวัน */
function buildScopeKeysByDate(
  staff: readonly StaffSnapshot[],
  scope: "GROUP" | "ORG",
  cycleDates: readonly string[],
): ReadonlyMap<string, readonly string[]> {
  const scopeKeys =
    scope === "ORG"
      ? ["__org__"]
      : [...new Set(staff.map((member) => member.staffGroupId ?? "__ungrouped__"))].sort((a, b) =>
          a.localeCompare(b),
        );

  return new Map(cycleDates.map((date) => [date, scopeKeys]));
}

/** ตรวจว่า staff ไม่สามารถหยุดในวันนั้น — มี assignment ทำงาน */
function isStaffBlockedOnDate(input: DayOffPlanInput, staffId: string, date: string): boolean {
  const assignments = input.assignments ?? [];
  if (assignments.length === 0) {
    return false;
  }

  const shiftCodeById = new Map((input.shiftCodes ?? []).map((code) => [code.id, code]));
  return assignments.some(
    (assignment) =>
      assignment.staffId === staffId &&
      assignment.scheduleDate === date &&
      isWorkingAssignment(shiftCodeById, assignment),
  );
}

/** คำนวณต้นทุน arc staff→day */
function computeStaffDayCost(args: {
  staffId: string;
  localDate: string;
  quota: number;
  cycleDays: number;
  minWeekendDaysOff: number;
  fixedDates: readonly string[];
  historicalDates: readonly string[];
  requestKeys: ReadonlySet<string>;
  holidayDates: readonly string[];
  costWeights: DayOffCostWeights;
}): number {
  let cost = args.costWeights.base;

  const requestKey = `${args.staffId}::${args.localDate}`;
  if (args.requestKeys.has(requestKey)) {
    cost -= args.costWeights.request;
  }

  cost += gapCost({
    localDate: args.localDate,
    quota: args.quota,
    priorDates: [...args.historicalDates, ...args.fixedDates],
    gapWeight: args.costWeights.gap,
    cycleDays: args.cycleDays,
  });

  cost += weekendPreferenceCost({
    staffId: args.staffId,
    localDate: args.localDate,
    minWeekendDaysOff: args.minWeekendDaysOff,
    fixedDates: args.fixedDates,
    holidayDates: args.holidayDates,
    weekendWeight: args.costWeights.weekend,
  });

  return Math.max(0, cost);
}

/** ต้นทุนระยะห่างจากวันหยุดครั้งก่อน */
function gapCost(args: {
  localDate: string;
  quota: number;
  priorDates: readonly string[];
  gapWeight: number;
  cycleDays: number;
}): number {
  if (args.quota <= 0) {
    return 0;
  }

  const priorBefore = args.priorDates
    .filter((date) => date < args.localDate)
    .sort((left, right) => left.localeCompare(right));
  const lastOff = priorBefore.at(-1);
  if (!lastOff) {
    return 0;
  }

  const daysSince = daysBetween(lastOff, args.localDate);
  const idealGap = Math.max(1, Math.floor(args.cycleDays / Math.max(1, args.quota)));
  if (daysSince >= idealGap) {
    return 0;
  }

  return args.gapWeight * (idealGap - daysSince);
}

/** ต้นทุนเชิญให้เลือกวันสุดสัปดาห์เมื่อยังขาดโควตา weekend */
function weekendPreferenceCost(args: {
  staffId: string;
  localDate: string;
  minWeekendDaysOff: number;
  fixedDates: readonly string[];
  holidayDates: readonly string[];
  weekendWeight: number;
}): number {
  if (args.minWeekendDaysOff <= 0) {
    return 0;
  }

  const dayType = resolveDayType(args.localDate, args.holidayDates);
  const weekendFixedCount = args.fixedDates.filter(
    (date) => resolveDayType(date, args.holidayDates) === "WEEKEND",
  ).length;
  const weekendDeficit = Math.max(0, args.minWeekendDaysOff - weekendFixedCount);

  if (weekendDeficit <= 0) {
    return 0;
  }

  if (dayType === "WEEKEND") {
    return -Math.floor(args.weekendWeight / 2);
  }

  return args.weekendWeight;
}

/** จำนวนวันระหว่างสองวัน (local date) */
function daysBetween(startDate: string, endDate: string): number {
  const start = Date.parse(`${startDate}T12:00:00Z`);
  const end = Date.parse(`${endDate}T12:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

/** แปลง assignment เป็นผล PlannedNonWorkingDay */
function extractPlannedDays(args: {
  input: DayOffPlanInput;
  cycleDates: readonly string[];
  assignedByStaff: ReadonlyMap<string, readonly string[]>;
  fixedCells: readonly FixedOffCell[];
  requestKeys: ReadonlySet<string>;
  fixedByStaff: ReadonlyMap<string, readonly FixedOffCell[]>;
}): readonly PlannedNonWorkingDayPlan[] {
  const results: PlannedNonWorkingDayPlan[] = [];

  for (const cell of args.fixedCells) {
    results.push({
      staffId: cell.staffId,
      localDate: cell.localDate,
      nonWorkingDayKindId: args.input.nonWorkingDayKindId,
      source: cell.source ?? "MANUAL",
      locked: cell.locked,
    });
  }

  const sortedStaff = [...args.input.staff].sort((left, right) => left.id.localeCompare(right.id));

  for (const member of sortedStaff) {
    for (const date of args.assignedByStaff.get(member.id) ?? []) {
      const key = `${member.id}::${date}`;

      const alreadyFixed = args.fixedByStaff
        .get(member.id)
        ?.some((cell) => cell.localDate === date);
      if (alreadyFixed) {
        continue;
      }

      results.push({
        staffId: member.id,
        localDate: date,
        nonWorkingDayKindId: args.input.nonWorkingDayKindId,
        source: args.requestKeys.has(key) ? "REQUEST" : "QUOTA",
        locked: false,
      });
    }
  }

  return results.sort((left, right) => {
    const staffCompare = left.staffId.localeCompare(right.staffId);
    if (staffCompare !== 0) {
      return staffCompare;
    }
    return left.localDate.localeCompare(right.localDate);
  });
}

/** คืนผล infeasible */
function infeasibleResult(messageTh: string): DayOffPlanResult {
  return {
    feasible: false,
    plannedNonWorkingDays: [],
    totalCost: 0,
    solverVersion: SOLVER_VERSION,
    messageTh,
  };
}
