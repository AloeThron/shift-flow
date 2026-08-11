/** โหนดในกราฟ min-cost flow */
export type FlowNodeId = string;

/** arc ป้อนเข้า solver — ต้นทุนต่อหน่วย flow เป็นจำนวนเต็ม */
export type FlowArcInput = {
  readonly id: string;
  readonly from: FlowNodeId;
  readonly to: FlowNodeId;
  readonly lowerBound?: number;
  readonly upperBound: number;
  readonly cost: number;
};

/** ปัญหา min-cost flow: supply บวก = ปล่อย flow, ลบ = ดูด flow; ผลรวมต้องเป็น 0 */
export type MinCostFlowProblem = {
  readonly nodes: readonly FlowNodeId[];
  readonly arcs: readonly FlowArcInput[];
  readonly supplies: Readonly<Partial<Record<FlowNodeId, number>>>;
};

/** ผลลัพธ์ min-cost flow */
export type MinCostFlowSolution = {
  readonly feasible: boolean;
  readonly totalCost: number;
  readonly flows: Readonly<Partial<Record<string, number>>>;
};

/** ขั้นบันไดต้นทุน convex — แต่ละ segment มี marginal cost คงที่ */
export type MarginalCostSegment = {
  readonly units: number;
  readonly marginalCost: number;
};

/** ขั้นบันได piecewise-linear convex สำหรับแปลงเป็น parallel arcs */
export type ConvexCostLadder = {
  /** ชั่วโมง/หน่วยที่ใช้ไปแล้วก่อนรอบนี้ (carry-over offset) */
  readonly offset: number;
  readonly segments: readonly MarginalCostSegment[];
};
