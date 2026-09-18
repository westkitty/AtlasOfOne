import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';
describe('campaign transfer',()=>{
  it('round-trips schema v1 without semantic loss',()=>{const state=createInitialCampaign();expect(deserializeCampaign(serializeCampaign(state))).toEqual(state);});
  it('fills journey memory safely when importing an older schema-v1 campaign',()=>{
    const legacy = createInitialCampaign() as any;
    delete legacy.worldJourney;
    const restored = deserializeCampaign(JSON.stringify(legacy));
    expect(restored.worldJourney).toEqual({
      visitedTerritoryIds: [],
      discoveredLandmarkIds: [],
      lastPosition: null,
      recentArrivals: [],
      traversedRoutes: [],
      encounterLocations: []
    });
  });
  it('rejects malformed or unsupported data',()=>{expect(()=>deserializeCampaign('{"schemaVersion":99}')).toThrow(/Unsupported/);expect(()=>deserializeCampaign('{"schemaVersion":1,"xp":"nope"}')).toThrow();});
});
