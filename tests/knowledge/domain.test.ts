import { describe, expect, it } from 'vitest';
import {
  knowledgeGapSourceIds,
  selectKnowledgeGapById,
  selectKnowledgeGapsByKind,
  selectKnowledgeGapsForDimension,
  selectKnowledgeGapsForTerritory,
  selectOpenKnowledgeGaps,
  selectRankedOpenKnowledgeGaps,
  retireKnowledgeGap,
  retireKnowledgeGapById
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

  it('retires an open gap without deleting or rewriting its history', () => {
    const original = gap({
      id: 'gap_retire',
      kind: 'curiosity',
      territoryIds: ['interests'],
      dimensionIds: ['curiosity'],
      sourceEvidenceIds: ['ev_1'],
      sourceJournalEntryIds: ['journal_1'],
      summary: 'Synthetic curiosity path.',
      priority: 82
    });

    const retired = retireKnowledgeGap(original);
    expect(retired).toEqual({ ...original, status: 'retired' });
    expect(original.status).toBe('open');
    expect(retired.sourceEvidenceIds).toEqual(['ev_1']);
    expect(retired.sourceJournalEntryIds).toEqual(['journal_1']);
    expect(retired.summary).toBe('Synthetic curiosity path.');
    expect(retired.priority).toBe(82);
  });

  it('retires a seeded path but refuses to relabel resolved history', () => {
    const seeded = gap({ id: 'gap_seeded', status: 'seeded' });
    expect(retireKnowledgeGap(seeded).status).toBe('retired');

    const resolved = gap({ id: 'gap_resolved', status: 'resolved' });
    expect(() => retireKnowledgeGap(resolved))
      .toThrow('is resolved and cannot be retired as an exploration preference');
  });

  it('retires by stable id without mutating sibling gaps or caller order', () => {
    const a = gap({ id: 'gap_a', summary: 'A' });
    const b = gap({ id: 'gap_b', summary: 'B' });
    const source = [a, b];
    const next = retireKnowledgeGapById(source, 'gap_b');

    expect(next.map((item) => item.id)).toEqual(['gap_a', 'gap_b']);
    expect(next[0]).toBe(a);
    expect(next[1]).toEqual({ ...b, status: 'retired' });
    expect(source[1].status).toBe('open');
    expect(() => retireKnowledgeGapById(source, 'missing'))
      .toThrow('Unknown KnowledgeGap id: missing');
  });

  it('is idempotent for an already-retired gap and keeps it out of open ranking', () => {
    const retired = gap({ id: 'gap_retired', status: 'retired', priority: 100 });
    expect(retireKnowledgeGap(retired)).toBe(retired);
    expect(selectOpenKnowledgeGaps([retired])).toEqual([]);
    expect(selectRankedOpenKnowledgeGaps([retired])).toEqual([]);
  });
});
