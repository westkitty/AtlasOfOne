import { describe, expect, it } from 'vitest';
import {
  GAP_AGE_SATURATION_DAYS,
  GAP_AGE_WEIGHT,
  GAP_UNDERCOVERAGE_WEIGHT,
  scoreKnowledgeGap,
  withKnowledgeGapScore
} from '../../src/knowledge/scoring';
import type { KnowledgeGap } from '../../src/knowledge/schema';

const gap = (overrides: Partial<KnowledgeGap> = {}): KnowledgeGap => ({
  id: 'gap_fixture',
  kind: 'unknown',
  territoryIds: ['identity'],
  dimensionIds: ['self-description'],
  sourceEvidenceIds: [],
  sourceJournalEntryIds: [],
  summary: 'Synthetic gap.',
  status: 'open',
  priority: 999,
  ...overrides
});

const territory = (
  id: string,
  requiredDimensions: string[],
  coveredDimensions: string[]
) => ({ id, requiredDimensions, coveredDimensions });

const NOW = '2026-09-23T12:00:00.000Z';

describe('Knowledge Gap undercoverage + age scoring (K01)', () => {
  it('freezes a transparent 70/30 bounded score contract', () => {
    expect(GAP_UNDERCOVERAGE_WEIGHT).toBe(70);
    expect(GAP_AGE_WEIGHT).toBe(30);
    expect(GAP_AGE_SATURATION_DAYS).toBe(30);
  });

  it('scores a completely uncovered never-explored territory at 100', () => {
    expect(scoreKnowledgeGap(gap(), {
      territories: [territory('identity', ['a', 'b'], [])],
      lastExploredAtByTerritory: {},
      now: NOW
    })).toEqual({
      undercoverageRatio: 1,
      ageRatio: 1,
      undercoveragePoints: 70,
      agePoints: 30,
      total: 100
    });
  });

  it('scores fully covered just-explored territory at zero', () => {
    expect(scoreKnowledgeGap(gap(), {
      territories: [territory('identity', ['a', 'b'], ['a', 'b'])],
      lastExploredAtByTerritory: { identity: NOW },
      now: NOW
    }).total).toBe(0);
  });

  it('combines half undercoverage with half-saturated age deterministically', () => {
    const fifteenDaysEarlier = '2026-09-08T12:00:00.000Z';
    const score = scoreKnowledgeGap(gap(), {
      territories: [territory('identity', ['a', 'b'], ['a'])],
      lastExploredAtByTerritory: { identity: fifteenDaysEarlier },
      now: NOW
    });

    expect(score.undercoverageRatio).toBe(0.5);
    expect(score.ageRatio).toBe(0.5);
    expect(score.undercoveragePoints).toBe(35);
    expect(score.agePoints).toBe(15);
    expect(score.total).toBe(50);
  });

  it('caps old exploration at the age ceiling and future timestamps at zero', () => {
    expect(scoreKnowledgeGap(gap(), {
      territories: [territory('identity', ['a'], ['a'])],
      lastExploredAtByTerritory: { identity: '2020-01-01T00:00:00.000Z' },
      now: NOW
    }).agePoints).toBe(30);

    expect(scoreKnowledgeGap(gap(), {
      territories: [territory('identity', ['a'], ['a'])],
      lastExploredAtByTerritory: { identity: '2026-09-24T12:00:00.000Z' },
      now: NOW
    }).agePoints).toBe(0);
  });

  it('averages multi-territory factors instead of rewarding gap breadth', () => {
    const score = scoreKnowledgeGap(gap({ territoryIds: ['identity', 'values'] }), {
      territories: [
        territory('identity', ['a', 'b'], []),
        territory('values', ['c', 'd'], ['c', 'd'])
      ],
      lastExploredAtByTerritory: {
        identity: '2026-08-01T00:00:00.000Z',
        values: NOW
      },
      now: NOW
    });

    expect(score.undercoverageRatio).toBe(0.5);
    expect(score.ageRatio).toBe(0.5);
    expect(score.total).toBe(50);
  });

  it('does not let duplicate territory IDs multiply their weight', () => {
    const one = scoreKnowledgeGap(gap({ territoryIds: ['identity'] }), {
      territories: [territory('identity', ['a', 'b'], ['a'])],
      lastExploredAtByTerritory: { identity: '2026-09-08T12:00:00.000Z' },
      now: NOW
    });
    const duplicated = scoreKnowledgeGap(gap({ territoryIds: ['identity', 'identity'] }), {
      territories: [territory('identity', ['a', 'b'], ['a'])],
      lastExploredAtByTerritory: { identity: '2026-09-08T12:00:00.000Z' },
      now: NOW
    });

    expect(duplicated).toEqual(one);
  });

  it('does not let kind or prose change the score for identical structural inputs', () => {
    const input = {
      territories: [territory('identity', ['a', 'b'], ['a'])],
      lastExploredAtByTerritory: { identity: '2026-09-08T12:00:00.000Z' },
      now: NOW
    };

    const ordinary = scoreKnowledgeGap(gap({ kind: 'unknown', summary: 'Ordinary.' }), input);
    const dramatic = scoreKnowledgeGap(gap({
      id: 'gap_dramatic',
      kind: 'contradiction',
      summary: 'Painful dramatic trauma wording that must not earn priority.'
    }), input);

    expect(dramatic).toEqual(ordinary);
  });

  it('fails closed on unknown territories or invalid timestamps', () => {
    expect(() => scoreKnowledgeGap(gap({ territoryIds: ['missing'] }), {
      territories: [territory('identity', ['a'], [])],
      lastExploredAtByTerritory: {},
      now: NOW
    })).toThrow('Unknown KnowledgeGap territory: missing');

    expect(() => scoreKnowledgeGap(gap(), {
      territories: [territory('identity', ['a'], [])],
      lastExploredAtByTerritory: { identity: 'not-a-date' },
      now: NOW
    })).toThrow('Invalid lastExploredAt for identity: not-a-date');
  });

  it('returns zero for a gap with no territory rather than inventing urgency', () => {
    expect(scoreKnowledgeGap(gap({ territoryIds: [] }), {
      territories: [],
      lastExploredAtByTerritory: {},
      now: NOW
    }).total).toBe(0);
  });

  it('writes only priority when applying the score to a gap', () => {
    const original = gap({ priority: 123 });
    const scored = withKnowledgeGapScore(original, {
      territories: [territory('identity', ['a', 'b'], ['a'])],
      lastExploredAtByTerritory: { identity: '2026-09-08T12:00:00.000Z' },
      now: NOW
    });

    expect(scored).toEqual({ ...original, priority: 50 });
    expect(original.priority).toBe(123);
  });
});
