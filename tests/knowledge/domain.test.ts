import { describe, expect, it } from 'vitest';
import {
  knowledgeGapSourceIds,
  selectKnowledgeGapById,
  selectKnowledgeGapsByKind,
  selectKnowledgeGapsForDimension,
  selectKnowledgeGapsForTerritory,
  selectOpenKnowledgeGaps,
  selectRankedOpenKnowledgeGaps
} from '../../src/knowledge/domain';
import type { KnowledgeGap } from '../../src/knowledge/schema';

const gap = (overrides: Partial<KnowledgeGap>): KnowledgeGap => ({
  id: 'gap_default',
  kind: 'unknown',
  territoryIds: ['identity'],
  dimensionIds: ['self-description'],
  sourceEvidenceIds: [],
  sourceJournalEntryIds: [],
  summary: 'Synthetic gap.',
  status: 'open',
  priority: 0,
  ...overrides
});

describe('Knowledge Gap deterministic selectors (K00)', () => {
  const gaps = [
    gap({ id: 'gap_b', kind: 'underexplored', territoryIds: ['values'], dimensionIds: ['autonomy'], priority: 5 }),
    gap({ id: 'gap_a', kind: 'curiosity', territoryIds: ['identity', 'values'], dimensionIds: ['self-description'], priority: 5 }),
    gap({ id: 'gap_c', kind: 'unknown', territoryIds: ['identity'], dimensionIds: ['temperament'], priority: 9, status: 'retired' }),
    gap({ id: 'gap_d', kind: 'contradiction', territoryIds: ['relationships'], dimensionIds: ['trust'], priority: 7 })
  ];

  it('selects by stable ID without inventing fallback gaps', () => {
    expect(selectKnowledgeGapById(gaps, 'gap_a')?.kind).toBe('curiosity');
    expect(selectKnowledgeGapById(gaps, 'missing')).toBeUndefined();
  });

  it('keeps status filtering distinct from territory/dimension/kind filtering', () => {
    expect(selectOpenKnowledgeGaps(gaps).map((item) => item.id))
      .toEqual(['gap_b', 'gap_a', 'gap_d']);
    expect(selectKnowledgeGapsForTerritory(gaps, 'identity').map((item) => item.id))
      .toEqual(['gap_a', 'gap_c']);
    expect(selectKnowledgeGapsForDimension(gaps, 'trust').map((item) => item.id))
      .toEqual(['gap_d']);
    expect(selectKnowledgeGapsByKind(gaps, 'underexplored').map((item) => item.id))
      .toEqual(['gap_b']);
  });

  it('ranks already-scored open gaps deterministically by priority then ID', () => {
    expect(selectRankedOpenKnowledgeGaps(gaps).map((item) => item.id))
      .toEqual(['gap_d', 'gap_a', 'gap_b']);
  });

  it('does not mutate caller order while ranking', () => {
    const ids = gaps.map((item) => item.id);
    selectRankedOpenKnowledgeGaps(gaps);
    expect(gaps.map((item) => item.id)).toEqual(ids);
  });

  it('exposes provenance IDs without pretending to decide privacy eligibility', () => {
    const sourced = gap({
      sourceEvidenceIds: ['ev_1', 'ev_2'],
      sourceJournalEntryIds: ['journal_1']
    });
    expect(knowledgeGapSourceIds(sourced)).toEqual(['ev_1', 'ev_2', 'journal_1']);
  });
});
