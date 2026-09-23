import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/v1/${name}`, import.meta.url), 'utf8');

describe('canonical synthetic schema-v1 export fixtures', () => {
  it('validates the current v1 export with durable encounter, world, and assessment state intact', () => {
    const state = deserializeCampaign(fixture('canonical-current-v1.json'));

    expect(state.schemaVersion).toBe(1);
    expect(state.campaignId).toBe('campaign_fixture_current_v1');
    expect(state.player.id).toBe('synthetic-player');
    expect(state.turns.map((turn) => turn.id)).toEqual(['turn_fixture_1']);
    expect(state.evidence.map((record) => record.id)).toEqual(['ev_identity_1']);
    expect(state.bossRuns.map((run) => run.id)).toEqual(['bossrun_fixture_1']);
    expect(state.doorRuns.map((run) => run.id)).toEqual(['doorrun_fixture_1']);
    expect(state.worldJourney.lastPosition).toEqual({ x: 12, y: 34, territoryId: 'identity' });
    expect(state.finalAssessment?.id).toBe('assessment_fixture_v1');
    expect(state.onboardingCompleted).toBe(true);

    expect(deserializeCampaign(serializeCampaign(state))).toEqual(state);
  });

  it('validates an older v1 export and applies only the existing additive v1 defaults', () => {
    const state = deserializeCampaign(fixture('canonical-legacy-v1.json'));

    expect(state.schemaVersion).toBe(1);
    expect(state.campaignId).toBe('campaign_fixture_legacy_v1');
    expect(state.player.id).toBe('synthetic-player');
    expect(state.bossRuns).toEqual([]);
    expect(state.activeBoss).toBeNull();
    expect(state.doorRuns).toEqual([]);
    expect(state.activeDoor).toBeNull();
    expect(state.worldJourney).toEqual({
      visitedTerritoryIds: [],
      discoveredLandmarkIds: [],
      lastPosition: null,
      recentArrivals: [],
      traversedRoutes: [],
      encounterLocations: []
    });
    expect(state.finalAssessment).toBeNull();
    expect(state.onboardingCompleted).toBe(false);
    expect(state.evidence[0].origin).toBe('model-proposed');
    expect(state.evidence[0].providerId).toBeUndefined();
  });
});
