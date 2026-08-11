import type {
  FlowArcInput,
  FlowNodeId,
  MinCostFlowProblem,
  MinCostFlowSolution,
} from "@/domain/optimize/flow/types";

const SUPER_SOURCE = "__mcf_super_source__";
const SUPER_SINK = "__mcf_super_sink__";

type ResidualEdge = {
  readonly arcId: string;
  readonly to: FlowNodeId;
  readonly capacity: number;
  readonly cost: number;
  readonly isReverse: boolean;
};

type LowerBoundTransform = {
  readonly arcs: readonly FlowArcInput[];
  readonly supplies: Readonly<Partial<Record<FlowNodeId, number>>>;
  readonly lowerBoundsByArcId: Readonly<Partial<Record<string, number>>>;
  readonly fixedCost: number;
};

type ShortestPathResult = {
  readonly found: boolean;
  readonly parentNode: Readonly<Partial<Record<FlowNodeId, FlowNodeId>>>;
  readonly parentArcId: Readonly<Partial<Record<FlowNodeId, string>>>;
  readonly distance: Readonly<Partial<Record<FlowNodeId, number>>>;
};

/** min-heap สำหรับ Dijkstra — เรียงด้วย reduced cost */
class MinHeap {
  private readonly items: Array<{ node: FlowNodeId; priority: number }> = [];

  push(node: FlowNodeId, priority: number): void {
    this.items.push({ node, priority });
    this.bubbleUp(this.items.length - 1);
  }

