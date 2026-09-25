import { describe, expect, it, vi } from 'vitest';
import { ADVENTURE_SUMMARY_MAX_LENGTH, summarizeAdventureRun } from '../../../src/adventure/memory/summary';
import type { AdventureAction, AdventureRun, AdventureSeed } from '../../../src/adventure/schema';

const seed: AdventureSeed = {
  id: 'seed_1', sourceGapIds: ['gap_a'], kind: 'investigation', territoryId: 'identity',
  premise: 'PREMISE_CANARY lantern.', learningTarget: 'reflection-eligible', status: 'started'
};
const run: AdventureRun = {
  id: 'run_1', seedId: 'seed_1', territoryId: 'identity', status: 'complete', currentBeat: 'optional-reflection',
  characterIds: [], memoryIds: ['mem_b', 'mem_a', 'mem_a'],
  startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:05:00.000Z'
};
const act = (id: string, kind: AdventureAction['kind'], runId = 'run_1'): AdventureAction => ({
  id, runId, createdAt: '2026-01-01T00:01:00.000Z', kind, text: `ACTION_TEXT_CANARY ${id}`
});

describe('N01 compact deterministic adventure summary', () => {
  it('matches the fixture exactly', () => {
    const summary = summarizeAdventureRun(run, seed, [
      act('a1', 'say'), act('a2', 'inspect'), act('a3', 'say'), act('x', 'do', 'run_other')
    ]);
    expect(summary).toEqual({
      runId: 'run_1', seedId: 'seed_1', kind: 'investigation', territoryId: 'identity', status: 'complete',
      beatsReached: 6, beatsTotal: 6,
      actionCounts: { say: 2, do: 0, inspect: 1, travel: 0, combat: 0, leave: 0 },
      memoryIds: ['mem_a', 'mem_b'],
      text: 'A investigation adventure in identity was completed after 6 of 6 beats with 3 actions.'
    });
  });

  it('never copies premise, action text or journal text and makes no network call', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const serialized = JSON.stringify(summarizeAdventureRun(run, seed, [act('a1', 'say')]));
    vi.unstubAllGlobals();
    expect(serialized).not.toMatch(/CANARY/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('describes withdrawn runs neutrally and stays bounded', () => {
    const summary = summarizeAdventureRun({ ...run, status: 'withdrawn', currentBeat: 'approach' }, seed, [act('a1', 'leave')]);
    expect(summary.text).toBe('A investigation adventure in identity was set aside for now after 2 of 6 beats with 1 action.');
    expect(summary.text).not.toMatch(/fail|lost|wrong|bad/i);
    expect(summary.text.length).toBeLessThanOrEqual(ADVENTURE_SUMMARY_MAX_LENGTH);
  });

  it('is deterministic and rejects mismatched runs or off-plan beats', () => {
    expect(summarizeAdventureRun(run, seed, [])).toEqual(summarizeAdventureRun(run, seed, []));
    expect(() => summarizeAdventureRun({ ...run, seedId: 'other' }, seed, [])).toThrow();
    expect(() => summarizeAdventureRun({ ...run, currentBeat: 'epilogue' }, seed, [])).toThrow();
    expect(() => summarizeAdventureRun(run, { ...seed, learningTarget: 'none' }, [])).toThrow();
  });
});
