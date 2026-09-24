import { describe, expect, it } from 'vitest';
import {
  GAP_DIVERSITY_NOVELTY_WEIGHT,
  GAP_DIVERSITY_RELEVANCE_WEIGHT,
  GAP_EXACT_REPEAT_COOLDOWN_SELECTIONS,
  rankKnowledgeGapsWithDiversity,
  scoreKnowledgeGapDiversity,
  type KnowledgeSelectionHistoryItem
} from '../../src/knowledge/diversity';
import type { KnowledgeGap } from '../../src/knowledge/schema';

const gap = (overrides: Partial<KnowledgeGap>): KnowledgeGap => ({
  id: 'gap_default',
  kind: 'underexplored',
  territoryIds: ['identity'],
  dimensionIds: ['self-description'],
  sourceEvidenceIds: [],
  sourceJournalEntryIds: [],
  summary: 'Synthetic gap.',
  status: 'open',
  priority: 50,
  ...overrides
});

const history = (
  gapId: string,
  territoryIds: string[],
  themeIds: string[]
): KnowledgeSelectionHistoryItem => ({ gapId, territoryIds, themeIds });

describe('Knowledge Gap diversity/cooldown reranking (K04)', () => {
  it('freezes a transparent relevance-first reranking contract', () => {
    expect(GAP_EXACT_REPEAT_COOLDOWN_SELECTIONS).toBe(3);
    expect(GAP_DIVERSITY_RELEVANCE_WEIGHT).toBe(0.8);
    expect(GAP_DIVERSITY_NOVELTY_WEIGHT).toBe(0.2);
    expect(GAP_DIVERSITY_RELEVANCE_WEIGHT + GAP_DIVERSITY_NOVELTY_WEIGHT).toBe(1);
  });

  it('keeps base priority unchanged and applies only a bounded novelty penalty', () => {
    const candidate = gap({ id: 'gap_values', priority: 80, territoryIds: ['values'], dimensionIds: ['autonomy'] });
    const score = scoreKnowledgeGapDiversity(candidate, [
      history('other', ['values'], ['autonomy'])
    ]);

    expect(score.basePriority).toBe(80);
    expect(score.maxRecentSimilarity).toBe(1);
    expect(score.effectivePriority).toBe(44);
    expect(candidate.priority).toBe(80);
  });

  it('ranks an exact recently selected gap behind a non-cooled alternative', () => {
    const repeated = gap({ id: 'gap_repeat', priority: 100 });
    const alternative = gap({
      id: 'gap_other',
      priority: 25,
      territoryIds: ['values'],
      dimensionIds: ['autonomy']
    });

    expect(rankKnowledgeGapsWithDiversity([repeated, alternative], [
      history('gap_repeat', ['identity'], ['self-description'])
    ]).map((item) => item.id)).toEqual(['gap_other', 'gap_repeat']);
  });

  it('lets an unresolved exact gap return after the short cooldown expires', () => {
    const repeated = gap({ id: 'gap_repeat', priority: 100 });
    const alternative = gap({ id: 'gap_other', priority: 30, territoryIds: ['values'], dimensionIds: ['autonomy'] });

    const oldRepeat = [
      history('gap_1', ['future'], ['planning']),
      history('gap_2', ['relationships'], ['trust']),
      history('gap_3', ['interests'], ['curiosity']),
      history('gap_repeat', ['identity'], ['self-description'])
    ];

    expect(rankKnowledgeGapsWithDiversity([repeated, alternative], oldRepeat)[0].id)
      .toBe('gap_repeat');
  });

  it('uses recency decay so yesterday-like repetition matters more than older repetition', () => {
    const candidate = gap({ id: 'gap_candidate', priority: 70 });

    const newest = scoreKnowledgeGapDiversity(candidate, [
      history('x', ['identity'], ['self-description'])
    ]);
    const older = scoreKnowledgeGapDiversity(candidate, [
      history('x1', ['values'], ['autonomy']),
      history('x2', ['identity'], ['self-description'])
    ]);

    expect(newest.maxRecentSimilarity).toBe(1);
    expect(older.maxRecentSimilarity).toBe(0.5);
    expect(older.effectivePriority).toBeGreaterThan(newest.effectivePriority);
  });

  it('diversifies a long synthetic sequence without changing gap content or priority', () => {
    const gaps = [
      gap({ id: 'identity_1', priority: 92, territoryIds: ['identity'], dimensionIds: ['self-description'] }),
      gap({ id: 'identity_2', priority: 88, territoryIds: ['identity'], dimensionIds: ['temperament'] }),
      gap({ id: 'values_1', priority: 84, territoryIds: ['values'], dimensionIds: ['autonomy'] }),
      gap({ id: 'relationships_1', priority: 82, territoryIds: ['relationships'], dimensionIds: ['trust'] }),
      gap({ id: 'future_1', priority: 78, territoryIds: ['future'], dimensionIds: ['planning'] })
    ];

    const original = gaps.map((item) => structuredClone(item));
    const recent: KnowledgeSelectionHistoryItem[] = [];
    const picks: string[] = [];

    for (let index = 0; index < 12; index += 1) {
      const selected = rankKnowledgeGapsWithDiversity(gaps, recent)[0];
      picks.push(selected.id);
      recent.unshift(history(selected.id, selected.territoryIds, selected.dimensionIds));
      recent.splice(5);
    }

    // No immediate exact-repeat loop and more than one territory survives selection.
    for (let index = 1; index < picks.length; index += 1) {
      expect(picks[index]).not.toBe(picks[index - 1]);
    }
    expect(new Set(picks).size).toBeGreaterThanOrEqual(4);
    expect(gaps).toEqual(original);
  });

  it('falls back deterministically instead of returning nothing when every candidate is cooling down', () => {
    const a = gap({ id: 'a', priority: 60 });
    const b = gap({ id: 'b', priority: 55, territoryIds: ['values'], dimensionIds: ['autonomy'] });

    const ranked = rankKnowledgeGapsWithDiversity([b, a], [
      history('a', ['identity'], ['self-description']),
      history('b', ['values'], ['autonomy'])
    ]);

    expect(ranked.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('ignores dramatic prose and gap kind when structural inputs are otherwise equal', () => {
    const ordinary = gap({ id: 'a', kind: 'unknown', summary: 'Ordinary.', priority: 50 });
    const dramatic = gap({
      id: 'b',
      kind: 'contradiction',
      summary: 'Trauma pain vulnerability dramatic language.',
      priority: 50
    });

    const ranked = rankKnowledgeGapsWithDiversity([dramatic, ordinary], []);
    expect(ranked.map((item) => item.id)).toEqual(['a', 'b']);
  });

  it('excludes retired/seeded/resolved gaps from diversity selection', () => {
    const ranked = rankKnowledgeGapsWithDiversity([
      gap({ id: 'open', status: 'open' }),
      gap({ id: 'seeded', status: 'seeded', priority: 100 }),
      gap({ id: 'resolved', status: 'resolved', priority: 100 }),
      gap({ id: 'retired', status: 'retired', priority: 100 })
    ], []);

    expect(ranked.map((item) => item.id)).toEqual(['open']);
  });
});
