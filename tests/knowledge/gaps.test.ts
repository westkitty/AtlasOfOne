import { describe, expect, it } from 'vitest';
import type { JournalEntry, KnowledgeGap } from '../../src/contracts';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, EvidenceRecord, TurnRecord } from '../../src/game/types';
import {
  coverageGapId,
  curiosityGapId,
  generateCoverageGaps,
  isGeneratedCoverageGap,
  markJournalForExploration,
  passiveCoveragePriority,
  refreshCoverageGaps,
  selectKnowledgeGaps
} from '../../src/knowledge/gaps';

const NOW = '2026-09-21T12:00:00.000Z';
const RECENT = '2026-09-20T12:00:00.000Z';
const OLD_75_DAYS = '2026-07-08T12:00:00.000Z';

function syntheticState(overrides: Partial<CampaignState> = {}): CampaignState {
  const base = createInitialCampaign();
  return {
    ...base,
    player: { id: 'player_synthetic', displayName: 'Synthetic Player', pronouns: 'they/them' },
    activeTerritory: 'atlas',
    territories: [{ id: 'atlas', label: 'Synthetic Territory', status: 'discovered', requiredDimensions: ['bananas'], coveredDimensions: [], evidenceIds: [] }],
    turns: [],
    evidence: [],
    journalEntries: [],
    knowledgeGaps: [],
    privateTopics: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides
  };
}

function turn(id: string, createdAt: string, dimension = 'bananas', retracted = false): TurnRecord {
  return { id, createdAt, territoryId: 'atlas', dimension, question: 'Synthetic prompt?', answer: 'Synthetic answer.', substantive: true, behavioralExample: false, revision: false, retracted };
}

function evidence(id: string, sourceTurnIds: string[], strength: 1 | 2 | 3 = 1, claim = 'Synthetic claim.'): EvidenceRecord {
  return { id, dimension: 'bananas', claim, sourceTurnIds, basis: 'explicit', strength, territories: ['atlas'], counterEvidenceIds: [], status: 'active', origin: 'player-stated' };
}

function journal(id: string, privacy: JournalEntry['privacy'] = 'normal', status: JournalEntry['status'] = 'active', text = 'Synthetic Journal text.'): JournalEntry {
  return { id, createdAt: RECENT, text, inputMode: 'typed', privacy, status, reflectionIds: [], adventureIds: [] };
}

