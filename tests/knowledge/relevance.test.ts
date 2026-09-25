import { describe, expect, it } from 'vitest';
import {
  GAP_CONFIRMED_CHANGE_RELEVANCE_POINTS,
  GAP_CONTRADICTION_RELEVANCE_POINTS,
  rankKnowledgeGapsWithStructuralRelevance,
  scoreKnowledgeGapStructuralRelevance
} from '../../src/knowledge/relevance';
import type { KnowledgeGap } from '../../src/knowledge/schema';

function gap(overrides: Partial<KnowledgeGap> = {}): KnowledgeGap {
  return {
    id: 'gap_base',
    kind: 'underexplored',
    territoryIds: ['identity'],
    dimensionIds: ['self-description'],
    sourceEvidenceIds: [],
    sourceJournalEntryIds: [],
    summary: 'Synthetic neutral summary.',
    status: 'open',
    priority: 70,
    ...overrides
  };
}

describe('Knowledge structural relevance (K03)', () => {
  it('adds bounded relevance only from open contradiction provenance overlap', () => {
    const subject = gap({
      sourceEvidenceIds: ['ev_shared']
    });

    const score = scoreKnowledgeGapStructuralRelevance(subject, {
      contradictions: [
        { status: 'open', evidenceIds: ['ev_other', 'ev_shared'] }
      ],
      confirmedChangeSourceIds: []
    });

    expect(score).toEqual({
      gapId: 'gap_base',
      basePriority: 70,
      contradictionRelevant: true,
      confirmedChangeRelevant: false,
      contradictionPoints: GAP_CONTRADICTION_RELEVANCE_POINTS,
      confirmedChangePoints: 0,
      effectivePriority: 80
    });
  });

  it('ignores reconciled contradictions and unrelated evidence', () => {
    const subject = gap({
      sourceEvidenceIds: ['ev_gap']
    });

    const score = scoreKnowledgeGapStructuralRelevance(subject, {
      contradictions: [
        { status: 'reconciled', evidenceIds: ['ev_gap', 'ev_other'] },
        { status: 'open', evidenceIds: ['ev_unrelated'] }
      ],
      confirmedChangeSourceIds: []
    });

    expect(score.contradictionRelevant).toBe(false);
    expect(score.contradictionPoints).toBe(0);
    expect(score.effectivePriority).toBe(70);
  });

  it('counts change relevance only from explicitly supplied confirmed source ids', () => {
    const subject = gap({
      sourceEvidenceIds: ['ev_1'],
      sourceJournalEntryIds: ['journal_1']
    });

    const unresolved = scoreKnowledgeGapStructuralRelevance(subject, {
      contradictions: [],
      confirmedChangeSourceIds: []
    });
    expect(unresolved.confirmedChangeRelevant).toBe(false);

    const confirmed = scoreKnowledgeGapStructuralRelevance(subject, {
      contradictions: [],
      confirmedChangeSourceIds: ['journal_1']
    });
    expect(confirmed.confirmedChangeRelevant).toBe(true);
    expect(confirmed.confirmedChangePoints).toBe(GAP_CONFIRMED_CHANGE_RELEVANCE_POINTS);
    expect(confirmed.effectivePriority).toBe(80);
  });

  it('can combine contradiction and explicitly confirmed change without changing the gap', () => {
    const subject = gap({
      sourceEvidenceIds: ['ev_shared'],
      sourceJournalEntryIds: ['journal_shared']
    });
    const before = structuredClone(subject);

    const score = scoreKnowledgeGapStructuralRelevance(subject, {
      contradictions: [
        { status: 'open', evidenceIds: ['ev_shared', 'ev_counter'] }
      ],
      confirmedChangeSourceIds: ['journal_shared']
    });

    expect(score.effectivePriority).toBe(
      70 + GAP_CONTRADICTION_RELEVANCE_POINTS + GAP_CONFIRMED_CHANGE_RELEVANCE_POINTS
    );
    expect(subject).toEqual(before);
  });

  it('never reads dramatic wording or gap kind as hidden importance', () => {
    const neutral = gap({
      id: 'gap_neutral',
      kind: 'unknown',
      summary: 'Ordinary neutral wording.'
    });
    const dramatic = gap({
      id: 'gap_dramatic',
      kind: 'change',
      summary: 'Catastrophic devastating agonizing crisis.'
    });

    const input = {
      contradictions: [],
      confirmedChangeSourceIds: []
    };

    expect(scoreKnowledgeGapStructuralRelevance(neutral, input).effectivePriority)
      .toBe(70);
    expect(scoreKnowledgeGapStructuralRelevance(dramatic, input).effectivePriority)
      .toBe(70);
  });

  it('reranks by structural relevance, then base priority, then stable id', () => {
    const strongBase = gap({
      id: 'gap_strong_base',
      priority: 80,
      sourceEvidenceIds: ['ev_none']
    });
    const contradiction = gap({
      id: 'gap_contradiction',
      priority: 75,
      sourceEvidenceIds: ['ev_contradiction']
    });
    const change = gap({
      id: 'gap_change',
      priority: 75,
      sourceJournalEntryIds: ['journal_change']
    });
    const retired = gap({
      id: 'gap_retired',
      status: 'retired',
      priority: 100,
      sourceEvidenceIds: ['ev_contradiction']
    });

    const ranked = rankKnowledgeGapsWithStructuralRelevance(
      [strongBase, change, retired, contradiction],
      {
        contradictions: [
          { status: 'open', evidenceIds: ['ev_contradiction', 'ev_counter'] }
        ],
        confirmedChangeSourceIds: ['journal_change']
      }
    );

    expect(ranked.map((item) => item.id)).toEqual([
      'gap_change',
      'gap_contradiction',
      'gap_strong_base'
    ]);
  });
});
