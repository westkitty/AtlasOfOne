import { describe, expect, it } from 'vitest';
import type { AdventureSeed, KnowledgeGap } from '../../src/contracts';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { WORLD } from '../../src/world/geography';
import { selectAdventureWorldMarkers } from '../../src/world/adventureMarkers';
import { worldMarkerId } from '../../src/world/markers';

const AT = '2026-09-22T05:00:00.000Z';

function campaign(overrides: Partial<CampaignState> = {}): CampaignState {
  const base = createInitialCampaign();
  return {
    ...base,
    player: { id: 'synthetic-player', displayName: 'Synthetic Player', pronouns: 'they/them' },
    knowledgeGaps: [],
    adventureSeeds: [],
    adventureRuns: [],
    privateTopics: [],
    updatedAt: AT,
    ...overrides
  };
}

function gap(id: string, dimension = 'synthetic-safe', status: KnowledgeGap['status'] = 'seeded'): KnowledgeGap {
  return {
    id,
    kind: 'underexplored',
    territoryIds: ['identity'],
    dimensionIds: [dimension],
    sourceEvidenceIds: [],
    sourceJournalEntryIds: [],
    summary: 'HIDDEN_GAP_SUMMARY_CANARY',
    status,
    priority: 77
  };
}

function seed(
  id: string,
  sourceGapIds: string[],
  options: Partial<AdventureSeed> = {}
): AdventureSeed {
  return {
    id,
    sourceGapIds,
    kind: 'investigation',
    territoryId: 'identity',
    locationId: 'identity',
    premise: 'HIDDEN_SEED_PREMISE_CANARY',
    learningTarget: 'reflection-eligible',
    status: 'available',
    ...options
  };
}

