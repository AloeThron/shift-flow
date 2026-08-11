/** PRNG แบบ deterministic จาก seed string — mulberry32 */
export function createDeterministicRng(seed: string): () => number {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash << 5) - hash + seed.charCodeAt(index);
    hash |= 0;
  }

  let state = hash >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** เลือก index แบบ deterministic จาก rng */
export function pickIndex(length: number, rng: () => number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.floor(rng() * length);
}

/** สลับสอง element ใน array แบบ immutable */
export function swapAt<T>(
  items: readonly T[],
  leftIndex: number,
  rightIndex: number,
): readonly T[] {
  if (leftIndex === rightIndex) {
    return items;
  }
  const copy = [...items];
  const temp = copy[leftIndex];
  copy[leftIndex] = copy[rightIndex];
  copy[rightIndex] = temp;
  return copy;
}
