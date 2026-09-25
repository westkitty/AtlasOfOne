import { describe, expect, it } from 'vitest';
import { reduceAdventureRun, startAdventureRun, type AdventureRunEvent } from '../../src/adventure/run';
import type { AdventureRun, AdventureSeed } from '../../src/adventure/schema';
import { createPureFunAdventureSeed, markAdventureSeedStarted } from '../../src/adventure/seeds';

const T0 = '2026-03-01T10:00:00.000Z';
const T1 = '2026-03-01T10:05:00.000Z';

const seed: AdventureSeed = {
  id: 'seed_1', sourceGapIds: ['gap_a'], kind: 'investigation', territoryId: 'identity',
  premise: 'A lantern flickers.', learningTarget: 'reflection-eligible', status: 'available'
};

function advance(run: AdventureRun, s: AdventureSeed, times: number): AdventureRun {
  let current = run;
  for (let i = 0; i < times; i += 1) current = reduceAdventureRun(current, s, { type: 'advance', at: T1 });
  return current;
}

describe('AdventureRun lifecycle (A01)', () => {
  it('starts active at the hook beat from an available seed', () => {
    const run = startAdventureRun(seed, { id: 'run_1', startedAt: T0, characterIds: ['npc_b', 'npc_a', 'npc_b'] });
    expect(run).toEqual({
      id: 'run_1', seedId: 'seed_1', territoryId: 'identity', status: 'active', currentBeat: 'hook',
      characterIds: ['npc_a', 'npc_b'], memoryIds: [], startedAt: T0
    });
  });

  it('refuses to start from a started/retired seed, empty id or bad time', () => {
    expect(() => startAdventureRun(markAdventureSeedStarted(seed), { id: 'r', startedAt: T0 })).toThrow();
    expect(() => startAdventureRun({ ...seed, status: 'retired' }, { id: 'r', startedAt: T0 })).toThrow();
    expect(() => startAdventureRun(seed, { id: ' ', startedAt: T0 })).toThrow();
    expect(() => startAdventureRun(seed, { id: 'r', startedAt: 'yesterday' })).toThrow();
  });

  it('walks all six beats in order and completes only from the last', () => {
    const run = startAdventureRun(seed, { id: 'run_1', startedAt: T0 });
    const beats = [run.currentBeat];
    let current = run;
    for (let i = 0; i < 5; i += 1) {
      expect(() => reduceAdventureRun(current, seed, { type: 'complete', at: T1 })).toThrow(/cannot complete/);
      current = reduceAdventureRun(current, seed, { type: 'advance', at: T1 });
      beats.push(current.currentBeat);
    }
    expect(beats).toEqual(['hook', 'approach', 'complication', 'encounter', 'choice-consequence', 'optional-reflection']);
    expect(() => reduceAdventureRun(current, seed, { type: 'advance', at: T1 })).toThrow(/final beat/);
    const done = reduceAdventureRun(current, seed, { type: 'complete', at: T1 });
    expect(done).toMatchObject({ status: 'complete', completedAt: T1 });
  });

  it('terminal states reject every event', () => {
    const run = startAdventureRun(seed, { id: 'run_1', startedAt: T0 });
    const withdrawn = reduceAdventureRun(run, seed, { type: 'withdraw', at: T1 });
    const done = reduceAdventureRun(advance(run, seed, 5), seed, { type: 'complete', at: T1 });
    const events: AdventureRunEvent[] = [
      { type: 'advance', at: T1 }, { type: 'complete', at: T1 }, { type: 'withdraw', at: T1 }
    ];
    for (const terminal of [withdrawn, done]) {
      for (const event of events) expect(() => reduceAdventureRun(terminal, seed, event)).toThrow();
    }
  });

  it('fails closed on seed mismatch, unknown beat, time travel and unknown events', () => {
    const run = startAdventureRun(seed, { id: 'run_1', startedAt: T0 });
    expect(() => reduceAdventureRun(run, { ...seed, id: 'other' }, { type: 'advance', at: T1 })).toThrow();
    expect(() => reduceAdventureRun({ ...run, currentBeat: 'boss-rush' }, seed, { type: 'advance', at: T1 })).toThrow();
    expect(() => reduceAdventureRun(run, seed, { type: 'advance', at: '2026-02-01T00:00:00.000Z' })).toThrow();
    expect(() => reduceAdventureRun(run, seed, { type: 'teleport', at: T1 } as unknown as AdventureRunEvent)).toThrow();
  });

  it('does not mutate its input run', () => {
    const run = startAdventureRun(seed, { id: 'run_1', startedAt: T0 });
    const before = structuredClone(run);
    reduceAdventureRun(run, seed, { type: 'advance', at: T1 });
    expect(run).toEqual(before);
  });
});

describe('pure-fun run requires no reflection (A09)', () => {
  it('completes after choice-consequence with no reflection beat ever reached', () => {
    const fun = createPureFunAdventureSeed({ id: 'fun_1', territoryId: 'identity', premise: 'A goose steals a hat.' });
    const run = startAdventureRun(fun, { id: 'run_fun', startedAt: T0 });
    const last = advance(run, fun, 4);
    expect(last.currentBeat).toBe('choice-consequence');
    expect(() => reduceAdventureRun(last, fun, { type: 'advance', at: T1 })).toThrow(/final beat/);
    const done = reduceAdventureRun(last, fun, { type: 'complete', at: T1 });
    expect(done.status).toBe('complete');
  });
});
