import { describe, expect, it } from 'vitest';
import { applyAdventureConsequences, deriveAdventureConsequences, templateForSeed } from '../../../src/adventure/consequences/derive';
import { recurringFallbackLine, selectRecurringReferences } from '../../../src/adventure/memory/recurring';
import type { CampaignState } from '../../../src/game/types';
import { privatizeJournalEntry } from '../../../src/journal/privacy';
import { withdrawSliceAdventure } from '../../../src/slice/loop';
import { ACTION_CANARY, CANARY, T, exploreAndStart, playThrough, withJournals, withPureFunRun } from '../consequences/fixtures';

function finish(state: CampaignState, runId: string): CampaignState {
  const done = playThrough(state, runId);
  return applyAdventureConsequences(done, deriveAdventureConsequences(done, runId));
}

describe('N05 recurring NPC/place reference', () => {
  it('second run in the same territory references the first by structural label', () => {
    let state = finish(exploreAndStart(withJournals('journal_1', 'journal_2'), 1, 'identity', 'journal_1'), 'run_1');
    state = exploreAndStart(state, 2, 'identity', 'journal_2');
    const firstTitle = templateForSeed(state.adventureSeeds.find((seed) => seed.id === 'seed_1')!)!.title;

    const refs = selectRecurringReferences(state, { territoryId: 'identity', currentRunId: 'run_2', currentSeedId: 'seed_2' });
    expect(refs.memories.length).toBeGreaterThan(0);
    expect(refs.memories.every((entry) => entry.memory.sourceIds.includes('run_1'))).toBe(true);
    expect(refs.fallbackLine).toContain(`"${firstTitle}"`);
    const text = JSON.stringify(refs);
    expect(text).not.toContain(CANARY);
    expect(text).not.toContain(ACTION_CANARY);
  });

  it('a run never recurs into itself, and other territories do not leak in', () => {
    const state = finish(exploreAndStart(withJournals('journal_1'), 1, 'identity'), 'run_1');
    expect(selectRecurringReferences(state, { territoryId: 'identity', currentRunId: 'run_1' })).toEqual({ memories: [], fallbackLine: null });
    expect(selectRecurringReferences(state, { territoryId: 'fears' }).memories).toEqual([]);
  });

  it('PRIVATE-sourced memory never recurs; a public sibling still does', () => {
    let state = finish(exploreAndStart(withJournals('journal_secret'), 1, 'identity', 'journal_secret'), 'run_1');
    const fun = withdrawSliceAdventure(withPureFunRun(state, 2, 'identity'), { runId: 'run_2', now: T(20) });
    state = applyAdventureConsequences(fun, deriveAdventureConsequences(fun, 'run_2'));
    state = privatizeJournalEntry(state, 'journal_secret', T(21));

    const refs = selectRecurringReferences(state, { territoryId: 'identity' });
    expect(refs.memories.map((entry) => entry.memory.sourceIds)).toEqual([['run_2', 'seed_2']]);
    expect(refs.fallbackLine).toBe('A familiar face from "The Great Hat Heist" is somewhere nearby.');
    expect(refs.memories.some((entry) => entry.memory.sourceIds.includes('run_1'))).toBe(false);
  });

  it('honours the N03 budget and prefers characters/places', () => {
    let state = withJournals();
    for (const n of [1, 2, 3]) {
      const s = withdrawSliceAdventure(withPureFunRun(state, n, 'identity'), { runId: `run_${n}`, now: T(10 + n) });
      state = applyAdventureConsequences(s, deriveAdventureConsequences(s, `run_${n}`, { exitCause: 'paused-for-later' }));
    }
    const refs = selectRecurringReferences(state, { territoryId: 'identity', budget: { maxItems: 2, maxChars: 1600 } });
    expect(refs.memories).toHaveLength(2);
    expect(refs.memories.every((entry) => entry.memory.type === 'character')).toBe(true);
    expect(() => selectRecurringReferences(state, { territoryId: ' ' })).toThrow();
  });

  it('fallback line is null without a labelled character/place', () => {
    expect(recurringFallbackLine([])).toBeNull();
  });
});
