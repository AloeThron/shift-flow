import type {
  ConvexCostLadder,
  FlowArcInput,
  MarginalCostSegment,
} from "@/domain/optimize/flow/types";

/** scale ต้นทุน: 1 ชั่วโมง = 100 หน่วย (integer determinism) */
export const FLOW_COST_SCALE = 100;

export type BuildToleranceLadderInput = {
  readonly offset: number;
  readonly maxUnits: number;
  readonly toleranceUnits: number;
  readonly baseMarginalCost?: number;
  readonly costIncrementPerUnit?: number;
};

export type ExpandConvexLadderInput = {
  readonly from: string;
  readonly to: string;
  readonly ladder: ConvexCostLadder;
  readonly idPrefix: string;
};

/** คำนวณต้นทุนรวมของหน่วยที่ n หน่วยจากขั้นบันได convex */
export function totalConvexCost(ladder: ConvexCostLadder, units: number): number {
  if (units <= 0) {
    return 0;
  }

  let remaining = units;
  let total = 0;

  for (const segment of ladder.segments) {
    if (remaining <= 0) {
      break;
    }

    const take = Math.min(remaining, segment.units);
    total += take * segment.marginalCost;
    remaining -= take;
  }

  if (remaining > 0) {
    throw new Error("convex ladder capacity ไม่พอสำหรับจำนวนหน่วยที่ขอ");
  }

  return total;
}

/** สร้างขั้นบันได marginal cost แบบเพิ่มเชิงเส้นจาก offset — ใช้ทดสอบและ prototype */
export function buildLinearMarginalLadder(
  offset: number,
  maxUnits: number,
  startMarginalCost: number,
  incrementPerUnit: number,
): ConvexCostLadder {
  if (maxUnits <= 0) {
    return { offset, segments: [] };
  }

  const segments: MarginalCostSegment[] = [];
  for (let unit = 1; unit <= maxUnits; unit += 1) {
    segments.push({
      units: 1,
      marginalCost: startMarginalCost + (offset + unit - 1) * incrementPerUnit,
    });
  }

  return { offset, segments };
}

/** สร้างขั้นบันไดจาก tolerance — แต่ละขั้นกว้าง toleranceUnits หน่วย */
export function buildToleranceLadder(input: BuildToleranceLadderInput): ConvexCostLadder {
  const {
    offset,
    maxUnits,
    toleranceUnits,
    baseMarginalCost = FLOW_COST_SCALE,
    costIncrementPerUnit = FLOW_COST_SCALE,
  } = input;

  if (maxUnits <= 0) {
    return { offset, segments: [] };
  }

  if (toleranceUnits <= 0) {
    throw new Error("toleranceUnits ต้องมากกว่า 0");
  }

  const segments: MarginalCostSegment[] = [];
  let assigned = 0;
  let tier = 0;

  while (assigned < maxUnits) {
    const units = Math.min(toleranceUnits, maxUnits - assigned);
    segments.push({
      units,
      marginalCost: baseMarginalCost + tier * costIncrementPerUnit,
    });
    assigned += units;
    tier += 1;
  }

  return { offset, segments };
}

/** แปลงขั้นบันได convex เป็น parallel arcs ต้นทุนไล่ระดับ (capacity ต่อ segment) */
export function expandConvexLadderToArcs(input: ExpandConvexLadderInput): readonly FlowArcInput[] {
  const { from, to, ladder, idPrefix } = input;

  return ladder.segments.flatMap((segment, index) => {
    if (segment.units <= 0) {
      return [];
    }

    return [
      {
        id: `${idPrefix}::tier-${index}`,
        from,
        to,
        upperBound: segment.units,
        cost: segment.marginalCost,
      } satisfies FlowArcInput,
    ];
  });
}

/** รวม capacity สูงสุดของขั้นบันได */
export function convexLadderCapacity(ladder: ConvexCostLadder): number {
  return ladder.segments.reduce((sum, segment) => sum + segment.units, 0);
}