  pop(): { node: FlowNodeId; priority: number } | undefined {
    if (this.items.length === 0) {
      return undefined;
    }

    const top = this.items[0];
    const last = this.items.pop();
    if (last && this.items.length > 0) {
      this.items[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  private bubbleUp(index: number): void {
    let current = index;
    while (current > 0) {
      const parent = Math.floor((current - 1) / 2);
      if (this.items[parent].priority <= this.items[current].priority) {
        break;
      }
      [this.items[parent], this.items[current]] = [this.items[current], this.items[parent]];
      current = parent;
    }
  }

  private bubbleDown(index: number): void {
    let current = index;
    while (true) {
      const left = current * 2 + 1;
      const right = left + 1;
      let smallest = current;

      if (left < this.items.length && this.items[left].priority < this.items[smallest].priority) {
        smallest = left;
      }
      if (right < this.items.length && this.items[right].priority < this.items[smallest].priority) {
        smallest = right;
      }
      if (smallest === current) {
        break;
      }
      [this.items[current], this.items[smallest]] = [this.items[smallest], this.items[current]];
      current = smallest;
    }
  }
}

/** รวม supply ทุกโหนด — ต้องเป็น 0 เพื่อให้ feasible */
function sumSupplies(supplies: Readonly<Partial<Record<FlowNodeId, number>>>): number {
  return Object.values(supplies).reduce<number>((sum, value) => sum + (value ?? 0), 0);
}

/** แปลง lower bound เป็นช่วง capacity + ปรับ supply (ไม่ pre-assign flow) */
function eliminateLowerBounds(problem: MinCostFlowProblem): LowerBoundTransform {
  const supplies: Partial<Record<FlowNodeId, number>> = { ...problem.supplies };
  const arcs: FlowArcInput[] = [];
  const lowerBoundsByArcId: Partial<Record<string, number>> = {};
  let fixedCost = 0;

  for (const arc of problem.arcs) {
    const lowerBound = arc.lowerBound ?? 0;
    if (lowerBound < 0 || lowerBound > arc.upperBound) {
      throw new Error(`arc ${arc.id}: lowerBound ต้องอยู่ระหว่าง 0 ถึง upperBound`);
    }

    if (
      !Number.isInteger(lowerBound) ||
      !Number.isInteger(arc.upperBound) ||
      !Number.isInteger(arc.cost)
    ) {
      throw new Error(`arc ${arc.id}: lowerBound, upperBound และ cost ต้องเป็นจำนวนเต็ม`);
    }

    if (lowerBound > 0) {
      lowerBoundsByArcId[arc.id] = lowerBound;
      fixedCost += lowerBound * arc.cost;
      supplies[arc.from] = (supplies[arc.from] ?? 0) - lowerBound;
      supplies[arc.to] = (supplies[arc.to] ?? 0) + lowerBound;
    }

    const remainingCapacity = arc.upperBound - lowerBound;
    if (remainingCapacity > 0) {
      arcs.push({
        ...arc,
        lowerBound: 0,
        upperBound: remainingCapacity,
      });
    }
  }

  return { arcs, supplies, lowerBoundsByArcId, fixedCost };
}

/** ตัด arc ภายในของ super source/sink ออกจากผลลัพธ์ */
function stripInternalArcFlows(
  flows: Readonly<Partial<Record<string, number>>>,
): Partial<Record<string, number>> {
  return Object.fromEntries(
    Object.entries(flows).filter(
      ([arcId]) => !arcId.startsWith("__supply__") && !arcId.startsWith("__demand__"),
    ),
  );
}

/** รวม flow ที่ solver หาได้กับ lower bound คงที่ */
function mergeLowerBoundFlows(
  flows: Readonly<Partial<Record<string, number>>>,
  lowerBoundsByArcId: Readonly<Partial<Record<string, number>>>,
): Partial<Record<string, number>> {
  const merged = stripInternalArcFlows(flows);

  for (const [arcId, lowerBound] of Object.entries(lowerBoundsByArcId)) {
    if (lowerBound !== undefined && lowerBound > 0) {
      merged[arcId] = (merged[arcId] ?? 0) + lowerBound;
    }
  }

  return merged;
}

/** สร้าง residual adjacency จาก flow ปัจจุบัน */
function buildResidualAdjacency(
  arcs: readonly FlowArcInput[],
  flows: Readonly<Partial<Record<string, number>>>,
): Readonly<Partial<Record<FlowNodeId, readonly ResidualEdge[]>>> {
  const adjacency: Partial<Record<FlowNodeId, ResidualEdge[]>> = {};

  const addEdge = (from: FlowNodeId, edge: ResidualEdge): void => {
    const bucket = adjacency[from] ?? [];
    bucket.push(edge);
    adjacency[from] = bucket;
  };

  for (const arc of arcs) {
    const flow = flows[arc.id] ?? 0;
    const forwardCapacity = arc.upperBound - flow;
    if (forwardCapacity > 0) {
      addEdge(arc.from, {
        arcId: arc.id,
        to: arc.to,
        capacity: forwardCapacity,
        cost: arc.cost,
        isReverse: false,
      });
    }

    if (flow > 0) {
      addEdge(arc.to, {
        arcId: arc.id,
        to: arc.from,
        capacity: flow,
        cost: -arc.cost,
        isReverse: true,
      });
    }
  }

  return adjacency;
}

/** reduced cost ตาม node potentials (Johnson) */
function reducedCost(
  from: FlowNodeId,
  to: FlowNodeId,
  cost: number,
  potentials: Readonly<Partial<Record<FlowNodeId, number>>>,
): number {
  return cost + (potentials[from] ?? 0) - (potentials[to] ?? 0);
}

/** Dijkstra บน residual graph หา shortest path จาก source ไป sink */
function shortestPath(
  adjacency: Readonly<Partial<Record<FlowNodeId, readonly ResidualEdge[]>>>,
  potentials: Readonly<Partial<Record<FlowNodeId, number>>>,
  source: FlowNodeId,
  sink: FlowNodeId,
): ShortestPathResult {
  const distance: Partial<Record<FlowNodeId, number>> = { [source]: 0 };
  const parentNode: Partial<Record<FlowNodeId, FlowNodeId>> = {};
  const parentArcId: Partial<Record<FlowNodeId, string>> = {};
  const heap = new MinHeap();
  heap.push(source, 0);

  while (!heap.isEmpty()) {
    const current = heap.pop();
    if (!current) {
      break;
    }

    const { node, priority } = current;
    if (priority > (distance[node] ?? Number.POSITIVE_INFINITY)) {
      continue;
    }

    const edges = adjacency[node] ?? [];
    for (const edge of edges) {
      const nextDistance = priority + reducedCost(node, edge.to, edge.cost, potentials);
      if (nextDistance < (distance[edge.to] ?? Number.POSITIVE_INFINITY)) {
        distance[edge.to] = nextDistance;
        parentNode[edge.to] = node;
        parentArcId[edge.to] = edge.arcId;
        heap.push(edge.to, nextDistance);
      }
    }
  }

  return {
    found: distance[sink] !== undefined,
    parentNode,
    parentArcId,
    distance,
  };
}

/** หา bottleneck capacity ตามเส้นทาง parent pointers */
function pathBottleneck(
  parentNode: Readonly<Partial<Record<FlowNodeId, FlowNodeId>>>,
  adjacency: Readonly<Partial<Record<FlowNodeId, readonly ResidualEdge[]>>>,
  source: FlowNodeId,
  sink: FlowNodeId,
): number {
  let bottleneck = Number.POSITIVE_INFINITY;
  let node: FlowNodeId | undefined = sink;

  while (node !== undefined && node !== source) {
    const previous: FlowNodeId | undefined = parentNode[node];
    if (!previous) {
      return 0;
    }

    const edges = adjacency[previous] ?? [];
    const edge = edges.find((candidate) => candidate.to === node);
    if (!edge) {
      return 0;
    }

    bottleneck = Math.min(bottleneck, edge.capacity);
    node = previous;
  }

  return Number.isFinite(bottleneck) ? bottleneck : 0;
}

/** augment flow ตาม shortest path */
function augmentAlongPath(
  flows: Partial<Record<string, number>>,
  parentNode: Readonly<Partial<Record<FlowNodeId, FlowNodeId>>>,
  parentArcId: Readonly<Partial<Record<FlowNodeId, string>>>,
  adjacency: Readonly<Partial<Record<FlowNodeId, readonly ResidualEdge[]>>>,
  arcById: Readonly<Partial<Record<string, FlowArcInput>>>,
  source: FlowNodeId,
  sink: FlowNodeId,
  amount: number,
): number {
  if (amount <= 0) {
    return 0;
  }

  let augmentedCost = 0;
  let node: FlowNodeId | undefined = sink;

  while (node !== undefined && node !== source) {
    const previous: FlowNodeId | undefined = parentNode[node];
    const arcId = parentArcId[node];
    if (!previous || !arcId) {
      return 0;
    }

    const edges = adjacency[previous] ?? [];
    const edge = edges.find((candidate) => candidate.to === node && candidate.arcId === arcId);
    if (!edge) {
      return 0;
    }

    const arc = arcById[arcId];
    if (!arc) {
      return 0;
    }

    if (edge.isReverse) {
      const nextFlow = (flows[arcId] ?? 0) - amount;
      if (nextFlow < 0) {
        throw new Error(`flow ติดลบบน arc ${arcId}`);
      }
      flows[arcId] = nextFlow;
      augmentedCost -= amount * arc.cost;
    } else {
      flows[arcId] = (flows[arcId] ?? 0) + amount;
      augmentedCost += amount * arc.cost;
    }

    node = previous;
  }

  return augmentedCost;
}

/** อัปเดต node potentials หลัง shortest path */
function updatePotentials(
  potentials: Partial<Record<FlowNodeId, number>>,
  distance: Readonly<Partial<Record<FlowNodeId, number>>>,
): void {
  for (const [node, dist] of Object.entries(distance)) {
    if (dist !== undefined) {
      potentials[node] = (potentials[node] ?? 0) + dist;
    }
  }
}

/** successive shortest path + node potentials — ต้นทุนจำนวนเต็ม */
function solveWithSuperSourceSink(
  nodes: readonly FlowNodeId[],
  arcs: readonly FlowArcInput[],
  supplies: Readonly<Partial<Record<FlowNodeId, number>>>,
  lowerBoundsByArcId: Readonly<Partial<Record<string, number>>>,
  fixedCost: number,
): MinCostFlowSolution {
  const extendedArcs: FlowArcInput[] = [...arcs];
  const extendedSupplies: Partial<Record<FlowNodeId, number>> = { ...supplies };

  let totalDemand = 0;
  for (const node of nodes) {
    const supply = extendedSupplies[node] ?? 0;
    if (supply > 0) {
      extendedArcs.push({
        id: `__supply__::${node}`,
        from: SUPER_SOURCE,
        to: node,
        upperBound: supply,
        cost: 0,
      });
      totalDemand += supply;
    } else if (supply < 0) {
      extendedArcs.push({
        id: `__demand__::${node}`,
        from: node,
        to: SUPER_SINK,
        upperBound: -supply,
        cost: 0,
      });
    }
  }

  const arcById = Object.fromEntries(extendedArcs.map((arc) => [arc.id, arc])) as Partial<
    Record<string, FlowArcInput>
  >;

  const flows: Partial<Record<string, number>> = {};
  let totalCost = fixedCost;
  const potentials: Partial<Record<FlowNodeId, number>> = {};

  let delivered = 0;

  const maxIterations = extendedArcs.reduce((sum, arc) => sum + arc.upperBound, 0) + 1;

  const buildFailure = (): MinCostFlowSolution => ({
    feasible: false,
    totalCost,
    flows: mergeLowerBoundFlows(flows, lowerBoundsByArcId),
  });

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    if (delivered >= totalDemand) {
      break;
    }

    const adjacency = buildResidualAdjacency(extendedArcs, flows);
    const path = shortestPath(adjacency, potentials, SUPER_SOURCE, SUPER_SINK);
    if (!path.found) {
      return buildFailure();
    }

    const bottleneck = pathBottleneck(path.parentNode, adjacency, SUPER_SOURCE, SUPER_SINK);
    if (bottleneck <= 0) {
      return buildFailure();
    }

    const pushAmount = Math.min(bottleneck, totalDemand - delivered);
    const pathCost = augmentAlongPath(
      flows,
      path.parentNode,
      path.parentArcId,
      adjacency,
      arcById,
      SUPER_SOURCE,
      SUPER_SINK,
      pushAmount,
    );
    totalCost += pathCost;
    delivered += pushAmount;
    updatePotentials(potentials, path.distance);
  }

  const feasible = delivered >= totalDemand;

  return {
    feasible,
    totalCost,
    flows: mergeLowerBoundFlows(flows, lowerBoundsByArcId),
  };
}

/** แก้ min-cost flow — entry point หลัก */
export function solveMinCostFlow(problem: MinCostFlowProblem): MinCostFlowSolution {
  const supplySum = sumSupplies(problem.supplies);
  if (supplySum !== 0) {
    throw new Error(`ผลรวม supply ต้องเป็น 0 (ได้ ${supplySum})`);
  }

  const nodeSet = new Set(problem.nodes);
  for (const arc of problem.arcs) {
    if (!nodeSet.has(arc.from) || !nodeSet.has(arc.to)) {
      throw new Error(`arc ${arc.id} อ้างถึงโหนดที่ไม่ได้ประกาศ`);
    }
    if (arc.upperBound < 0) {
      throw new Error(`arc ${arc.id}: upperBound ต้องไม่ติดลบ`);
    }
    if (!Number.isInteger(arc.upperBound) || !Number.isInteger(arc.cost)) {
      throw new Error(`arc ${arc.id}: upperBound และ cost ต้องเป็นจำนวนเต็ม`);
    }
  }

  const transformed = eliminateLowerBounds(problem);
  return solveWithSuperSourceSink(
    problem.nodes,
    transformed.arcs,
    transformed.supplies,
    transformed.lowerBoundsByArcId,
    transformed.fixedCost,
  );
}

/** คำนวณต้นทุนรวมจาก flow map — ใช้ตรวจสอบใน test */
export function computeFlowCost(
  arcs: readonly FlowArcInput[],
  flows: Readonly<Partial<Record<string, number>>>,
): number {
  return arcs.reduce((sum, arc) => sum + (flows[arc.id] ?? 0) * arc.cost, 0);
}

/** ตรวจ flow conservation รวม lower bound เริ่มต้น */
export function verifyFlowConservation(
  problem: MinCostFlowProblem,
  flows: Readonly<Partial<Record<string, number>>>,
): boolean {
  const balance: Partial<Record<FlowNodeId, number>> = { ...problem.supplies };

  for (const arc of problem.arcs) {
    const flow = flows[arc.id] ?? 0;
    balance[arc.from] = (balance[arc.from] ?? 0) - flow;
    balance[arc.to] = (balance[arc.to] ?? 0) + flow;
  }

  return Object.values(balance).every((value) => value === 0);
}

/** เรียง arc id แบบ deterministic สำหรับ tie-break ใน test/brute force */
export function sortArcsDeterministic(arcs: readonly FlowArcInput[]): readonly FlowArcInput[] {
  return [...arcs].sort((left, right) => left.id.localeCompare(right.id));
}
