import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';
describe('campaign transfer',()=>{
  it('round-trips schema v1 without semantic loss',()=>{const state=createInitialCampaign();expect(deserializeCampaign(serializeCampaign(state))).toEqual(state);});
  it('rejects malformed or unsupported data',()=>{expect(()=>deserializeCampaign('{"schemaVersion":99}')).toThrow(/Unsupported/);expect(()=>deserializeCampaign('{"schemaVersion":1,"xp":"nope"}')).toThrow();});
});
