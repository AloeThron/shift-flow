import * as fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  buildLinearMarginalLadder,
  buildToleranceLadder,
  computeFlowCost,
  convexLadderCapacity,
  expandConvexLadderToArcs,
  FLOW_COST_SCALE,
  solveMinCostFlow,
  sortArcsDeterministic,
  totalConvexCost,
  verifyFlowConservation,
  type FlowArcInput,
  type MinCostFlowProblem,
  type MinCostFlowSolution,
} from "@/domain/optimize/flow";

/** brute force min-cost flow สำหรับ instance เล็ก — ใช้เทียบ SSP */
function bruteForceMinCostFlow(problem: MinCostFlowProblem): MinCostFlowSolution {
  const arcs = sortArcsDeterministic(problem.arcs);
  const nodes = [...problem.nodes];

  const lowerBounds = Object.fromEntries(arcs.map((arc) => [arc.id, arc.lowerBound ?? 0]));
  const upperBounds = Object.fromEntries(arcs.map((arc) => [arc.id, arc.upperBound]));

  const ranges = arcs.map((arc) => {
    const lower = lowerBounds[arc.id] ?? 0;
    const upper = upperBounds[arc.id] ?? 0;
    return Array.from({ length: upper - lower + 1 }, (_, index) => lower + index);
  });

  let best: MinCostFlowSolution | undefined;

  const visit = (index: number, partialFlows: Partial<Record<string, number>>): void => {
    if (index >= arcs.length) {
      if (!verifyFlowConservation(problem, partialFlows)) {
        return;
      }

      const totalCost = computeFlowCost(arcs, partialFlows);
      if (!best || totalCost < best.totalCost) {
        best = { feasible: true, totalCost, flows: { ...partialFlows } };
      }
      return;
    }

    const arc = arcs[index];
    for (const flow of ranges[index]) {
      visit(index + 1, { ...partialFlows, [arc.id]: flow });
    }
  };

  visit(0, {});

  return best ?? { feasible: false, totalCost: 0, flows: {} };
}

/** สร้างปัญหา transportation เล็กสำหรับ property test */
function buildRandomTransportProblem(seed: {
  supplyA: number;
  supplyB: number;
  costs: readonly number[];
}): MinCostFlowProblem {
  const { supplyA, supplyB, costs } = seed;
  const total = supplyA + supplyB;

  return {
    nodes: ["S", "A", "B", "T"],
    supplies: { S: total, T: -total },
    arcs: [
      { id: "S-A", from: "S", to: "A", upperBound: supplyA, cost: costs[0] ?? 0 },
      { id: "S-B", from: "S", to: "B", upperBound: supplyB, cost: costs[1] ?? 0 },
      { id: "A-T", from: "A", to: "T", upperBound: supplyA, cost: costs[2] ?? 0 },
      { id: "B-T", from: "B", to: "T", upperBound: supplyB, cost: costs[3] ?? 0 },
    ],
  };
}

describe("min-cost flow — unit", () => {
  it("transportation เล็กให้ต้นทุนตรง brute force", () => {
    const problem: MinCostFlowProblem = {
      nodes: ["S", "A", "B", "T"],
      supplies: { S: 2, T: -2 },
      arcs: [
        { id: "S-A", from: "S", to: "A", upperBound: 2, cost: 1 },
        { id: "S-B", from: "S", to: "B", upperBound: 2, cost: 4 },
        { id: "A-T", from: "A", to: "T", upperBound: 2, cost: 2 },
        { id: "B-T", from: "B", to: "T", upperBound: 2, cost: 1 },
      ],
    };

    const expected = bruteForceMinCostFlow(problem);
    const actual = solveMinCostFlow(problem);

    expect(actual.feasible).toBe(true);
    expect(actual.totalCost).toBe(expected.totalCost);
    expect(verifyFlowConservation(problem, actual.flows)).toBe(true);
    expect(actual.totalCost).toBe(6);
  });

  it("parallel arcs เลือกเส้นทูตถูกกว่า", () => {
    const problem: MinCostFlowProblem = {
      nodes: ["S", "M", "T"],
      supplies: { S: 3, T: -3 },
      arcs: [
        { id: "cheap", from: "S", to: "M", upperBound: 1, cost: 1 },
        { id: "mid", from: "S", to: "M", upperBound: 1, cost: 5 },
        { id: "dear", from: "S", to: "M", upperBound: 1, cost: 9 },
        { id: "out", from: "M", to: "T", upperBound: 3, cost: 0 },
      ],
    };

    const actual = solveMinCostFlow(problem);
    const expected = bruteForceMinCostFlow(problem);

    expect(actual.feasible).toBe(true);
    expect(actual.totalCost).toBe(expected.totalCost);
    expect(actual.flows.cheap).toBe(1);
    expect(actual.flows.mid).toBe(1);
    expect(actual.flows.dear).toBe(1);
    expect(actual.totalCost).toBe(15);
  });

  it("รองรับ lower bound บน arc บังคับ", () => {
    const problem: MinCostFlowProblem = {
      nodes: ["S", "A", "T"],
      supplies: { S: 2, T: -2 },
      arcs: [
        { id: "must", from: "S", to: "A", lowerBound: 1, upperBound: 2, cost: 3 },
        { id: "out", from: "A", to: "T", upperBound: 2, cost: 1 },
      ],
    };

    const actual = solveMinCostFlow(problem);
    const expected = bruteForceMinCostFlow(problem);

    expect(actual.feasible).toBe(true);
    expect(actual.totalCost).toBe(expected.totalCost);
    expect(actual.flows.must).toBe(2);
    expect(actual.totalCost).toBe(8);
  });

  it("infeasible เมื่อ capacity ไม่พอ", () => {
    const problem: MinCostFlowProblem = {
      nodes: ["S", "A", "T"],
      supplies: { S: 5, T: -5 },
      arcs: [{ id: "cap", from: "S", to: "A", upperBound: 2, cost: 1 }],
    };

    const actual = solveMinCostFlow(problem);
    expect(actual.feasible).toBe(false);
  });

  it("deterministic — input เดิมได้ผลเดิม", () => {
    const problem: MinCostFlowProblem = {
      nodes: ["S", "A", "B", "C", "T"],
      supplies: { S: 4, T: -4 },
      arcs: [
        { id: "a", from: "S", to: "A", upperBound: 2, cost: 2 },
        { id: "b", from: "S", to: "B", upperBound: 2, cost: 1 },
        { id: "c", from: "A", to: "C", upperBound: 2, cost: 1 },
        { id: "d", from: "B", to: "C", upperBound: 2, cost: 3 },
        { id: "e", from: "C", to: "T", upperBound: 4, cost: 0 },
      ],
    };

    const first = solveMinCostFlow(problem);
    const second = solveMinCostFlow(problem);

    expect(first).toEqual(second);
  });
});

