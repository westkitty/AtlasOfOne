import { describe, expect, it } from 'vitest';
import { proposeReflectionHandoff } from '../../src/adventure/reflectionHandoff';
import type { AdventureObservation, AdventureRun, AdventureSeed } from '../../src/adventure/schema';

const seed = (overrides: Partial<AdventureSeed> = {}): AdventureSeed => ({
  id: 'seed_1', sourceGapIds: ['gap_a'], kind: 'investigation', territoryId: 'identity',
  premise: 'A lantern flickers.', learningTarget: 'reflection-eligible', status: 'started', ...overrides
});
const run = (overrides: Partial<AdventureRun> = {}): AdventureRun => ({
  id: 'run_1', seedId: 'seed_1', territoryId: 'identity', status: 'complete',
  currentBeat: 'optional-reflection', characterIds: [], memoryIds: [],
  startedAt: '2026-01-01T00:00:00.000Z', completedAt: '2026-01-01T00:10:00.000Z', ...overrides
});
const obs = (overrides: Partial<AdventureObservation> = {}): AdventureObservation => ({
  id: 'obs_1', runId: 'run_1', sourceActionIds: ['act_1'],
  observation: 'OBS_PROSE_CANARY chose to share the map.', status: 'unreflected', ...overrides
});

describe('A10 reflection handoff only when eligible', () => {
  it('produces an ID-only, optional, non-evidence candidate for an eligible completed run', () => {
    const candidate = proposeReflectionHandoff(run(), seed(), [obs({ id: 'obs_2' }), obs()]);
    expect(candidate).toEqual({
      kind: 'reflection-handoff-candidate', sourceKind: 'adventure', runId: 'run_1', seedId: 'seed_1',
      territoryId: 'identity', observationIds: ['obs_1', 'obs_2'], optional: true, isEvidence: false
    });
    const serialized = JSON.stringify(candidate);
    expect(serialized).not.toContain('OBS_PROSE_CANARY');
    for (const field of ['dimension', 'claim', 'strength', 'basis', 'evidenceIds']) {
      expect(serialized).not.toContain(`"${field}"`);
    }
  });

  it('produces none for pure-fun / learningTarget none even with observations', () => {
    expect(proposeReflectionHandoff(run(), seed({ learningTarget: 'none' }), [obs()])).toBeNull();
    expect(proposeReflectionHandoff(run(), seed({ kind: 'pure-fun', sourceGapIds: [], learningTarget: 'none' }), [obs()])).toBeNull();
    // Defence in depth: a malformed pure-fun seed flagged eligible still produces none.
    expect(proposeReflectionHandoff(run(), seed({ kind: 'pure-fun' }), [obs()])).toBeNull();
  });

  it('produces none for withdrawn or still-active runs', () => {
    expect(proposeReflectionHandoff(run({ status: 'withdrawn' }), seed(), [])).toBeNull();
    expect(proposeReflectionHandoff(run({ status: 'withdrawn' }), seed(), [obs()])).toBeNull();
    expect(proposeReflectionHandoff(run({ status: 'active', completedAt: undefined }), seed(), [obs()])).toBeNull();
  });

  it('produces none without usable observations', () => {
    expect(proposeReflectionHandoff(run(), seed(), [])).toBeNull();
    expect(proposeReflectionHandoff(run(), seed(), [obs({ status: 'discarded' }), obs({ id: 'o2', status: 'reflected' })])).toBeNull();
    expect(proposeReflectionHandoff(run(), seed(), [obs({ runId: 'run_other' })])).toBeNull();
    expect(proposeReflectionHandoff(run(), seed(), [obs({ sourceActionIds: [] })])).toBeNull();
  });

  it('honours a provenance gate and drops ineligible observations', () => {
    const gate = (id: string) => id !== 'obs_private';
    expect(proposeReflectionHandoff(run(), seed(), [obs({ id: 'obs_private' })], { observationIsEligible: gate })).toBeNull();
    expect(proposeReflectionHandoff(run(), seed(), [obs({ id: 'obs_private' }), obs()], { observationIsEligible: gate })?.observationIds)
      .toEqual(['obs_1']);
  });

  it('rejects a run/seed mismatch', () => {
    expect(() => proposeReflectionHandoff(run({ seedId: 'other' }), seed(), [obs()])).toThrow();
  });
});
