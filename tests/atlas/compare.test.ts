import { describe, expect, it } from 'vitest';
import { compareAtlasSnapshots } from '../../src/atlas/compare';
import { evaluateSnapshotEligibility } from '../../src/atlas/eligibility';
import { createAtlasSnapshotRecord } from '../../src/atlas/history';
import { synthesizeLocalSnapshot } from '../../src/atlas/synthesize';
import type { CampaignState } from '../../src/game/types';
import { chartedState, evidence } from './fixtures';

const T1 = '2026-02-01T00:00:00.000Z';
const T2 = '2026-03-01T00:00:00.000Z';

/**
 * Synthetic comparison fixture.
 * snapshot_1: ev_1..ev_6, insight_1 (confirmed), insight_old (confirmed), contradiction_1
 * snapshot_2: ev_2..ev_7, insight_1, insight_new (confirmed), insight_rej (rejected),
 *             insight_pending, contradiction_2
 */
function fixture(): CampaignState {
  const base = chartedState();
  const request = evaluateSnapshotEligibility(base, { trigger: 'milestone', requestedAt: T1 });
  if (!request.eligible) throw new Error('fixture');
  const generated = synthesizeLocalSnapshot(base, { id: 'snapshot_1', request: request.request });
  const insight = (id: string, status: 'confirmed' | 'rejected' | 'pending', evidenceIds = ['ev_2']) =>
    ({ id, title: `Synthetic ${id}`, summary: 'Synthetic.', evidenceIds, confidence: 'low' as const, status, createdAt: T1 });

  const s1 = createAtlasSnapshotRecord({
    id: 'snapshot_1', createdAt: T1, synthesis: generated.synthesis,
    evidenceIds: ['ev_1', 'ev_2', 'ev_3', 'ev_4', 'ev_5', 'ev_6'],
    insightIds: ['insight_1', 'insight_old'],
    contradictionIds: ['contradiction_1']
  });
  const s2 = createAtlasSnapshotRecord({
    id: 'snapshot_2', createdAt: T2, synthesis: generated.synthesis,
    evidenceIds: ['ev_2', 'ev_3', 'ev_4', 'ev_5', 'ev_6', 'ev_7'],
    insightIds: ['insight_1', 'insight_new', 'insight_pending', 'insight_rej'],
    contradictionIds: ['contradiction_2']
  }, s1);

  return {
    ...base,
    evidence: [...base.evidence, evidence('ev_7', 'hopes', 'future')],
    insights: [
      ...base.insights,
      insight('insight_old', 'confirmed'),
      insight('insight_new', 'confirmed'),
      insight('insight_rej', 'rejected'),
      insight('insight_pending', 'pending')
    ],
    contradictions: [
      ...base.contradictions,
      { id: 'contradiction_2', claim: 'Synthetic second tension.', evidenceIds: ['ev_5', 'ev_7'], status: 'open' }
    ],
    atlasSnapshots: [s1, s2]
  };
}

describe('S05 Snapshot "what changed" comparison', () => {
  it('reports added/removed evidence, contradictions and insights by live status', () => {
    expect(compareAtlasSnapshots(fixture(), 'snapshot_1', 'snapshot_2')).toEqual({
      fromSnapshotId: 'snapshot_1',
      toSnapshotId: 'snapshot_2',
      evidence: { added: ['ev_7'], removed: ['ev_1'] },
      contradictions: { added: ['contradiction_2'], removed: ['contradiction_1'] },
      insights: {
        supported: { added: ['insight_new'], removed: ['insight_old'] },
        rejected: { added: ['insight_rej'], removed: [] },
        pending: { added: ['insight_pending'], removed: [] }
      },
      withheldCount: 0
    });
  });

  it('never reports a rejected insight as supported, even though it sits in insightIds', () => {
    const result = compareAtlasSnapshots(fixture(), 'snapshot_1', 'snapshot_2');
    expect(result.insights.supported.added).not.toContain('insight_rej');
  });

  it('uses LIVE status: an insight rejected after the Snapshot moves to rejected', () => {
    const s = fixture();
    s.insights = s.insights.map((i) => (i.id === 'insight_new' ? { ...i, status: 'rejected' as const } : i));
    const result = compareAtlasSnapshots(s, 'snapshot_1', 'snapshot_2');
    expect(result.insights.supported.added).toEqual([]);
    expect(result.insights.rejected.added).toEqual(['insight_new', 'insight_rej']);
  });

  it('withholds IDs whose sources became ineligible, reporting only a count', () => {
    const s = fixture();
    s.evidence = s.evidence.map((e) => (e.id === 'ev_7' ? { ...e, status: 'retracted' as const } : e));
    const result = compareAtlasSnapshots(s, 'snapshot_1', 'snapshot_2');
    expect(result.evidence.added).toEqual([]);
    expect(result.contradictions.added).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('ev_7');
    expect(JSON.stringify(result)).not.toContain('contradiction_2');
    expect(result.withheldCount).toBe(2);
  });

  it('withholds an insight ID with no live record', () => {
    const s = fixture();
    s.insights = s.insights.filter((i) => i.id !== 'insight_old');
    const result = compareAtlasSnapshots(s, 'snapshot_1', 'snapshot_2');
    expect(result.insights.supported.removed).toEqual([]);
    expect(result.withheldCount).toBe(1);
  });

  it('does not mutate either historical Snapshot', () => {
    const s = fixture();
    const before = JSON.stringify(s.atlasSnapshots);
    compareAtlasSnapshots(s, 'snapshot_1', 'snapshot_2');
    expect(JSON.stringify(s.atlasSnapshots)).toBe(before);
  });

  it('rejects reversed order, self-comparison and unknown IDs', () => {
    const s = fixture();
    expect(() => compareAtlasSnapshots(s, 'snapshot_2', 'snapshot_1')).toThrow('must be older');
    expect(() => compareAtlasSnapshots(s, 'snapshot_1', 'snapshot_1')).toThrow('itself');
    expect(() => compareAtlasSnapshots(s, 'snapshot_1', 'nope')).toThrow('Unknown AtlasSnapshot');
  });
});
