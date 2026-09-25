import { describe, expect, it } from 'vitest';
import { evaluateSnapshotEligibility, type AtlasSnapshotRequest } from '../../src/atlas/eligibility';
import { appendAtlasSnapshot } from '../../src/atlas/history';
import { atlasSnapshotSchema } from '../../src/atlas/schema';
import { LOCAL_SNAPSHOT_PROVIDER, synthesizeLocalSnapshot } from '../../src/atlas/synthesize';
import type { CampaignState } from '../../src/game/types';
import { chartedState, evidence } from './fixtures';

const T0 = '2026-03-01T00:00:00.000Z';

function requestFor(state: CampaignState, requestedAt = T0, trigger: 'milestone' | 'cadence' | 'explicit-request' = 'milestone'): AtlasSnapshotRequest {
  const result = evaluateSnapshotEligibility(state, { trigger, requestedAt });
  if (!result.eligible) throw new Error('fixture not eligible: ' + result.reasons.join(','));
  return result.request;
}

describe('Local Snapshot synthesizer (S02)', () => {
  it('produces a schema-valid, dated, provider-free Snapshot with provenance IDs', () => {
    const state = chartedState();
    const snapshot = synthesizeLocalSnapshot(state, { id: 'snapshot_1', request: requestFor(state) });

    expect(atlasSnapshotSchema.parse(snapshot)).toEqual(snapshot);
    expect(snapshot.createdAt).toBe(T0);
    expect(snapshot.previousSnapshotId).toBeUndefined();
    expect(snapshot.synthesis.provider).toBe(LOCAL_SNAPSHOT_PROVIDER);
    expect(snapshot.synthesis.whoIsGreyson).toContain('2026-03-01');
    expect(snapshot.evidenceIds).toEqual(['ev_1', 'ev_2', 'ev_3', 'ev_4', 'ev_5', 'ev_6']);
    expect(snapshot.insightIds).toEqual(['insight_1']);
    expect(snapshot.contradictionIds).toEqual(['contradiction_1']);
    expect(snapshot.synthesis.temperament.establishedEvidence).toEqual(['Synthetic claim ev_1.']);
    expect(snapshot.synthesis.temperament.supportedInferences).toHaveLength(1);
    expect(snapshot.synthesis.contradictionsAndTensions).toEqual([{
      tension: 'Synthetic tension between two statements.',
      evidence: ['ev_3', 'ev_4'],
      status: 'open'
    }]);
  });

  it('is deterministic', () => {
    const state = chartedState();
    const request = requestFor(state);
    expect(synthesizeLocalSnapshot(state, { id: 's', request }))
      .toEqual(synthesizeLocalSnapshot(state, { id: 's', request }));
  });

  it('states uncertainty and open questions, and never claims finality or diagnoses', () => {
    const state = chartedState();
    const snapshot = synthesizeLocalSnapshot(state, { id: 'snapshot_1', request: requestFor(state) });
    const text = JSON.stringify(snapshot.synthesis);

    expect(snapshot.synthesis.whoIsGreyson).toContain('revisable');
    expect(snapshot.synthesis.frameworkEstimates).toEqual([]);
    expect(snapshot.synthesis.politicalAndIdeology.openQuestionsAndUncertainty[0]).toMatch(/still open/);
    expect(snapshot.synthesis.openQuestions).toContain('Politics and ideology is still uncharted.');
    expect(snapshot.synthesis.openQuestions)
      .toContain('Open contradictions stay unresolved until Greyson says otherwise.');
    expect(text).not.toMatch(/\b(final|finished|complete[sd]?|definitive|diagnos\w*|disorder)\b/i);
  });

  it('preserves rejected interpretations as NOT reasserted', () => {
    const state = chartedState();
    state.insights.push({
      ...state.insights[0], id: 'insight_rejected', title: 'Synthetic rejected reading', status: 'rejected'
    });
    const snapshot = synthesizeLocalSnapshot(state, { id: 'snapshot_1', request: requestFor(state) });

    expect(snapshot.insightIds).toEqual(['insight_1', 'insight_rejected']);
    expect(snapshot.synthesis.openQuestions)
      .toContain('Previously rejected interpretation, not reasserted: "Synthetic rejected reading".');
    const inferences = Object.values(snapshot.synthesis)
      .flatMap((value) => (value && typeof value === 'object' && 'supportedInferences' in value
        ? value.supportedInferences : []));
    expect(JSON.stringify(inferences)).not.toContain('Synthetic rejected reading');
  });

  it('canary: PRIVATE/retracted sources are absent from output text and IDs', () => {
    const state = chartedState();
    state.evidence.push(
      evidence('canary_private_ev', 'fears', 'fears', { claim: 'CANARY_PRIVATE_CLAIM' }),
      evidence('canary_retracted_ev', 'ambition', 'future', { claim: 'CANARY_RETRACTED_CLAIM', status: 'retracted' })
    );
    state.privateTopics = ['fears'];
    state.insights.push(
      { ...state.insights[0], id: 'canary_insight', title: 'CANARY_INSIGHT', summary: 'CANARY', evidenceIds: ['ev_1', 'canary_private_ev'] },
      { ...state.insights[0], id: 'canary_rejected', title: 'CANARY_REJECTED', status: 'rejected', evidenceIds: ['canary_retracted_ev'] }
    );
    state.contradictions.push({ id: 'canary_contradiction', claim: 'CANARY_TENSION', evidenceIds: ['ev_1', 'canary_retracted_ev'], status: 'open' });

    const snapshot = synthesizeLocalSnapshot(state, { id: 'snapshot_1', request: requestFor(state) });
    expect(JSON.stringify(snapshot)).not.toMatch(/canary/i);
  });

  it('refuses a stale request naming material that has since become PRIVATE or retracted', () => {
    const state = chartedState();
    const request = requestFor(state);
    const privatized = { ...state, privateTopics: ['loyalty'] };
    expect(() => synthesizeLocalSnapshot(privatized, { id: 's', request }))
      .toThrow(/non-qualifying evidence/);
    const retracted = { ...state, evidence: state.evidence.map((record) => record.id === 'ev_3' ? { ...record, status: 'retracted' as const } : record) };
    expect(() => synthesizeLocalSnapshot(retracted, { id: 's', request })).toThrow(/non-qualifying/);
    try {
      synthesizeLocalSnapshot(privatized, { id: 's', request });
    } catch (error) {
      expect(String(error)).not.toContain('ev_2');
    }
  });

  it('links to the previous Snapshot, reports what changed and appends without rewriting history', () => {
    const initial = chartedState();
    initial.evidence = initial.evidence.slice(0, 3);
    initial.insights = [];
    initial.contradictions = [];
    const first = synthesizeLocalSnapshot(initial, {
      id: 'snapshot_1', request: requestFor(initial, '2026-02-01T00:00:00.000Z', 'explicit-request')
    });
    const frozen = JSON.stringify(first);

    const later = { ...chartedState(), atlasSnapshots: [first] };
    const second = synthesizeLocalSnapshot(later, { id: 'snapshot_2', request: requestFor(later, T0, 'cadence') });

    expect(second.previousSnapshotId).toBe('snapshot_1');
    expect(second.synthesis.whoIsGreyson).toContain('Since the previous Snapshot, 5 source(s) are new.');
    expect(appendAtlasSnapshot([first], second).map((item) => item.id)).toEqual(['snapshot_1', 'snapshot_2']);
    expect(JSON.stringify(first)).toBe(frozen);
  });

  it('rejects a request whose previous Snapshot is no longer the latest', () => {
    const state = chartedState();
    const request = { ...requestFor(state), previousSnapshotId: 'snapshot_ghost' };
    expect(() => synthesizeLocalSnapshot(state, { id: 's', request })).toThrow(/stale/);
  });
});
