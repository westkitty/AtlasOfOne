import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { evaluateSnapshotEligibility } from '../../src/atlas/eligibility';
import { explainInsight } from '../../src/atlas/explain';
import { InsightExplanation } from '../../src/atlas/InsightExplanation';
import { synthesizeLocalSnapshot } from '../../src/atlas/synthesize';
import type { CampaignState } from '../../src/game/types';
import { createReflectionRecord, decideReflection, retractReflection } from '../../src/reflection/domain';
import { chartedState } from './fixtures';

const T_SNAP = '2026-02-01T00:00:00.000Z';
const SECRET = 'Synthetic secret reflection words';

function state(): CampaignState {
  const base = chartedState();
  const request = evaluateSnapshotEligibility(base, { trigger: 'milestone', requestedAt: T_SNAP });
  if (!request.eligible) throw new Error('fixture');
  const snapshot = synthesizeLocalSnapshot(base, { id: 'snapshot_1', request: request.request });
  return {
    ...base,
    evidence: base.evidence.map((e) => (e.id === 'ev_2' ? { ...e, basis: 'inference' as const, origin: 'model-proposed' as const } : e)),
    atlasSnapshots: [snapshot],
    contradictions: [
      ...base.contradictions,
      { id: 'contradiction_overlap', claim: 'Synthetic overlap.', evidenceIds: ['ev_1', 'ev_6'], status: 'open' },
      { id: 'contradiction_resolved', claim: 'Synthetic resolved.', evidenceIds: ['ev_1'], status: 'resolved' }
    ],
    reflections: [
      decideReflection(createReflectionRecord({ id: 'reflection_confirm', sourceKind: 'insight', sourceIds: ['insight_1'], question: 'Q?', interpretation: 'Synthetic.', createdAt: T_SNAP }), 'confirm', 'Yes.'),
      decideReflection(createReflectionRecord({ id: 'reflection_private', sourceKind: 'insight', sourceIds: ['insight_1'], question: 'Q?', interpretation: SECRET, createdAt: T_SNAP }), 'private', SECRET),
      decideReflection(createReflectionRecord({ id: 'reflection_other', sourceKind: 'journal', sourceIds: ['journal_x'], question: 'Q?', createdAt: T_SNAP }), 'confirm', 'Yes.')
    ]
  };
}

describe('RF08 explainInsight', () => {
  it('returns the provenance chain: evidence basis, reflection decision, counter-evidence, snapshots', () => {
    const result = explainInsight(state(), 'insight_1');
    expect(result).toEqual({
      kind: 'explained',
      insightId: 'insight_1',
      title: 'Synthetic insight title',
      status: 'confirmed',
      confidence: 'moderate',
      createdAt: '2026-01-01T00:00:00.000Z',
      evidence: [
        { id: 'ev_1', dimension: 'self-description', basis: 'explicit', origin: 'player-stated' },
        { id: 'ev_2', dimension: 'loyalty', basis: 'inference', origin: 'model-proposed' }
      ],
      reflections: [{ id: 'reflection_confirm', decision: 'confirm', epistemicStatus: 'confirmed', createdAt: T_SNAP }],
      counterContradictionIds: ['contradiction_overlap'],
      snapshots: [{ id: 'snapshot_1', createdAt: T_SNAP }],
      withheldSourceCount: 1
    });
  });

  it('never includes PRIVATE reflection content, only the withheld count', () => {
    const result = explainInsight(state(), 'insight_1');
    expect(JSON.stringify(result)).not.toContain(SECRET);
    expect(JSON.stringify(result)).not.toContain('reflection_private');
  });

  it('counts retracted reflections and ineligible contradictions as withheld', () => {
    const s = state();
    s.reflections = s.reflections.map((r) => (r.id === 'reflection_confirm' ? retractReflection(r) : r));
    s.evidence = s.evidence.map((e) => (e.id === 'ev_6' ? { ...e, status: 'retracted' as const } : e));
    const result = explainInsight(s, 'insight_1');
    if (result.kind !== 'explained') throw new Error('expected explained');
    expect(result.reflections).toEqual([]);
    expect(result.counterContradictionIds).toEqual([]);
    // private + retracted reflection + ineligible contradiction + Snapshot citing ev_6
    expect(result.snapshots).toEqual([]);
    expect(result.withheldSourceCount).toBe(4);
  });

  it('withholds the whole insight when its own evidence is retracted', () => {
    const s = state();
    s.evidence = s.evidence.map((e) => (e.id === 'ev_1' ? { ...e, status: 'retracted' as const } : e));
    expect(explainInsight(s, 'insight_1')).toEqual({ kind: 'withheld', insightId: 'insight_1' });
  });

  it('shows a rejected insight as rejected', () => {
    const s = state();
    s.insights = s.insights.map((i) => ({ ...i, status: 'rejected' as const }));
    const result = explainInsight(s, 'insight_1');
    expect(result.kind === 'explained' && result.status).toBe('rejected');
  });

  it('throws for an unknown insight', () => {
    expect(() => explainInsight(state(), 'nope')).toThrow('Unknown InsightRecord id');
  });
});

describe('RF08 InsightExplanation component', () => {
  it('renders sources with explicit/inferred labels and the withheld count only', () => {
    const html = renderToStaticMarkup(createElement(InsightExplanation, { explanation: explainInsight(state(), 'insight_1') }));
    expect(html).toContain('Confirmed by you');
    expect(html).toContain('you said this');
    expect(html).toContain('inferred');
    expect(html).toContain('contradiction_overlap');
    expect(html).toContain('1 private or withdrawn source is not shown.');
    expect(html).not.toContain(SECRET);
  });

  it('renders a rejected insight as not counted', () => {
    const s = state();
    s.insights = s.insights.map((i) => ({ ...i, status: 'rejected' as const }));
    const html = renderToStaticMarkup(createElement(InsightExplanation, { explanation: explainInsight(s, 'insight_1') }));
    expect(html).toContain('not counted');
    expect(html).not.toContain('Confirmed by you');
  });

  it('renders a withheld insight without title or content', () => {
    const html = renderToStaticMarkup(createElement(InsightExplanation, { explanation: { kind: 'withheld', insightId: 'insight_1' } }));
    expect(html).toContain('no longer shown');
    expect(html).not.toContain('Synthetic insight title');
  });
});
