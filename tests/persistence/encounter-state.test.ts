import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { describeDoor, doorInsightFrom, encounterTurnRecord } from '../../src/cartographer/mock';
import { activeDoorRun, availableDoors, bossRunFor } from '../../src/game/encounters';
import { applyGameEvent, applyGameEvents } from '../../src/game/engine';
import { deleteCampaign, loadCampaign, saveCampaign } from '../../src/persistence/db';
import { migrateCampaign } from '../../src/persistence/migrations';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';
import { seededCampaign } from '../fixtures/synthetic';

afterEach(async () => { await deleteCampaign(); });

/** A campaign carrying both a completed Boss Fight and a completed Mystery Door. */
function campaignWithEncounters() {
  let state = seededCampaign({ territories: ['identity', 'values', 'cognition'], xp: 700 });
  state = applyGameEvents(state, [
    { type: 'BOSS_STARTED', bossId: 'boss-values' },
    { type: 'BOSS_STAGE_PASSED' },
    { type: 'BOSS_STAGE_PASSED' },
    // Step out of the Boss Fight; only one encounter runs at a time.
    { type: 'BOSS_WITHDRAWN' }
  ]);

  const candidate = availableDoors(state)[0];
  state = applyGameEvent(state, { type: 'DOOR_OPENED', doorId: candidate.doorId });
  const run = activeDoorRun(state)!;
  const wording = describeDoor(state, run, { identity: 'Identity', values: 'Values', cognition: 'Cognition' });
  state = applyGameEvent(state, {
    type: 'DOOR_ANSWERED',
    turn: encounterTurnRecord(run.territoryIds[0], run.dimensions[0], wording.question, 'Synthetic crossing answer.'),
    insight: doorInsightFrom(run, wording)
  });
  return state;
}

describe('encounter state persistence', () => {
  it('round-trips boss and door state through export/import without loss', () => {
    const state = campaignWithEncounters();
    expect(state.bossRuns).toHaveLength(1);
    expect(state.doorRuns).toHaveLength(1);
    expect(deserializeCampaign(serializeCampaign(state))).toEqual(state);
  });

  it('restores an in-progress boss run through IndexedDB', async () => {
    const state = campaignWithEncounters();
    await saveCampaign(state);
    const restored = (await loadCampaign())!;

    expect(restored).toEqual(state);
    expect(bossRunFor(restored, 'boss-values')!.stages.filter((stage) => stage.outcome === 'passed')).toHaveLength(2);
    expect(bossRunFor(restored, 'boss-values')!.status).toBe('active');
    expect(restored.doorRuns[0].status).toBe('complete');
  });

  it('defaults encounter fields for older schema-v1 campaigns that predate them', () => {
    const legacy = campaignWithEncounters() as unknown as Record<string, unknown>;
    delete legacy.bossRuns;
    delete legacy.activeBoss;
    delete legacy.doorRuns;
    delete legacy.activeDoor;

    const migrated = migrateCampaign(legacy);
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.bossRuns).toEqual([]);
    expect(migrated.doorRuns).toEqual([]);
    expect(migrated.activeBoss).toBeNull();
    expect(migrated.activeDoor).toBeNull();
  });

  it('still rejects malformed encounter data', () => {
    const state = campaignWithEncounters() as unknown as Record<string, unknown>;
    expect(() => migrateCampaign({ ...state, bossRuns: 'nope' })).toThrow();
    expect(() => migrateCampaign({ ...state, activeDoor: 42 })).toThrow();
  });

  it('uses stable identifiers that survive a round trip', () => {
    const state = campaignWithEncounters();
    const restored = deserializeCampaign(serializeCampaign(state));
    expect(restored.bossRuns[0].bossId).toBe('boss-values');
    expect(restored.bossRuns[0].stages.map((stage) => stage.id)).toEqual(state.bossRuns[0].stages.map((stage) => stage.id));
    expect(restored.doorRuns[0].doorId).toBe(state.doorRuns[0].doorId);
  });
});
