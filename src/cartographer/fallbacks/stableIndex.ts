/** Deterministic, non-cryptographic bank index from a non-content seed ID. */
export function fallbackStableIndex(seed: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % size;
}
