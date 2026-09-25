import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';

describe('M05 schema-v2 transfer validation', () => {
  it('round-trips a valid schema-v2 campaign through the public transfer boundary', () => {
    const state = createInitialCampaign();
    const restored = deserializeCampaign(serializeCampaign(state));

    expect(restored).toEqual(state);
    expect(restored.schemaVersion).toBe(2);
  });

  it('rejects malformed v2 collection shapes', () => {
    const state = createInitialCampaign();

    expect(() => deserializeCampaign(JSON.stringify({
      ...state,
      journalEntries: 'not-an-array'
    }))).toThrow();

    expect(() => deserializeCampaign(JSON.stringify({
      ...state,
      reflections: [{ id: 'broken-reflection' }]
    }))).toThrow();

    expect(() => deserializeCampaign(JSON.stringify({
      ...state,
      atlasSnapshots: [{ id: 'broken-snapshot' }]
    }))).toThrow();
  });

  it('rejects unknown future schema versions instead of guessing', () => {
    const state = createInitialCampaign();
    expect(() => deserializeCampaign(JSON.stringify({
      ...state,
      schemaVersion: 3
    }))).toThrow(/Unsupported Atlas schemaVersion: 3/);
  });

  it('keeps v1 imports compatible by migrating them before returning from transfer', () => {
    const state = createInitialCampaign() as unknown as Record<string, unknown>;
    const legacy: Record<string, unknown> = { ...state, schemaVersion: 1 };
    for (const field of [
      'journalEntries',
      'knowledgeGaps',
      'adventureSeeds',
      'adventureRuns',
      'adventureActions',
      'adventureObservations',
      'reflections',
      'adventureMemories',
      'atlasSnapshots'
    ]) delete legacy[field];

    const restored = deserializeCampaign(JSON.stringify(legacy));
    expect(restored.schemaVersion).toBe(2);
    expect(restored.journalEntries).toEqual([]);
    expect(restored.reflections).toEqual([]);
    expect(restored.atlasSnapshots).toEqual([]);
  });
});
