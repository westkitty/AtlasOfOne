import type { RankedMemory } from './retrieval';

/**
 * N03 explicit memory budget (section 14.3: relevantAdventureMemories: 8).
 *
 * Selection walks the ranked list in order and takes a card only if it fits
 * both the remaining item slots and the remaining character budget. A card
 * that does not fit is skipped (never truncated), so the output is always a
 * subset of whole cards and never exceeds either limit.
 */

export const ADVENTURE_MEMORY_HARD_MAX_ITEMS = 8;
export const ADVENTURE_MEMORY_HARD_MAX_CHARS = 2400;

export const DEFAULT_ADVENTURE_MEMORY_BUDGET = Object.freeze({
  maxItems: ADVENTURE_MEMORY_HARD_MAX_ITEMS,
  maxChars: 1600
});

export interface AdventureMemoryBudget {
  maxItems: number;
  maxChars: number;
}

export interface BudgetedMemorySelection {
  selected: readonly RankedMemory[];
  omittedIds: readonly string[];
  usedChars: number;
  budget: AdventureMemoryBudget;
}

export function memoryCharCost(ranked: RankedMemory): number {
  return ranked.memory.summary.length;
}

function requireBudget(budget: AdventureMemoryBudget): AdventureMemoryBudget {
  const { maxItems, maxChars } = budget;
  if (!Number.isInteger(maxItems) || maxItems < 0) throw new Error('maxItems must be a non-negative integer.');
  if (!Number.isInteger(maxChars) || maxChars < 0) throw new Error('maxChars must be a non-negative integer.');
  if (maxItems > ADVENTURE_MEMORY_HARD_MAX_ITEMS) {
    throw new Error(`maxItems exceeds the hard cap of ${ADVENTURE_MEMORY_HARD_MAX_ITEMS}.`);
  }
  if (maxChars > ADVENTURE_MEMORY_HARD_MAX_CHARS) {
    throw new Error(`maxChars exceeds the hard cap of ${ADVENTURE_MEMORY_HARD_MAX_CHARS}.`);
  }
  return { maxItems, maxChars };
}

export function selectMemoriesWithinBudget(
  ranked: readonly RankedMemory[],
  budget: AdventureMemoryBudget = DEFAULT_ADVENTURE_MEMORY_BUDGET
): BudgetedMemorySelection {
  const valid = requireBudget(budget);
  const selected: RankedMemory[] = [];
  const omittedIds: string[] = [];
  const seen = new Set<string>();
  let usedChars = 0;

  for (const item of ranked) {
    if (seen.has(item.memory.id)) continue;
    seen.add(item.memory.id);
    const cost = memoryCharCost(item);
    if (selected.length < valid.maxItems && usedChars + cost <= valid.maxChars) {
      selected.push(item);
      usedChars += cost;
    } else {
      omittedIds.push(item.memory.id);
    }
  }

  return { selected, omittedIds, usedChars, budget: valid };
}
