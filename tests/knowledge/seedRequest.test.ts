import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { createJournalEntry } from '../../src/journal/domain';
import type { KnowledgeGap } from '../../src/knowledge/schema';
import {
  adventureSeedRequestSchema,
  buildAdventureSeedRequest,
  type AdventureSeedRequestInput
} from '../../src/knowledge/seedRequest';

const NOW = '2026-03-01T00:00:00.000Z';

const baseInput: AdventureSeedRequestInput = {
  now: NOW,
  lastExploredAtByTerritory: {},
  confirmedChangeSourceIds: [],
  history: []
};

function gap(overrides: Partial<KnowledgeGap> & { id: string }): KnowledgeGap {
  return {
    kind: 'underexplored',
    territoryIds: ['alpha'],
    dimensionIds: ['a1'],
    sourceEvidenceIds: [],
    sourceJournalEntryIds: [],
    summary: 'Synthetic gap.',
    status: 'open',
    priority: 0,
    ...overrides
  };
}

function journal(id: string, privacy: 'normal' | 'private', status: 'active' | 'retracted' = 'active') {
  return {
    ...createJournalEntry({
      id,
      createdAt: '2026-01-02T03:04:05.000Z',
      text: 'Synthetic K07 source.',
      inputMode: 'typed'
    }),
    privacy,
    status
  };
}

function state(gaps: KnowledgeGap[], extra: Partial<CampaignState> = {}): CampaignState {
  const initial = createInitialCampaign();
  return {
    ...initial,
    territories: [
      { id: 'alpha', label: 'Alpha', status: 'available', requiredDimensions: ['a1', 'a2'], coveredDimensions: [], evidenceIds: [] },
      { id: 'beta', label: 'Beta', status: 'available', requiredDimensions: ['b1', 'b2'], coveredDimensions: ['b1'], evidenceIds: [] }
    ] as CampaignState['territories'],
    knowledgeGaps: gaps,
    ...extra
  };
}

