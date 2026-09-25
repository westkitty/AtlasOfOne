import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';

const V2_COLLECTIONS = [
  'journalEntries',
  'knowledgeGaps',
  'adventureSeeds',
  'adventureRuns',
  'adventureActions',
  'adventureObservations',
  'reflections',
  'adventureMemories',
  'atlasSnapshots'
] as const;

describe('campaign transfer', () => {
  it('round-trips schema v2 without semantic loss', () => {
    const state = createInitialCampaign();
    expect(state.schemaVersion).toBe(2);
    expect(deserializeCampaign(serializeCampaign(state))).toEqual(state);
  });

  it('migrates an older schema-v1 campaign and fills legacy additive defaults safely', () => {
    const legacy = { ...createInitialCampaign(), schemaVersion: 1 } as any;
    for (const field of V2_COLLECTIONS) delete legacy[field];
    delete legacy.worldJourney;

    const restored = deserializeCampaign(JSON.stringify(legacy));

    expect(restored.schemaVersion).toBe(2);
    expect(restored.worldJourney).toEqual({
      visitedTerritoryIds: [],
      discoveredLandmarkIds: [],
      lastPosition: null,
      recentArrivals: [],
      traversedRoutes: [],
      encounterLocations: []
    });
    for (const field of V2_COLLECTIONS) expect(restored[field]).toEqual([]);
  });

  it('rejects malformed or unsupported data', () => {
    expect(() => deserializeCampaign('{"schemaVersion":99}')).toThrow(/Unsupported/);
    expect(() => deserializeCampaign('{"schemaVersion":1,"xp":"nope"}')).toThrow();
  });
});
