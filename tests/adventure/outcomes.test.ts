import { describe, expect, it } from 'vitest';
import {
  ADVENTURE_EXIT_CAUSES,
  completeAdventureRun,
  withdrawAdventureRun,
  type AdventureExitCause
} from '../../src/adventure/outcomes';
import { reduceAdventureRun, startAdventureRun } from '../../src/adventure/run';
import type { AdventureRun, AdventureSeed } from '../../src/adventure/schema';
import { createPureFunAdventureSeed } from '../../src/adventure/seeds';

const T0 = '2026-03-01T10:00:00.000Z';
const T1 = '2026-03-01T10:05:00.000Z';
const JUDGMENT = /\bfail(ed|ure|s)?\b|lose|lost|punish|penalt|shame|bad|wrong|coward|defeat/i;

const seed: AdventureSeed = {
  id: 'seed_1', sourceGapIds: ['gap_a'], kind: 'investigation', territoryId: 'identity',
  premise: 'A lantern flickers.', learningTarget: 'reflection-eligible', status: 'available'
};

function atBeat(s: AdventureSeed, advances: number): AdventureRun {
  let run = startAdventureRun(s, { id: 'run_1', startedAt: T0 });
  for (let i = 0; i < advances; i += 1) run = reduceAdventureRun(run, s, { type: 'advance', at: T1 });
  return run;
}

describe('withdrawal / fail-forward outcomes (A05)', () => {
  it('withdrawal is reachable from every beat', () => {
    for (let beats = 0; beats < 6; beats += 1) {
      const { run } = withdrawAdventureRun(atBeat(seed, beats), seed, { at: T1, cause: 'chose-to-leave' });
      expect(run).toMatchObject({ status: 'withdrawn', completedAt: T1 });
    }
  });

  it('every exit cause yields a story continuation and manufactures nothing', () => {
    for (const cause of ADVENTURE_EXIT_CAUSES) {
      const { outcome } = withdrawAdventureRun(atBeat(seed, 2), seed, { at: T1, cause });
      expect(outcome).toMatchObject({
        resolution: 'withdrawn', cause, xpDelta: 0, rewardIds: [], evidenceIds: [], observationIds: [],
        reflectionOffered: false
      });
      expect(outcome.storyContinuation.length).toBeGreaterThan(0);
    }
  });

  it('withdrawal outcomes carry no failure or moral-judgment language', () => {
    const text = ADVENTURE_EXIT_CAUSES
      .map((cause) => JSON.stringify(withdrawAdventureRun(atBeat(seed, 3), seed, { at: T1, cause }).outcome))
      .join(' ');
    expect(text).not.toMatch(JUDGMENT);
  });

  it('rejects unknown causes and withdrawing twice', () => {
    expect(() => withdrawAdventureRun(atBeat(seed, 0), seed, { at: T1, cause: 'gave-up' as AdventureExitCause })).toThrow();
    const { run } = withdrawAdventureRun(atBeat(seed, 0), seed, { at: T1, cause: 'escaped' });
    expect(() => withdrawAdventureRun(run, seed, { at: T1, cause: 'escaped' })).toThrow();
  });

  it('completion offers reflection only for reflection-eligible seeds and creates no evidence', () => {
    const { outcome } = completeAdventureRun(atBeat(seed, 5), seed, { at: T1 });
    expect(outcome).toMatchObject({ resolution: 'completed', reflectionOffered: true, evidenceIds: [], xpDelta: 0 });

    const fun = createPureFunAdventureSeed({ id: 'fun_1', territoryId: 'identity', premise: 'Goose.' });
    const funDone = completeAdventureRun(atBeat(fun, 4), fun, { at: T1 });
    expect(funDone.outcome.reflectionOffered).toBe(false);
    expect(funDone.run.status).toBe('complete');
  });
});