describe('KnowledgeGap -> AdventureSeed request (K07)', () => {
  it('matches the frozen request schema snapshot', () => {
    const request = buildAdventureSeedRequest(
      state([gap({ id: 'gap_a' }), gap({ id: 'gap_b', territoryIds: ['beta'], dimensionIds: ['b2'] })]),
      baseInput
    );
    expect(request).toMatchInlineSnapshot(`
      {
        "dimensionIds": [
          "a1",
        ],
        "excludedGapIds": [],
        "gapId": "gap_a",
        "kind": "investigation",
        "learningTarget": "reflection-eligible",
        "requestVersion": 1,
        "scoring": {
          "basePriority": 100,
          "exactRepeatCoolingDown": false,
          "rankedPriority": 100,
          "relevancePoints": 0,
        },
        "sourceGapIds": [
          "gap_a",
        ],
        "territoryId": "alpha",
      }
    `);
    expect(Object.keys(adventureSeedRequestSchema.shape).sort()).toEqual([
      'dimensionIds', 'excludedGapIds', 'gapId', 'kind', 'learningTarget',
      'requestVersion', 'scoring', 'sourceGapIds', 'territoryId'
    ]);
  });

  it('is deterministic for identical input', () => {
    const s = state([gap({ id: 'gap_b' }), gap({ id: 'gap_a' })]);
    expect(buildAdventureSeedRequest(s, baseInput)).toEqual(buildAdventureSeedRequest(s, baseInput));
    expect(buildAdventureSeedRequest(s, baseInput)?.gapId).toBe('gap_a');
  });

  it('PRIVACY CANARY: a PRIVATE-only gap never produces a seed request', () => {
    const s = state(
      [gap({ id: 'gap_private', sourceJournalEntryIds: ['j_private'], priority: 999 })],
      { journalEntries: [journal('j_private', 'private')] }
    );
    expect(buildAdventureSeedRequest(s, baseInput)).toBeNull();
  });

  it('PRIVACY CANARY: a retracted-only gap never produces a seed request', () => {
    const s = state(
      [gap({ id: 'gap_retracted', sourceJournalEntryIds: ['j_r'] })],
      { journalEntries: [journal('j_r', 'normal', 'retracted')] }
    );
    expect(buildAdventureSeedRequest(s, baseInput)).toBeNull();
  });

  it('excludes private gaps BEFORE selection even when they would outrank', () => {
    const s = state(
      [
        gap({ id: 'gap_private', sourceJournalEntryIds: ['j_private'] }),
        gap({ id: 'gap_public', territoryIds: ['beta'], dimensionIds: ['b2'] })
      ],
      { journalEntries: [journal('j_private', 'private')] }
    );
    const request = buildAdventureSeedRequest(s, baseInput);
    expect(request?.gapId).toBe('gap_public');
    expect(request?.excludedGapIds).toEqual(['gap_private']);
    expect(JSON.stringify(request)).not.toContain('Synthetic gap.');
  });

  it('never selects retired (K06), seeded or resolved gaps', () => {
    const s = state([
      gap({ id: 'gap_retired', status: 'retired' }),
      gap({ id: 'gap_seeded', status: 'seeded' }),
      gap({ id: 'gap_resolved', status: 'resolved' })
    ]);
    expect(buildAdventureSeedRequest(s, baseInput)).toBeNull();
  });

  it('ignores stored priority and summary prose; K01 scores from territory state', () => {
    const s = state([
      gap({ id: 'gap_dramatic', territoryIds: ['beta'], dimensionIds: ['b2'], priority: 1000, summary: 'Terrible painful trauma crisis.' }),
      gap({ id: 'gap_plain', summary: 'Mild.' })
    ]);
    expect(buildAdventureSeedRequest(s, baseInput)?.gapId).toBe('gap_plain');
  });

  it('adds K03 structural relevance from an open contradiction', () => {
    const s = state(
      [
        gap({ id: 'gap_a' }),
        gap({ id: 'gap_b', dimensionIds: ['a2'], sourceEvidenceIds: ['ev_1'] })
      ],
      {
        contradictions: [{ id: 'c1', claim: 'x', evidenceIds: ['ev_1'], status: 'open' }],
        evidence: [{
          id: 'ev_1', dimension: 'b2', claim: 'Synthetic.', sourceTurnIds: [], basis: 'direct',
          strength: 1, territories: ['beta'], counterEvidenceIds: [], status: 'active', origin: 'turn'
        }] as unknown as CampaignState['evidence']
      }
    );
    const request = buildAdventureSeedRequest(s, baseInput);
    expect(request?.gapId).toBe('gap_b');
    expect(request?.scoring).toMatchObject({ basePriority: 100, relevancePoints: 10, rankedPriority: 110 });
  });

  it('applies K04 cooldown so a just-selected gap yields to another', () => {
    const s = state([gap({ id: 'gap_a' }), gap({ id: 'gap_b', territoryIds: ['beta'], dimensionIds: ['b2'] })]);
    const request = buildAdventureSeedRequest(s, {
      ...baseInput,
      history: [{ gapId: 'gap_a', territoryIds: ['alpha'], themeIds: ['a1'] }]
    });
    expect(request?.gapId).toBe('gap_b');
  });

  it('rejects the pure-fun kind for gap-derived requests', () => {
    const s = state([gap({ id: 'gap_a' })]);
    expect(() => buildAdventureSeedRequest(s, { ...baseInput, kind: 'pure-fun' })).toThrow(/pure-fun/);
    expect(buildAdventureSeedRequest(s, { ...baseInput, kind: 'social-dilemma' })?.kind).toBe('social-dilemma');
  });

  it('does not mutate state', () => {
    const s = state([gap({ id: 'gap_a' })]);
    const before = structuredClone(s);
    buildAdventureSeedRequest(s, baseInput);
    expect(s).toEqual(before);
  });
});
