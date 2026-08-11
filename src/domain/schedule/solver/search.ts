import type { ScheduleAssignment, ScheduleEngineInput } from "@/domain/schedule/types";
import { validateSchedule } from "@/domain/schedule/validate";
import { createDeterministicRng, pickIndex } from "./rng";

const DEFAULT_SEARCH_ITERATIONS = 200;

/** local search — สลับ staff ระหว่าง assignment เพื่อลด soft score */
export function localSearchImprove(
  input: ScheduleEngineInput,
  assignments: readonly ScheduleAssignment[],
  randomSeed: string,
  maxIterations: number = DEFAULT_SEARCH_ITERATIONS,
): { assignments: readonly ScheduleAssignment[]; iterations: number } {
  const rng = createDeterministicRng(randomSeed);
  let current = [...assignments];
  let currentValidation = validateSchedule({ ...input, assignments: current });
  let iterations = 0;

  if (current.length < 2) {
    return { assignments: current, iterations: 0 };
  }

  for (let step = 0; step < maxIterations; step += 1) {
    iterations += 1;
    const leftIndex = pickIndex(current.length, rng);
    let rightIndex = pickIndex(current.length, rng);
    if (rightIndex === leftIndex) {
      rightIndex = (rightIndex + 1) % current.length;
    }

    const left = current[leftIndex];
    const right = current[rightIndex];
    const swapped = current.map((item, index) => {
      if (index === leftIndex) {
        return { ...right, id: left.id };
      }
      if (index === rightIndex) {
        return { ...left, id: right.id };
      }
      return item;
    });

    const nextValidation = validateSchedule({ ...input, assignments: swapped });
    if (!nextValidation.isValid) {
      continue;
    }

    if (nextValidation.softScore < currentValidation.softScore) {
      current = swapped;
      currentValidation = nextValidation;
    }
  }

  return { assignments: current, iterations };
}
