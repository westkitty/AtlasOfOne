import { describe, expect, it } from 'vitest';
import {
  ADVENTURE_MEMORY_HARD_MAX_CHARS,
  ADVENTURE_MEMORY_HARD_MAX_ITEMS,
  DEFAULT_ADVENTURE_MEMORY_BUDGET,
  selectMemoriesWithinBudget
} from '../../../src/adventure/memory/budget';
import { retrieveAdventureMemories, type RankedMemory } from '../../../src/adventure/memory/retrieval';
import { asGated, gatedMem } from './fixtures';

const ranked = (id: string, length: number, score = 2): RankedMemory => ({
  memory: gatedMem({ id, summary: 'x'.repeat(length) }), score, matchedEntityIds: [], matchedTerms: []
});

describe('N03 bounded memory selection', () => {
  it('never exceeds the item cap even with a huge candidate pool', () => {
    const pool = Array.from({ length: 500 }, (_, i) =>
      gatedMem({ id: `m${String(i).padStart(3, '0')}`, summary: 'short', triggerTerms: ['ferry'] }));
    const selection = selectMemoriesWithinBudget(retrieveAdventureMemories(pool, { text: 'ferry' }));
    expect(selection.selected).toHaveLength(DEFAULT_ADVENTURE_MEMORY_BUDGET.maxItems);
    expect(selection.omittedIds).toHaveLength(492);
    expect(selection.selected.map((s) => s.memory.id))
      .toEqual(['m000', 'm001', 'm002', 'm003', 'm004', 'm005', 'm006', 'm007']);
  });

  it('never exceeds the char cap and skips (never truncates) oversized cards', () => {
    const selection = selectMemoriesWithinBudget(
      [ranked('a', 150), ranked('big', 280), ranked('b', 100), ranked('c', 60)],
      { maxItems: 8, maxChars: 300 }
    );
    expect(selection.selected.map((s) => s.memory.id)).toEqual(['a', 'b']);
    expect(selection.selected.map((s) => s.memory.summary.length)).toEqual([150, 100]);
    expect(selection.omittedIds).toEqual(['big', 'c']);
    expect(selection.usedChars).toBe(250);
  });

  it('max-size: 8 max-length cards fit the hard caps', () => {
    const pool = Array.from({ length: 20 }, (_, i) => ranked(`m${i}`, 280));
    const selection = selectMemoriesWithinBudget(pool, {
      maxItems: ADVENTURE_MEMORY_HARD_MAX_ITEMS, maxChars: ADVENTURE_MEMORY_HARD_MAX_CHARS
    });
    expect(selection.selected).toHaveLength(8);
    expect(selection.usedChars).toBe(2240);
    expect(selection.usedChars).toBeLessThanOrEqual(ADVENTURE_MEMORY_HARD_MAX_CHARS);
  });

  it('rejects budgets above hard caps or malformed', () => {
    expect(() => selectMemoriesWithinBudget([], { maxItems: 9, maxChars: 100 })).toThrow();
    expect(() => selectMemoriesWithinBudget([], { maxItems: 8, maxChars: ADVENTURE_MEMORY_HARD_MAX_CHARS + 1 })).toThrow();
    expect(() => selectMemoriesWithinBudget([], { maxItems: -1, maxChars: 100 })).toThrow();
    expect(() => selectMemoriesWithinBudget([], { maxItems: 1.5, maxChars: 100 })).toThrow();
    expect(() => selectMemoriesWithinBudget([], { maxItems: 8, maxChars: Number.NaN })).toThrow();
  });

  it('zero budget selects nothing; duplicate ids count once', () => {
    expect(selectMemoriesWithinBudget([ranked('a', 5)], { maxItems: 0, maxChars: 100 }).selected).toEqual([]);
    const dup = selectMemoriesWithinBudget([ranked('a', 5), ranked('a', 5)], { maxItems: 8, maxChars: 100 });
    expect(dup.selected).toHaveLength(1);
    expect(dup.omittedIds).toEqual([]);
  });
});
