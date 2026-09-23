import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { campaignStateSchemaV1 } from '../../src/persistence/schema';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';

const fixture = (name: string) =>
  readFileSync(new URL(`../fixtures/v1/${name}`, import.meta.url), 'utf8');

describe('canonical synthetic schema-v1 export fixtures', () => {
  it('keeps the current fixture valid under frozen v1 authority and migrates it losslessly to v2', () => {
    const raw = JSON.parse(fixture('canonical-current-v1.json'));
    const v1 = campaignStateSchemaV1.parse(raw);
    const state = deserializeCampaign(JSON.stringify(raw));

    expect(v1.schemaVersion).toBe(1);
    expect(state.schemaVersion).toBe(2);
    expect(state.campaignId).toBe('campaign_fixture_current_v1');
    expect(state.player.id).toBe('synthetic-player');
    expect(state.turns.map((turn) => turn.id)).toEqual(['turn_fixture_1']);
    expect(state.evidence.map((record) => record.id)).toEqual(['ev_identity_1']);
    expect(state.bossRuns.map((run) => run.id)).toEqual(['bossrun_fixture_1']);
    expect(state.doorRuns.map((run) => run.id)).toEqual(['doorrun_fixture_1']);
    expect(state.worldJourney.lastPosition).toEqual({ x: 12, y: 34, territoryId: 'identity' });
    expect(state.finalAssessment?.id).toBe('assessment_fixture_v1');
    expect(state.onboardingCompleted).toBe(true);
    expect(state.atlasSnapshots).toEqual([{
      id: 'snapshot_legacy_assessment_fixture_v1',
      createdAt: '2026-01-02T03:04:05.000Z',
      evidenceIds: [],
      insightIds: [],
      contradictionIds: [],
      synthesis: state.finalAssessment
    }]);

    expect(deserializeCampaign(serializeCampaign(state))).toEqual(state);
  });

  it('keeps the legacy fixture valid under v1 defaults and migrates those normalized defaults to v2', () => {
    const raw = JSON.parse(fixture('canonical-legacy-v1.json'));
    const v1 = campaignStateSchemaV1.parse(raw);
    const state = deserializeCampaign(JSON.stringify(raw));

    expect(v1.schemaVersion).toBe(1);
    expect(state.schemaVersion).toBe(2);
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
    expect(state.journalEntries).toEqual([]);
    expect(state.reflections).toEqual([]);
    expect(state.atlasSnapshots).toEqual([]);
  });
});
