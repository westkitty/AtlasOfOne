import { describe, expect, it } from 'vitest';
import type { KnowledgeGap } from '../../src/contracts/reflection';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, EvidenceRecord, TurnRecord } from '../../src/game/types';
import {
  changeGapId,
  contradictionGapId,
  generateContradictionChangeGaps,
  isGeneratedContradictionChangeGap,
  K03_CONTRADICTION_PRIORITY,
  K03_COUNTER_LINKED_CHANGE_PRIORITY,
  K03_SAME_DIMENSION_CHANGE_PRIORITY,
  refreshContradictionChangeGaps
} from '../../src/knowledge/deltas';
import { selectDiverseKnowledgeGaps, selectKnowledgeGaps } from '../../src/knowledge/gaps';

const T0 = '2026-09-21T10:00:00.000Z';
const T1 = '2026-09-21T11:00:00.000Z';
const T2 = '2026-09-21T12:00:00.000Z';

type Contradiction = CampaignState['contradictions'][number];

function turn(id: string, dimension = 'bananas', createdAt = T0, revision = false, retracted = false): TurnRecord {
  return {
    id, createdAt, territoryId: 'atlas', dimension,
    question: `QUESTION_PROSE_CANARY_${id}`,
    answer: `ANSWER_PROSE_CANARY_${id}`,
    substantive: true, behavioralExample: false, revision, retracted
  };
}

function evidence(
  id: string,
  sourceTurnId: string,
  dimension = 'bananas',
  overrides: Partial<EvidenceRecord> = {}
): EvidenceRecord {
  return {
    id, dimension, claim: `EVIDENCE_CLAIM_CANARY_${id}`,
    sourceTurnIds: [sourceTurnId], basis: 'explicit', strength: 2,
    territories: ['atlas'], counterEvidenceIds: [], status: 'active', origin: 'player-stated',
    ...overrides
  };
}

function contradiction(id: string, evidenceIds: string[], status: Contradiction['status'] = 'open', claim = 'CONTRADICTION_PROSE_CANARY'): Contradiction {
  return { id, claim, evidenceIds, status };
}