describe('W02 deterministic available-seed world marker state', () => {
  it('projects only A00-selected available/unused/private-safe seeds into public marker state', () => {
    const safe = gap('gap-safe');
    const privateGap = gap('gap-private', 'private-dimension');
    const safeSeed = seed('seed-safe', [safe.id]);
    const started = seed('seed-started', [safe.id], { status: 'started' });
    const retired = seed('seed-retired', [safe.id], { status: 'retired' });
    const used = seed('seed-used', [safe.id]);
    const privateSeed = seed('seed-private', [privateGap.id]);
    const unknownTerritory = seed('seed-unknown-territory', [safe.id], { territoryId: 'nowhere', locationId: 'nowhere' });

    const state = campaign({
      privateTopics: ['private-dimension'],
      knowledgeGaps: [safe, privateGap],
      adventureSeeds: [safeSeed, started, retired, used, privateSeed, unknownTerritory],
      adventureRuns: [{
        id: 'run-used', seedId: used.id, territoryId: 'identity', locationId: 'identity', status: 'complete',
        currentBeatId: 'consequence', recurringCharacterIds: [], memoryIds: [], startedAt: AT, completedAt: AT
      }]
    });

    expect(selectAdventureWorldMarkers(state).map((marker) => marker.seedId)).toEqual(['seed-safe']);
  });

  it('keeps every ordinary Adventure category hidden behind generic Adventure and exposes pure fun only', () => {
    const first = gap('gap-first');
    const second = gap('gap-second');
    const state = campaign({
      knowledgeGaps: [first, second],
      adventureSeeds: [
        seed('seed-investigation', [first.id], { kind: 'investigation' }),
        seed('seed-mystery', [second.id], { kind: 'mystery-puzzle', territoryId: 'values', locationId: 'values' }),
        seed('seed-fun', [], { kind: 'pure-fun-wildcard', learningTarget: 'none', territoryId: 'interests', locationId: 'interests' })
      ]
    });

    const markers = selectAdventureWorldMarkers(state);
    expect(markers.map(({ seedId, kind, label, ariaLabel }) => [seedId, kind, label, ariaLabel])).toEqual([
      ['seed-fun', 'pure-fun', 'Just for fun', 'Pure fun event'],
      ['seed-investigation', 'adventure', 'Adventure', 'Adventure opportunity'],
      ['seed-mystery', 'adventure', 'Adventure', 'Adventure opportunity']
    ]);
  });

  it('never leaks premise, source-gap, priority, summary, evidence, Journal, or private prose into marker state', () => {
    const safe = gap('SECRET_GAP_ID_CANARY');
    const state = campaign({
      knowledgeGaps: [safe],
      journalEntries: [{
        id: 'journal-canary', createdAt: AT, text: 'PRIVATE_JOURNAL_TEXT_CANARY', inputMode: 'typed',
        privacy: 'normal', status: 'active', reflectionIds: [], adventureIds: []
      }],
      adventureSeeds: [seed('seed-public-id', [safe.id], { premise: 'SECRET_PREMISE_TEXT_CANARY' })]
    });

    const serialized = JSON.stringify(selectAdventureWorldMarkers(state));
    expect(serialized).toContain('seed-public-id');
    expect(serialized).not.toContain('SECRET_GAP_ID_CANARY');
    expect(serialized).not.toContain('HIDDEN_GAP_SUMMARY_CANARY');
    expect(serialized).not.toContain('SECRET_PREMISE_TEXT_CANARY');
    expect(serialized).not.toContain('PRIVATE_JOURNAL_TEXT_CANARY');
    expect(serialized).not.toContain('77');
  });

  it('is deterministic across source ordering and leaves CampaignState byte-for-byte unchanged', () => {
    const first = gap('gap-a');
    const second = gap('gap-b');
    const seeds = [seed('seed-b', [second.id]), seed('seed-a', [first.id])];
    const a = campaign({ knowledgeGaps: [first, second], adventureSeeds: seeds });
    const b = campaign({ knowledgeGaps: [second, first], adventureSeeds: [...seeds].reverse() });
    const beforeA = structuredClone(a);
    const beforeB = structuredClone(b);

    const markersA = selectAdventureWorldMarkers(a);
    const markersB = selectAdventureWorldMarkers(b);
    expect(markersA).toEqual(markersB);
    expect(a).toEqual(beforeA);
    expect(b).toEqual(beforeB);
  });

  it('gives same-territory seeds deterministic distinct bounded coordinates around canonical geography', () => {
    const gaps = Array.from({ length: 4 }, (_, index) => gap(`gap-${index}`));
    const state = campaign({
      knowledgeGaps: gaps,
      adventureSeeds: gaps.map((item, index) => seed(`seed-${index}`, [item.id]))
    });

    const markers = selectAdventureWorldMarkers(state);
    expect(markers).toHaveLength(4);
    const coordinateKeys = markers.map((marker) => `${marker.x},${marker.y}`);
    expect(new Set(coordinateKeys).size).toBe(markers.length);
    for (const marker of markers) {
      expect(marker.territoryId).toBe('identity');
      expect(marker.x).toBeGreaterThanOrEqual(14);
      expect(marker.x).toBeLessThanOrEqual(WORLD.width - 14);
      expect(marker.y).toBeGreaterThanOrEqual(14);
      expect(marker.y).toBeLessThanOrEqual(WORLD.height - 14);
    }
  });

  it('uses W01 collision-safe marker identity and returns no separate persisted marker authority', () => {
    const safe = gap('gap-safe');
    const state = campaign({ knowledgeGaps: [safe], adventureSeeds: [seed('seed/a:b', [safe.id])] });
    const [marker] = selectAdventureWorldMarkers(state);
    expect(marker.id).toBe(worldMarkerId('adventure', 'seed/a:b'));
    expect(marker.id).toContain('world-marker:');
    expect(marker).not.toHaveProperty('premise');
    expect(marker).not.toHaveProperty('sourceGapIds');
    expect(marker).not.toHaveProperty('status');
    expect(marker).not.toHaveProperty('locationId');
  });
});
