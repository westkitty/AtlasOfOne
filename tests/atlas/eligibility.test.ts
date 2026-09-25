import { describe, expect, it } from 'vitest';
import { generateLocalAssessment } from '../../src/cartographer/finalize';
import { evaluateSnapshotEligibility } from '../../src/atlas/eligibility';
import { createAtlasSnapshotRecord } from '../../src/atlas/history';
import type { CampaignState } from '../../src/game/types';
import { chartedState, evidence } from './fixtures';

const T0 = '2026-03-01T00:00:00.000Z';

function withPriorSnapshot(state: CampaignState, createdAt = '2026-02-01T00:00:00.000Z'): CampaignState {
  const snapshot = createAtlasSnapshotRecord({
    id: 'snapshot_prior',
    createdAt,
    evidenceIds: ['ev_1', 'ev_2', 'ev_3'],
    insightIds: [],
    contradictionIds: [],
    synthesis: generateLocalAssessment(state)
  });
  return { ...state, atlasSnapshots: [snapshot] };
}

describe('Snapshot eligibility (S01)', () => {
  it('grants a first milestone Snapshot with sorted qualifying provenance', () => {
    const result = evaluateSnapshotEligibility(chartedState(), { trigger: 'milestone', requestedAt: T0 });
    expect(result).toEqual({
      eligible: true,
      request: {
        trigger: 'milestone',
        requestedAt: T0,
        evidenceIds: ['ev_1', 'ev_2', 'ev_3', 'ev_4', 'ev_5', 'ev_6'],
        insightIds: ['insight_1'],
        contradictionIds: ['contradiction_1'],
        rejectedInsightIds: [],
        newSourceIds: ['ev_1', 'ev_2', 'ev_3', 'ev_4', 'ev_5', 'ev_6', 'insight_1', 'contradiction_1']
      }
    });
  });

  it('is deterministic for identical input', () => {
    const state = chartedState();
    const input = { trigger: 'milestone' as const, requestedAt: T0 };
    expect(evaluateSnapshotEligibility(state, input)).toEqual(evaluateSnapshotEligibility(state, input));
  });

  it('refuses a milestone before enough distinct dimensions are covered', () => {
    const state = chartedState();
    state.evidence = state.evidence.slice(0, 4);
    const result = evaluateSnapshotEligibility(state, { trigger: 'milestone', requestedAt: T0 });
    expect(result).toEqual({ eligible: false, reasons: ['milestone-not-reached'] });
  });

  it('allows an explicit first request once minimum evidence exists, but not cadence', () => {
    const state = chartedState();
    state.evidence = state.evidence.slice(0, 3);
    expect(evaluateSnapshotEligibility(state, { trigger: 'explicit-request', requestedAt: T0 }).eligible).toBe(true);
    expect(evaluateSnapshotEligibility(state, { trigger: 'cadence', requestedAt: T0 }))
      .toEqual({ eligible: false, reasons: ['cadence-not-first-snapshot'] });
  });

  it('does not count model-proposed or engine-derived evidence', () => {
    const state = chartedState();
    state.evidence = state.evidence.map((record) => ({ ...record, origin: 'model-proposed' as const }));
    const result = evaluateSnapshotEligibility(state, { trigger: 'explicit-request', requestedAt: T0 });
    expect(result).toEqual({ eligible: false, reasons: ['insufficient-evidence'] });
  });

  it('excludes pending/rejected insights and insights with non-qualifying support', () => {
    const state = chartedState();
    state.evidence.push(evidence('ev_model', 'fears', 'fears', { origin: 'model-proposed' }));
    state.insights.push(
      { ...state.insights[0], id: 'insight_pending', status: 'pending' },
      { ...state.insights[0], id: 'insight_rejected', status: 'rejected' },
      { ...state.insights[0], id: 'insight_mixed', evidenceIds: ['ev_1', 'ev_model'] }
    );
    const result = evaluateSnapshotEligibility(state, { trigger: 'milestone', requestedAt: T0 });
    expect(result.eligible && result.request.insightIds).toEqual(['insight_1']);
    expect(result.eligible && result.request.rejectedInsightIds).toEqual(['insight_rejected']);
    expect(result.eligible && result.request.evidenceIds).not.toContain('ev_model');
  });

  it('is never eligible from AdventureObservations alone', () => {
    const state = chartedState();
    state.evidence = [];
    state.insights = [];
    state.contradictions = [];
    state.adventureSeeds = [{
      id: 'seed_fixture', sourceGapIds: [], kind: 'pure-fun', territoryId: 'identity',
      premise: 'Synthetic premise.', learningTarget: 'fun', status: 'started'
    }];
    state.adventureRuns = [{
      id: 'run_fixture', seedId: 'seed_fixture', territoryId: 'identity', status: 'active',
      currentBeat: 'encounter', characterIds: [], memoryIds: [], startedAt: T0
    }];
    state.adventureActions = [{ id: 'action_fixture', runId: 'run_fixture', createdAt: T0, kind: 'combat', text: 'Synthetic action.' }];
    state.adventureObservations = ['a', 'b', 'c', 'd'].map((suffix) => ({
      id: `observation_${suffix}`, runId: 'run_fixture', sourceActionIds: ['action_fixture'],
      observation: 'Synthetic observation.', status: 'unreflected' as const
    }));
    const result = evaluateSnapshotEligibility(state, { trigger: 'explicit-request', requestedAt: T0 });
    expect(result).toEqual({ eligible: false, reasons: ['insufficient-evidence'] });
    expect(JSON.stringify(result)).not.toContain('observation_');
  });

  it('canary: PRIVATE/retracted-only material is not eligible and its IDs are absent', () => {
    const state = chartedState();
    state.evidence = state.evidence.map((record, index) => ({
      ...record,
      id: `canary_ev_${index}`,
      status: index % 2 === 0 ? 'retracted' as const : 'active' as const
    }));
    state.privateTopics = state.evidence.filter((_, index) => index % 2 === 1).map((record) => record.dimension);
    state.insights = [{ ...state.insights[0], id: 'canary_insight', evidenceIds: ['canary_ev_1'] }];
    state.contradictions = [{ ...state.contradictions[0], id: 'canary_contradiction', evidenceIds: ['canary_ev_0', 'canary_ev_1'] }];

    for (const trigger of ['milestone', 'explicit-request', 'cadence'] as const) {
      const result = evaluateSnapshotEligibility(state, { trigger, requestedAt: T0 });
      expect(result.eligible).toBe(false);
      expect(JSON.stringify(result)).not.toContain('canary_');
    }
  });

  it('keeps mixed provenance eligible but drops the private/retracted IDs', () => {
    const state = chartedState();
    state.evidence.push(
      evidence('canary_private', 'fears', 'fears'),
      evidence('canary_retracted', 'ambition', 'future', { status: 'retracted' })
    );
    state.privateTopics = ['fears'];
    const result = evaluateSnapshotEligibility(state, { trigger: 'milestone', requestedAt: T0 });
    expect(result.eligible).toBe(true);
    expect(JSON.stringify(result)).not.toContain('canary_');
  });

  it('bounds later Snapshots by cadence / explicit interval and requires new material', () => {
    const state = withPriorSnapshot(chartedState());
    expect(evaluateSnapshotEligibility(state, { trigger: 'milestone', requestedAt: T0 }))
      .toEqual({ eligible: false, reasons: ['milestone-only-first-snapshot'] });
    expect(evaluateSnapshotEligibility(state, { trigger: 'cadence', requestedAt: '2026-02-05T00:00:00.000Z' }))
      .toEqual({ eligible: false, reasons: ['too-soon'] });
    expect(evaluateSnapshotEligibility(state, { trigger: 'explicit-request', requestedAt: '2026-02-01T12:00:00.000Z' }))
      .toEqual({ eligible: false, reasons: ['too-soon'] });

    const cadence = evaluateSnapshotEligibility(state, { trigger: 'cadence', requestedAt: T0 });
    expect(cadence.eligible && cadence.request.previousSnapshotId).toBe('snapshot_prior');
    expect(cadence.eligible && cadence.request.newSourceIds)
      .toEqual(['ev_4', 'ev_5', 'ev_6', 'insight_1', 'contradiction_1']);

    const stale = withPriorSnapshot(chartedState());
    stale.evidence = stale.evidence.slice(0, 3);
    stale.insights = [];
    stale.contradictions = [];
    expect(evaluateSnapshotEligibility(stale, { trigger: 'cadence', requestedAt: T0 }))
      .toEqual({ eligible: false, reasons: ['no-new-material'] });
  });

  it('rejects an invalid requestedAt', () => {
    expect(evaluateSnapshotEligibility(chartedState(), { trigger: 'milestone', requestedAt: 'nope' }))
      .toEqual({ eligible: false, reasons: ['invalid-requested-at'] });
  });
});