function stateFor(overrides: Partial<CampaignState> = {}): CampaignState {
  const base = createInitialCampaign();
  return {
    ...base,
    activeTerritory: 'atlas',
    territories: [{ id: 'atlas', label: 'Synthetic Territory', status: 'discovered', requiredDimensions: ['bananas'], coveredDimensions: [], evidenceIds: [] }],
    turns: [], evidence: [], contradictions: [], reflections: [], knowledgeGaps: [], privateTopics: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function counterLinkedRevisionState(dimension = 'bananas', includeContradiction = false): CampaignState {
  const oldTurn = turn('turn-old', dimension, T0, false);
  const newTurn = turn('turn-new', dimension, T1, true);
  const oldEvidence = evidence('old', oldTurn.id, dimension, { counterEvidenceIds: ['new'] });
  const newEvidence = evidence('new', newTurn.id, dimension, { basis: 'revision' });
  return stateFor({
    turns: [oldTurn, newTurn], evidence: [oldEvidence, newEvidence],
    contradictions: includeContradiction ? [contradiction('contradiction-open', ['old', 'new'])] : []
  });
}

function sameDimensionRevisionState(dimension = 'bananas'): CampaignState {
  return stateFor({
    turns: [turn('turn-old', dimension, T0), turn('turn-new', dimension, T1, true)],
    evidence: [
      evidence('old', 'turn-old', dimension),
      evidence('new', 'turn-new', dimension, { basis: 'revision' })
    ]
  });
}

function manualGap(id: string, kind: KnowledgeGap['kind'], priority: number, dimensionIds = ['bananas']): KnowledgeGap {
  return { id, kind, territoryIds: ['atlas'], dimensionIds, sourceEvidenceIds: [], sourceJournalEntryIds: [], summary: 'Synthetic manual gap.', status: 'open', priority };
}

function cloned<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe('K03 contradiction/change Knowledge inputs', () => {
  it('creates one eligible open RF06-supported contradiction gap at fixed priority 85', () => {
    const state = counterLinkedRevisionState('bananas', true);
    const gaps = generateContradictionChangeGaps(state);
    const contradictions = gaps.filter((gap) => gap.kind === 'contradiction');
    expect(contradictions).toEqual([{
      id: contradictionGapId(['old', 'new']), kind: 'contradiction', territoryIds: ['atlas'], dimensionIds: ['bananas'],
      sourceEvidenceIds: ['new', 'old'].sort(), sourceJournalEntryIds: [],
      summary: 'Supported evidence remains in unresolved tension.', status: 'open', priority: K03_CONTRADICTION_PRIORITY
    }]);
    expect(gaps).toContainEqual(expect.objectContaining({ kind: 'change', priority: K03_COUNTER_LINKED_CHANGE_PRIORITY }));
  });

  it('does not generate a contradiction gap from resolved contradiction history', () => {
    const state = counterLinkedRevisionState();
    state.contradictions = [contradiction('resolved-history', ['old', 'new'], 'resolved')];
    expect(generateContradictionChangeGaps(state).map((gap) => gap.kind)).toEqual(['change']);
  });

  it('does not trust dramatic stored contradiction prose without an RF06-supported counter pair', () => {
    const state = sameDimensionRevisionState();
    state.contradictions = [contradiction('unsupported', ['old', 'new'], 'open', 'VERY_DRAMATIC_SECRET_CANARY')];
    const gaps = generateContradictionChangeGaps(state);
    expect(gaps.every((gap) => gap.kind !== 'contradiction')).toBe(true);
    expect(JSON.stringify(gaps)).not.toContain('VERY_DRAMATIC_SECRET_CANARY');
  });

  it('dedupes duplicate and reversed eligible contradiction records by exact evidence pair', () => {
    const state = counterLinkedRevisionState();
    state.contradictions = [
      contradiction('one', ['old', 'new']),
      contradiction('two', ['new', 'old'])
    ];
    const contradictions = generateContradictionChangeGaps(state).filter((gap) => gap.kind === 'contradiction');
    expect(contradictions).toHaveLength(1);
    expect(contradictions[0].id).toBe(contradictionGapId(['new', 'old']));
  });

  it('excludes RF09-masked, private, retracted, and otherwise ineligible contradiction sources', () => {
    const masked = counterLinkedRevisionState();
    masked.contradictions = [contradiction('private-contradiction', ['old', 'new'])];
    masked.reflections = [{
      id: 'reflection-private-contradiction', sourceKind: 'contradiction', sourceIds: ['private-contradiction'],
      privacyRetiredSourceIds: ['private-contradiction'], question: 'Synthetic?', response: 'Synthetic.', createdAt: T2, outcome: 'PRIVATE'
    }];
    expect(generateContradictionChangeGaps(masked).filter((gap) => gap.kind === 'contradiction')).toEqual([]);

    const retracted = counterLinkedRevisionState();
    retracted.contradictions = [contradiction('retracted-source', ['old', 'new'])];
    retracted.turns = retracted.turns.map((item) => item.id === 'turn-old' ? { ...item, retracted: true } : item);
    expect(generateContradictionChangeGaps(retracted).filter((gap) => gap.kind === 'contradiction')).toEqual([]);

    const privateDimension = counterLinkedRevisionState('private-synthetic');
    privateDimension.contradictions = [contradiction('private-dimension', ['old', 'new'])];
    privateDimension.privateTopics = ['private-synthetic'];
    expect(generateContradictionChangeGaps(privateDimension)).toEqual([]);
  });

  it('creates a same-dimension revision change gap at fixed priority 75', () => {
    const gaps = generateContradictionChangeGaps(sameDimensionRevisionState());
    expect(gaps).toEqual([expect.objectContaining({
      id: changeGapId('old', 'new'), kind: 'change', priority: K03_SAME_DIMENSION_CHANGE_PRIORITY,
      sourceEvidenceIds: ['old', 'new'], dimensionIds: ['bananas'],
      summary: 'Player revision history indicates a possible change over time.'
    })]);
  });

  it('creates a counter-linked revision change gap at fixed priority 80 when no eligible open contradiction exists', () => {
    const gaps = generateContradictionChangeGaps(counterLinkedRevisionState());
    expect(gaps).toEqual([expect.objectContaining({
      id: changeGapId('old', 'new'), kind: 'change', priority: K03_COUNTER_LINKED_CHANGE_PRIORITY
    })]);
  });

  it('keeps contradiction and change as distinct reachable concepts for the same revision pair', () => {
    const gaps = generateContradictionChangeGaps(counterLinkedRevisionState('bananas', true));
    expect(gaps).toHaveLength(2);
    expect(gaps.map((gap) => [gap.kind, gap.priority])).toEqual([['contradiction', 85], ['change', 80]]);
    expect(gaps.map((gap) => gap.sourceEvidenceIds)).toEqual([['new', 'old'], ['old', 'new']]);
  });

  it('resolves a stale contradiction gap while preserving the independently supported change gap', () => {
    const openState = counterLinkedRevisionState('bananas', true);
    const withGaps = refreshContradictionChangeGaps(openState, { now: T1 });
    expect(withGaps.knowledgeGaps.map((gap) => [gap.kind, gap.status, gap.priority]))
      .toEqual([['contradiction', 'open', 85], ['change', 'open', 80]]);

    const resolvedState: CampaignState = {
      ...withGaps,
      contradictions: withGaps.contradictions.map((item) => ({ ...item, status: 'resolved' as const }))
    };
    const next = refreshContradictionChangeGaps(resolvedState, { now: T2 });
    expect(next.knowledgeGaps).toContainEqual(expect.objectContaining({ id: contradictionGapId(['old', 'new']), status: 'resolved' }));
    expect(next.knowledgeGaps).toContainEqual(expect.objectContaining({ id: changeGapId('old', 'new'), kind: 'change', status: 'open', priority: 80 }));
  });

  it('fails closed when change provenance is missing, has no routable territory, or names a private dimension', () => {
    const missingOld = sameDimensionRevisionState();
    missingOld.evidence = missingOld.evidence.filter((item) => item.id !== 'old');
    expect(generateContradictionChangeGaps(missingOld)).toEqual([]);

    const noTerritory = sameDimensionRevisionState();
    noTerritory.evidence = noTerritory.evidence.map((item) => ({ ...item, territories: [] }));
    expect(generateContradictionChangeGaps(noTerritory)).toEqual([]);

    const privateDimension = sameDimensionRevisionState('private-synthetic');
    privateDimension.privateTopics = ['private-synthetic'];
    expect(generateContradictionChangeGaps(privateDimension)).toEqual([]);
  });

  it('uses collision-safe stable IDs for ambiguous-looking evidence IDs', () => {
    expect(contradictionGapId(['a-b', 'c'])).not.toBe(contradictionGapId(['a', 'b-c']));
    expect(changeGapId('a-b', 'c')).not.toBe(changeGapId('a', 'b-c'));
    expect(contradictionGapId(['x', 'y'])).toBe(contradictionGapId(['y', 'x']));
    expect(changeGapId('old', 'new')).toBe(changeGapId('old', 'new'));
  });

  it('orders generated gaps by priority desc then ID asc independent of input array order', () => {
    const state = stateFor({
      turns: [
        turn('turn-a-old', 'alpha', T0), turn('turn-a-new', 'alpha', T1, true),
        turn('turn-b-old', 'beta', T0), turn('turn-b-new', 'beta', T1, true)
      ],
      evidence: [
        evidence('a-old', 'turn-a-old', 'alpha'), evidence('a-new', 'turn-a-new', 'alpha', { basis: 'revision' }),
        evidence('b-old', 'turn-b-old', 'beta'), evidence('b-new', 'turn-b-new', 'beta', { basis: 'revision' })
      ]
    });
    const forward = generateContradictionChangeGaps(state).map((gap) => gap.id);
    const reverse = generateContradictionChangeGaps({ ...state, turns: [...state.turns].reverse(), evidence: [...state.evidence].reverse() }).map((gap) => gap.id);
    expect(forward).toEqual([...forward].sort());
    expect(reverse).toEqual(forward);
  });

  it('refreshes only generated OPEN K03 state and is idempotent', () => {
    const source = sameDimensionRevisionState();
    const manual = manualGap('manual-gap', 'underexplored', 33);
    const seeded: KnowledgeGap = { ...manualGap(changeGapId('seed-old', 'seed-new'), 'change', 75), sourceEvidenceIds: ['seed-old', 'seed-new'], status: 'seeded' };
    const input: CampaignState = { ...source, knowledgeGaps: [manual, seeded], updatedAt: T0 };
    const beforeOtherState = cloned({ ...input, knowledgeGaps: [], updatedAt: '' });
    const next = refreshContradictionChangeGaps(input, { now: T2 });
    const again = refreshContradictionChangeGaps(next, { now: '2026-09-21T13:00:00.000Z' });

    expect(next.knowledgeGaps).toContain(manual);
    expect(next.knowledgeGaps).toContain(seeded);
    expect(next.knowledgeGaps).toContainEqual(expect.objectContaining({ id: changeGapId('old', 'new'), status: 'open' }));
    expect({ ...next, knowledgeGaps: [], updatedAt: '' }).toEqual(beforeOtherState);
    expect(next.updatedAt).toBe(T2);
    expect(again).toBe(next);
  });

  it('preserves protected non-open generated K03 records instead of reopening them', () => {
    const state = sameDimensionRevisionState();
    for (const status of ['seeded', 'resolved', 'retired'] as const) {
      const protectedGap: KnowledgeGap = {
        id: changeGapId('old', 'new'), kind: 'change', territoryIds: ['atlas'], dimensionIds: ['bananas'],
        sourceEvidenceIds: ['old', 'new'], sourceJournalEntryIds: [], summary: 'Protected history.', status, priority: 75
      };
      const input = { ...state, knowledgeGaps: [protectedGap] };
      const next = refreshContradictionChangeGaps(input, { now: T2 });
      expect(next).toBe(input);
      expect(next.knowledgeGaps[0]).toBe(protectedGap);
    }
  });

  it('produces the structural rank curiosity > unknown > contradiction > linked change > change > underexplored', () => {
    const gaps: KnowledgeGap[] = [
      manualGap('curiosity', 'curiosity', 100, []),
      manualGap('unknown', 'unknown', 90),
      { ...manualGap(contradictionGapId(['c-old', 'c-new']), 'contradiction', 85), sourceEvidenceIds: ['c-new', 'c-old'].sort(), summary: 'Supported evidence remains in unresolved tension.' },
      { ...manualGap(changeGapId('l-old', 'l-new'), 'change', 80), sourceEvidenceIds: ['l-old', 'l-new'], summary: 'Player revision history indicates a possible change over time.' },
      { ...manualGap(changeGapId('s-old', 's-new'), 'change', 75), sourceEvidenceIds: ['s-old', 's-new'], summary: 'Player revision history indicates a possible change over time.' },
      manualGap('underexplored', 'underexplored', 40)
    ];
    const sourceEvidenceIds = ['c-old', 'c-new', 'l-old', 'l-new', 's-old', 's-new'];
    const selected = selectKnowledgeGaps(stateFor({
      turns: sourceEvidenceIds.map((id) => turn(`turn-${id}`)),
      evidence: sourceEvidenceIds.map((id) => evidence(id, `turn-${id}`)),
      knowledgeGaps: gaps
    }));
    expect(selected.map((gap) => gap.priority)).toEqual([100, 90, 85, 80, 75, 40]);
  });

  it('selectKnowledgeGaps consumes persisted generated K03 gaps in deterministic stored-priority order', () => {
    const refreshed = refreshContradictionChangeGaps(counterLinkedRevisionState(), { now: T2 });
    const selected = selectKnowledgeGaps(refreshed);
    expect(selected.map((gap) => gap.id)).toEqual([changeGapId('old', 'new')]);
    expect(selected[0].priority).toBe(80);
  });

  it('K04 may rerank K03 gaps without mutating their stored priorities', () => {
    const changeA = { ...manualGap(changeGapId('a-old', 'a-new'), 'change', 80, ['alpha']), sourceEvidenceIds: ['a-old', 'a-new'] };
    const changeB = { ...manualGap(changeGapId('b-old', 'b-new'), 'change', 75, ['beta']), sourceEvidenceIds: ['b-old', 'b-new'] };
    const state = stateFor({
      knowledgeGaps: [changeA, changeB],
      adventureSeeds: [{ id: 'seed-recent', sourceGapIds: [changeA.id], kind: 'exploration-expedition', territoryId: 'atlas', locationId: 'synthetic', premise: 'Synthetic.', learningTarget: 'none', status: 'available' }],
      adventureRuns: [{ id: 'run-recent', seedId: 'seed-recent', territoryId: 'atlas', locationId: 'synthetic', status: 'complete', currentBeatId: 'done', recurringCharacterIds: [], memoryIds: [], startedAt: T0, completedAt: T1 }]
    });
    const before = state.knowledgeGaps.map((gap) => gap.priority);
    selectDiverseKnowledgeGaps(state, { exactGapCooldownRuns: 0, recentRunWindow: 1 });
    expect(state.knowledgeGaps.map((gap) => gap.priority)).toEqual(before);
  });

  it('gives structurally identical trauma and bananas fixtures identical K03 priority behavior', () => {
    const trauma = generateContradictionChangeGaps(sameDimensionRevisionState('trauma'));
    const bananas = generateContradictionChangeGaps(sameDimensionRevisionState('bananas'));
    expect(trauma.map((gap) => ({ kind: gap.kind, priority: gap.priority, summary: gap.summary })))
      .toEqual(bananas.map((gap) => ({ kind: gap.kind, priority: gap.priority, summary: gap.summary })));
  });

  it('never copies claim, answer, question, or contradiction prose canaries into K03 output or ordering', () => {
    const state = counterLinkedRevisionState('bananas', true);
    state.evidence = state.evidence.map((item) => ({ ...item, claim: `SUPER_SECRET_EVIDENCE_${item.id}` }));
    state.turns = state.turns.map((item) => ({ ...item, question: `SUPER_SECRET_QUESTION_${item.id}`, answer: `SUPER_SECRET_ANSWER_${item.id}` }));
    state.contradictions = state.contradictions.map((item) => ({ ...item, claim: 'SUPER_SECRET_CONTRADICTION' }));
    const output = JSON.stringify(generateContradictionChangeGaps(state));
    expect(output).not.toContain('SUPER_SECRET_');
    expect(generateContradictionChangeGaps(state)[0].priority).toBe(85);
  });

  it('does not mutate RF06/RF07 source state during generation or refresh', () => {
    const state = counterLinkedRevisionState('bananas', true);
    const sourceBefore = cloned({ turns: state.turns, evidence: state.evidence, contradictions: state.contradictions, reflections: state.reflections });
    generateContradictionChangeGaps(state);
    const refreshed = refreshContradictionChangeGaps(state, { now: T2 });
    expect({ turns: state.turns, evidence: state.evidence, contradictions: state.contradictions, reflections: state.reflections }).toEqual(sourceBefore);
    expect({ turns: refreshed.turns, evidence: refreshed.evidence, contradictions: refreshed.contradictions, reflections: refreshed.reflections }).toEqual(sourceBefore);
  });

  it('recognizes only exact collision-safe generated K03 identities, not arbitrary lookalike prefixes', () => {
    const realChange: KnowledgeGap = { ...manualGap(changeGapId('old', 'new'), 'change', 75), sourceEvidenceIds: ['old', 'new'] };
    const fakeChange: KnowledgeGap = { ...realChange, id: 'knowledge_gap_change_fake' };
    const realContradiction: KnowledgeGap = { ...manualGap(contradictionGapId(['old', 'new']), 'contradiction', 85), sourceEvidenceIds: ['new', 'old'] };
    expect(isGeneratedContradictionChangeGap(realChange)).toBe(true);
    expect(isGeneratedContradictionChangeGap(fakeChange)).toBe(false);
    expect(isGeneratedContradictionChangeGap(realContradiction)).toBe(true);
  });
});