describe("min-cost flow — เทียบ brute force", () => {
  it("instance เล็กสุ่มตรง brute force", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 3 }),
        fc.integer({ min: 0, max: 3 }),
        fc.array(fc.integer({ min: 0, max: 9 }), { minLength: 4, maxLength: 4 }),
        (supplyA, supplyB, costs) => {
          const total = supplyA + supplyB;
          if (total === 0) {
            return true;
          }

          const problem = buildRandomTransportProblem({ supplyA, supplyB, costs });
          const expected = bruteForceMinCostFlow(problem);
          const actual = solveMinCostFlow(problem);

          expect(actual.feasible).toBe(expected.feasible);
          if (expected.feasible) {
            expect(actual.totalCost).toBe(expected.totalCost);
            expect(verifyFlowConservation(problem, actual.flows)).toBe(true);
          }
          return true;
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe("convex cost — parallel arcs", () => {
  it("expand ladder เป็น arcs แล้ว min-cost flow เลือกขั้นถูกก่อน", () => {
    const ladder = buildLinearMarginalLadder(0, 3, 100, 100);
    const convexArcs = expandConvexLadderToArcs({
      from: "staff",
      to: "slot",
      ladder,
      idPrefix: "staff-1",
    });

    const problem: MinCostFlowProblem = {
      nodes: ["S", "staff", "slot", "T"],
      supplies: { S: 2, T: -2 },
      arcs: [
        { id: "in", from: "S", to: "staff", upperBound: 2, cost: 0 },
        ...convexArcs,
        { id: "out", from: "slot", to: "T", upperBound: 2, cost: 0 },
      ],
    };

    const actual = solveMinCostFlow(problem);
    expect(actual.feasible).toBe(true);
    expect(actual.flows["staff-1::tier-0"]).toBe(1);
    expect(actual.flows["staff-1::tier-1"]).toBe(1);
    expect(actual.totalCost).toBe(totalConvexCost(ladder, 2));
  });

  it("buildToleranceLadder ให้ capacity ครบ maxUnits", () => {
    const ladder = buildToleranceLadder({
      offset: 4,
      maxUnits: 10,
      toleranceUnits: 3,
    });

    expect(convexLadderCapacity(ladder)).toBe(10);
    expect(ladder.segments.length).toBe(4);
    expect(ladder.segments[0]?.units).toBe(3);
    expect(ladder.segments[1]?.marginalCost).toBe(FLOW_COST_SCALE * 2);
  });

  it("totalConvexCost เพิ่มตาม convex marginal", () => {
    const ladder = buildToleranceLadder({
      offset: 0,
      maxUnits: 5,
      toleranceUnits: 2,
      baseMarginalCost: 10,
      costIncrementPerUnit: 5,
    });

    expect(totalConvexCost(ladder, 1)).toBe(10);
    expect(totalConvexCost(ladder, 2)).toBe(20);
    expect(totalConvexCost(ladder, 3)).toBe(35);
    expect(totalConvexCost(ladder, 5)).toBe(70);
  });
});

describe("convex + flow integration", () => {
  it("สอง staff แข่ง slot convex — คนที่ได้งานน้อยกว่าถูกกว่า", () => {
    const cheapLadder = buildLinearMarginalLadder(0, 2, 100, 50);
    const dearLadder = buildLinearMarginalLadder(2, 2, 500, 50);

    const cheapArcs = expandConvexLadderToArcs({
      from: "staff-cheap",
      to: "slot",
      ladder: cheapLadder,
      idPrefix: "cheap",
    });
    const dearArcs = expandConvexLadderToArcs({
      from: "staff-dear",
      to: "slot",
      ladder: dearLadder,
      idPrefix: "dear",
    });

    const arcs: FlowArcInput[] = [
      { id: "S-cheap", from: "S", to: "staff-cheap", upperBound: 1, cost: 0 },
      { id: "S-dear", from: "S", to: "staff-dear", upperBound: 1, cost: 0 },
      ...cheapArcs,
      ...dearArcs,
      { id: "slot-T", from: "slot", to: "T", upperBound: 1, cost: 0 },
    ];

    const problem: MinCostFlowProblem = {
      nodes: ["S", "staff-cheap", "staff-dear", "slot", "T"],
      supplies: { S: 1, T: -1 },
      arcs,
    };

    const actual = solveMinCostFlow(problem);
    expect(actual.feasible).toBe(true);
    expect(actual.flows["cheap::tier-0"]).toBe(1);
    expect(actual.flows["dear::tier-0"]).toBeUndefined();
    expect(actual.totalCost).toBe(100);
  });
});
