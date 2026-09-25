import { describe, expect, it } from 'vitest';
import * as actionsModule from '../../src/adventure/actions';
import {
  discardAdventureObservation,
  recordAdventureAction,
  recordAdventureObservation
} from '../../src/adventure/actions';
import { reduceAdventureRun, startAdventureRun } from '../../src/adventure/run';
import type { AdventureAction, AdventureSeed } from '../../src/adventure/schema';

const T0 = '2026-03-01T10:00:00.000Z';
const T1 = '2026-03-01T10:01:00.000Z';

const seed: AdventureSeed = {
  id: 'seed_1', sourceGapIds: ['gap_a'], kind: 'investigation', territoryId: 'identity',
  premise: 'A lantern flickers.', learningTarget: 'reflection-eligible', status: 'available'
};
const run = startAdventureRun(seed, { id: 'run_1', startedAt: T0 });

function action(id: string, runId = 'run_1'): AdventureAction {
  return { id, runId, createdAt: T1, kind: 'inspect', text: 'I look under the lantern.' };
}

describe('AdventureAction recording (A02)', () => {
  it('records a bounded fictional action on an active run', () => {
    expect(recordAdventureAction(run, { id: 'act_1', createdAt: T1, kind: 'say', text: '  Hello?  ' }))
      .toEqual({ id: 'act_1', runId: 'run_1', createdAt: T1, kind: 'say', text: 'Hello?' });
  });

  it('rejects empty/oversized text, bad kinds, bad times and inactive runs', () => {
    expect(() => recordAdventureAction(run, { id: 'a', createdAt: T1, kind: 'say', text: '  ' })).toThrow();
    expect(() => recordAdventureAction(run, { id: 'a', createdAt: T1, kind: 'say', text: 'x'.repeat(2001) })).toThrow();
    expect(() => recordAdventureAction(run, { id: 'a', createdAt: T1, kind: 'cast' as never, text: 'x' })).toThrow();
    expect(() => recordAdventureAction(run, { id: 'a', createdAt: '2026-01-01T00:00:00.000Z', kind: 'say', text: 'x' })).toThrow();
    const withdrawn = reduceAdventureRun(run, seed, { type: 'withdraw', at: T1 });
    expect(() => recordAdventureAction(withdrawn, { id: 'a', createdAt: T1, kind: 'say', text: 'x' })).toThrow();
  });
});

describe('AdventureObservation recording (A02)', () => {
  it('records an unreflected observation grounded in this run\'s actions', () => {
    const observation = recordAdventureObservation(run, [action('act_2'), action('act_1')], {
      id: 'obs_1', sourceActionIds: ['act_2', 'act_1', 'act_2'], observation: 'Chose to look closely first.'
    });
    expect(observation).toEqual({
      id: 'obs_1', runId: 'run_1', sourceActionIds: ['act_1', 'act_2'],
      observation: 'Chose to look closely first.', status: 'unreflected'
    });
  });

  it('OBSERVATION IS NOT EVIDENCE: no evidence-shaped fields exist on the record', () => {
    const observation = recordAdventureObservation(run, [action('act_1')], {
      id: 'obs_1', sourceActionIds: ['act_1'], observation: 'Looked closely.'
    });
    expect(Object.keys(observation).sort()).toEqual(['id', 'observation', 'runId', 'sourceActionIds', 'status']);
    for (const key of ['claim', 'dimension', 'strength', 'basis', 'territories', 'origin', 'evidenceId']) {
      expect(observation).not.toHaveProperty(key);
    }
  });

  it('OBSERVATION IS NOT EVIDENCE: the module exports no evidence conversion path', () => {
    expect(Object.keys(actionsModule).filter((name) => /evidence|confirm|reflect/i.test(name))).toEqual([]);
  });

  it('rejects missing, foreign or unknown source actions and empty text', () => {
    expect(() => recordAdventureObservation(run, [], { id: 'o', sourceActionIds: [], observation: 'x' })).toThrow();
    expect(() => recordAdventureObservation(run, [action('act_1')], { id: 'o', sourceActionIds: ['act_9'], observation: 'x' })).toThrow();
    expect(() => recordAdventureObservation(run, [action('act_1', 'run_other')], { id: 'o', sourceActionIds: ['act_1'], observation: 'x' })).toThrow();
    expect(() => recordAdventureObservation(run, [action('act_1')], { id: 'o', sourceActionIds: ['act_1'], observation: ' ' })).toThrow();
  });

  it('discard is idempotent and reflected observations stay as history', () => {
    const observation = recordAdventureObservation(run, [action('act_1')], {
      id: 'obs_1', sourceActionIds: ['act_1'], observation: 'Looked closely.'
    });
    const discarded = discardAdventureObservation(observation);
    expect(discarded.status).toBe('discarded');
    expect(discardAdventureObservation(discarded)).toBe(discarded);
    expect(() => discardAdventureObservation({ ...observation, status: 'reflected' })).toThrow();
  });
});