describe('K00-K05 deterministic Knowledge Gap foundation', () => {
  it('uses collision-safe deterministic IDs and does not mistake arbitrary prefixed gaps for generated coverage state', () => {
    expect(coverageGapId('unknown', 'a-b', 'c')).not.toBe(coverageGapId('unknown', 'a', 'b-c'));
    expect(coverageGapId('unknown', 'atlas', 'self description')).not.toBe(coverageGapId('unknown', 'atlas', 'self-description'));
    expect(curiosityGapId('journal/a')).not.toBe(curiosityGapId('journal-a'));

    const manualPrefixed: KnowledgeGap = {
      id: 'knowledge_gap_coverage_manual-looking', kind: 'unknown', territoryIds: ['atlas'], dimensionIds: ['bananas'],
      sourceEvidenceIds: [], sourceJournalEntryIds: [], summary: 'Manually authored synthetic gap.', status: 'open', priority: 7
    };
    expect(isGeneratedCoverageGap(manualPrefixed)).toBe(false);
  });

  it('creates a deterministic unknown candidate with score 90 for zero eligible evidence', () => {
    const gaps = generateCoverageGaps(syntheticState(), { now: NOW });
    expect(gaps).toEqual([expect.objectContaining({
      id: coverageGapId('unknown', 'atlas', 'bananas'), kind: 'unknown', priority: 90,
      sourceEvidenceIds: [], sourceJournalEntryIds: []
    })]);
  });

  it('scores one recent eligible evidence record as underexplored at 30', () => {
    const gaps = generateCoverageGaps(syntheticState({ turns: [turn('turn_recent', RECENT)], evidence: [evidence('evidence_recent', ['turn_recent'])] }), { now: NOW });
    expect(gaps).toEqual([expect.objectContaining({ kind: 'underexplored', priority: 30, sourceEvidenceIds: ['evidence_recent'] })]);
  });

  it('adds age points to one 75-day-old eligible evidence record', () => {
    const gaps = generateCoverageGaps(syntheticState({ turns: [turn('turn_old', OLD_75_DAYS)], evidence: [evidence('evidence_old', ['turn_old'])] }), { now: NOW });
    expect(gaps[0]).toMatchObject({ kind: 'underexplored', priority: 50 });
    expect(generateCoverageGaps(syntheticState({ turns: [turn('turn_invalid_time', 'not-a-timestamp')], evidence: [evidence('evidence_invalid_time', ['turn_invalid_time'])] }), { now: NOW })[0].priority).toBe(60);
  });

  it('uses the exact 14/60/180-day age buckets and the weak multi-evidence coverage score', () => {
    const daysAgo = (days: number) => new Date(Date.parse(NOW) - days * 24 * 60 * 60 * 1000).toISOString();
    const score = (days: number, evidenceCount = 1) => passiveCoveragePriority({
      evidenceCount, sufficientlyCovered: false, sourceTurnTimestamps: [daysAgo(days)], now: NOW
    });

    expect(score(13)).toBe(30);
    expect(score(14)).toBe(40);
    expect(score(59)).toBe(40);
    expect(score(60)).toBe(50);
    expect(score(179)).toBe(50);
    expect(score(180)).toBe(60);
    expect(score(1, 2)).toBe(15);
  });

  it('does not create a passive coverage gap when two distinct source turns include strength-two evidence', () => {
    const state = syntheticState({
      turns: [turn('turn_one', RECENT), turn('turn_two', RECENT)],
      evidence: [evidence('evidence_one', ['turn_one'], 2), evidence('evidence_two', ['turn_two'])]
    });
    expect(generateCoverageGaps(state, { now: NOW })).toEqual([]);
  });

  it('keeps two records from one source turn underexplored', () => {
    const state = syntheticState({
      turns: [turn('turn_one', RECENT)],
      evidence: [evidence('evidence_one', ['turn_one'], 2), evidence('evidence_two', ['turn_one'], 1)]
    });
    expect(generateCoverageGaps(state, { now: NOW })[0]).toMatchObject({ kind: 'underexplored', priority: 15 });
  });

  it('does not produce passive gaps for a private dimension', () => {
    expect(generateCoverageGaps(syntheticState({ privateTopics: ['bananas'] }), { now: NOW })).toEqual([]);
  });

  it('excludes evidence with retracted or private source-turn provenance and fails closed to unknown', () => {
    const state = syntheticState({
      turns: [turn('turn_retracted', RECENT, 'bananas', true), turn('turn_private', RECENT, 'private-synthetic')],
      evidence: [evidence('evidence_retracted', ['turn_retracted'], 3), evidence('evidence_private', ['turn_private'], 3)],
      privateTopics: ['private-synthetic']
    });
    expect(generateCoverageGaps(state, { now: NOW })[0]).toMatchObject({ kind: 'unknown', priority: 90, sourceEvidenceIds: [] });
  });

  it('creates one priority-100 curiosity gap only from an eligible explicit Journal action', () => {
    const privateCanary = 'PRIVATE_SYNTHETIC_CANARY_42';
    const state = syntheticState({ journalEntries: [journal('journal_explore', 'normal', 'active', privateCanary)] });
    const result = markJournalForExploration(state, 'journal_explore', { now: NOW });
    expect(result.knowledgeGaps).toEqual([expect.objectContaining({
      id: curiosityGapId('journal_explore'), kind: 'curiosity', territoryIds: ['atlas'], dimensionIds: [],
      sourceEvidenceIds: [], sourceJournalEntryIds: ['journal_explore'], priority: 100
    })]);
    expect(result.knowledgeGaps[0].summary).not.toContain(privateCanary);
    expect(result.updatedAt).toBe(NOW);
  });

  it('does not duplicate or reopen a deterministic curiosity gap in any status', () => {
    const existing: KnowledgeGap = { id: curiosityGapId('journal_explore'), kind: 'curiosity', territoryIds: ['atlas'], dimensionIds: [], sourceEvidenceIds: [], sourceJournalEntryIds: ['journal_explore'], summary: 'Existing synthetic gap.', status: 'resolved', priority: 100 };
    const state = syntheticState({ journalEntries: [journal('journal_explore')], knowledgeGaps: [existing] });
    expect(markJournalForExploration(state, 'journal_explore', { now: NOW })).toBe(state);
  });

  it('rejects private, retracted, and RF09-masked Journal entries without creating gaps', () => {
    const maskedReflection = {
      id: 'reflection_private_journal', sourceKind: 'journal' as const, sourceIds: ['journal_masked'], privacyRetiredSourceIds: ['journal_masked'],
      question: 'Synthetic privacy prompt?', response: 'Synthetic privacy response.', createdAt: RECENT, outcome: 'PRIVATE' as const
    };
    const state = syntheticState({
      journalEntries: [journal('journal_private', 'private'), journal('journal_retracted', 'normal', 'retracted'), journal('journal_masked')],
      reflections: [maskedReflection]
    });
    for (const id of ['journal_private', 'journal_retracted', 'journal_masked']) {
      expect(markJournalForExploration(state, id, { now: NOW })).toBe(state);
    }
  });

  it('selects RF09-eligible open gaps by priority then ID with a bounded limit', () => {
    const gap = (id: string, priority: number, status: KnowledgeGap['status'] = 'open'): KnowledgeGap => ({ id, kind: 'underexplored', territoryIds: ['atlas'], dimensionIds: [], sourceEvidenceIds: [], sourceJournalEntryIds: [], summary: 'Synthetic gap.', status, priority });
    const maskedGap = { ...gap('masked-by-rf09', 200), sourceJournalEntryIds: ['journal_masked'] };
    const stalePrivateDimensionGap = { ...gap('stale-private-dimension', 250), dimensionIds: ['private-synthetic'], summary: 'PRIVATE_DIMENSION_GAP_CANARY_4c12' };
    const state = syntheticState({
      journalEntries: [journal('journal_masked', 'normal', 'active', 'RF09_MASKED_SYNTHETIC_CANARY')],
      reflections: [{ id: 'reflection_private_journal', sourceKind: 'journal', sourceIds: ['journal_masked'], privacyRetiredSourceIds: ['journal_masked'], question: 'Synthetic privacy prompt?', response: 'Synthetic privacy response.', createdAt: RECENT, outcome: 'PRIVATE' }],
      privateTopics: ['private-synthetic'],
      knowledgeGaps: [gap('z-low', 10), gap('b-high', 40), gap('a-high', 40), gap('seeded', 99, 'seeded'), gap('retired', 100, 'retired'), maskedGap, stalePrivateDimensionGap]
    });
    expect(selectKnowledgeGaps(state).map((entry) => entry.id)).toEqual(['a-high', 'b-high', 'z-low']);
    expect(selectKnowledgeGaps(state, { limit: 2 }).map((entry) => entry.id)).toEqual(['a-high', 'b-high']);
    expect(selectKnowledgeGaps(state, { includeNonOpen: true }).map((entry) => entry.id)).toEqual(['seeded', 'a-high', 'b-high', 'z-low']);
    expect(JSON.stringify(selectKnowledgeGaps(state))).not.toContain('RF09_MASKED_SYNTHETIC_CANARY');
    expect(JSON.stringify(selectKnowledgeGaps(state))).not.toContain('PRIVATE_DIMENSION_GAP_CANARY_4c12');
  });

  it('refreshes only generated open coverage gaps, resolves stale ones, and preserves all other gaps', () => {
    const currentId = coverageGapId('unknown', 'atlas', 'bananas');
    const staleId = coverageGapId('unknown', 'atlas', 'stale-synthetic');
    const openGenerated: KnowledgeGap = { id: currentId, kind: 'unknown', territoryIds: ['atlas'], dimensionIds: ['bananas'], sourceEvidenceIds: [], sourceJournalEntryIds: [], summary: 'Old wording.', status: 'open', priority: 1 };
    const staleGenerated: KnowledgeGap = { ...openGenerated, id: staleId, dimensionIds: ['stale-synthetic'] };
    const seededGenerated: KnowledgeGap = { ...openGenerated, status: 'seeded' };
    const manual: KnowledgeGap = { ...openGenerated, id: 'manual_synthetic_gap', kind: 'curiosity', status: 'open', priority: 100 };
    const state = syntheticState({ knowledgeGaps: [openGenerated, staleGenerated, seededGenerated, manual] });
    const result = refreshCoverageGaps(state, { now: NOW });
    const { knowledgeGaps: _beforeGaps, updatedAt: _beforeUpdatedAt, ...beforeRest } = state;
    const { knowledgeGaps: _afterGaps, updatedAt: _afterUpdatedAt, ...afterRest } = result;
    expect(afterRest).toEqual(beforeRest);
    expect(result.updatedAt).toBe(NOW);
    expect(result.knowledgeGaps.find((entry) => entry.id === currentId)).toMatchObject({ status: 'open', priority: 90 });
    expect(result.knowledgeGaps.find((entry) => entry.id === staleId)?.status).toBe('resolved');
    expect(result.knowledgeGaps.find((entry) => entry.id === currentId && entry.status === 'seeded')).toBe(seededGenerated);
    expect(result.knowledgeGaps.find((entry) => entry.id === 'manual_synthetic_gap')).toBe(manual);
    const added = refreshCoverageGaps(syntheticState(), { now: NOW });
    expect(added.knowledgeGaps).toHaveLength(1);
    expect(refreshCoverageGaps(added, { now: NOW })).toBe(added);
  });

  it('keeps scoring content-blind and never generates contradiction or change gaps', () => {
    const traumaState = syntheticState({ territories: [{ id: 'atlas', label: 'Synthetic Territory', status: 'discovered', requiredDimensions: ['trauma'], coveredDimensions: [], evidenceIds: [] }], turns: [turn('turn_content', OLD_75_DAYS, 'trauma')], evidence: [{ ...evidence('evidence_content', ['turn_content'], 1, 'Painful synthetic claim.'), dimension: 'trauma' }] });
    const bananaState = syntheticState({ territories: [{ id: 'atlas', label: 'Synthetic Territory', status: 'discovered', requiredDimensions: ['bananas'], coveredDimensions: [], evidenceIds: [] }], turns: [turn('turn_content', OLD_75_DAYS, 'bananas')], evidence: [evidence('evidence_content', ['turn_content'], 1, 'Ordinary synthetic claim.')] });
    const traumaGap = generateCoverageGaps(traumaState, { now: NOW })[0];
    const bananaGap = generateCoverageGaps(bananaState, { now: NOW })[0];
    expect(traumaGap.priority).toBe(bananaGap.priority);
    expect([traumaGap.kind, bananaGap.kind]).not.toContain('contradiction');
    expect([traumaGap.kind, bananaGap.kind]).not.toContain('change');
    expect(passiveCoveragePriority({ evidenceCount: 1, sufficientlyCovered: false, sourceTurnTimestamps: [OLD_75_DAYS], now: NOW })).toBe(50);
  });
});
