import { describe, expect, it } from 'vitest';
import {
  compareKnowledgeGapBaseScores,
  scoreKnowledgeGapAge,
  scoreKnowledgeGapBase,
  scoreKnowledgeGapUndercoverage
} from '../../src/knowledge/domain';
import type { KnowledgeGap } from '../../src/knowledge/schema';

const gap = (overrides: Partial<KnowledgeGap> = {}): KnowledgeGap => ({
  id: 'gap_base',
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

describe('Knowledge Gap base scoring (K01)', () => {
  it('scores undercoverage from unique target dimensions only', () => {
    const scored = scoreKnowledgeGapUndercoverage(
      gap({ dimensionIds: ['self-description', 'temperament', 'temperament'] }),
      ['self-description', 'unrelated']
    );

    expect(scored).toEqual({
      targetDimensionCount: 2,
      missingDimensionCount: 1,
      missingDimensionIds: ['temperament'],
      ratio: 0.5
    });
  });

  it('keeps never-explored distinct from a fabricated large age', () => {
    expect(scoreKnowledgeGapAge('2026-09-23T12:00:00.000Z')).toEqual({
      neverExplored: true,
      daysSinceLastExploration: null
    });
  });

  it('uses whole deterministic elapsed days and clamps future clock drift to zero', () => {
    expect(scoreKnowledgeGapAge(
      '2026-09-23T12:00:00.000Z',
      '2026-09-20T11:59:59.000Z'
    )).toEqual({
      neverExplored: false,
      daysSinceLastExploration: 3
    });

    expect(scoreKnowledgeGapAge(
      '2026-09-23T12:00:00.000Z',
      '2026-09-24T12:00:00.000Z'
    )).toEqual({
      neverExplored: false,
      daysSinceLastExploration: 0
    });
  });

  it('fails explicit invalid timestamps instead of consulting wall-clock time', () => {
    expect(() => scoreKnowledgeGapAge('not-a-date')).toThrow('Invalid now timestamp');
    expect(() => scoreKnowledgeGapAge('2026-09-23T12:00:00.000Z', 'bad'))
      .toThrow('Invalid last exploration timestamp');
  });

  it('orders by undercoverage first, then age, then stable ID without weighted guesswork', () => {
    const now = '2026-09-23T12:00:00.000Z';
    const fullyMissing = scoreKnowledgeGapBase(
      gap({ id: 'gap_missing', dimensionIds: ['a'] }),
      { coveredDimensionIds: [], now, lastExploredAt: '2026-09-22T12:00:00.000Z' }
    );
    const halfMissingOld = scoreKnowledgeGapBase(
      gap({ id: 'gap_half', dimensionIds: ['a', 'b'] }),
      { coveredDimensionIds: ['a'], now, lastExploredAt: '2026-01-01T00:00:00.000Z' }
    );
    const neverExploredA = scoreKnowledgeGapBase(
      gap({ id: 'gap_a', dimensionIds: ['a'] }),
      { coveredDimensionIds: ['a'], now }
    );
    const neverExploredB = scoreKnowledgeGapBase(
      gap({ id: 'gap_b', dimensionIds: ['a'] }),
      { coveredDimensionIds: ['a'], now }
    );

    expect([halfMissingOld, neverExploredB, fullyMissing, neverExploredA]
      .sort(compareKnowledgeGapBaseScores)
      .map((item) => item.gapId))
      .toEqual(['gap_missing', 'gap_half', 'gap_a', 'gap_b']);
  });

  it('does not score dramatic wording or gap kind', () => {
    const context = {
      coveredDimensionIds: [] as string[],
      now: '2026-09-23T12:00:00.000Z',
      lastExploredAt: '2026-09-20T12:00:00.000Z'
    };
    const ordinary = scoreKnowledgeGapBase(
      gap({ id: 'ordinary', kind: 'unknown', summary: 'A plain synthetic unknown.' }),
      context
    );
    const dramatic = scoreKnowledgeGapBase(
      gap({ id: 'dramatic', kind: 'contradiction', summary: 'PAIN TRAUMA CRISIS DRAMA' }),
      context
    );

    expect(dramatic.undercoverage).toEqual(ordinary.undercoverage);
    expect(dramatic.age).toEqual(ordinary.age);
  });
});
