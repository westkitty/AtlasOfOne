import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { CURRENT_SCHEMA_VERSION, migrateCampaign } from '../../src/persistence/migrations';
import { campaignStateSchemaV1 } from '../../src/persistence/schema';
import { campaignStateSchemaV2 } from '../../src/persistence/schema-v2';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/v1/${name}`, import.meta.url), 'utf8'));

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

const INERT_V2_COLLECTIONS = V2_COLLECTIONS.filter((field) => field !== 'atlasSnapshots');

function asLegacyProjection(state: CampaignState) {
  const projected = { ...state } as Record<string, unknown>;
  for (const field of V2_COLLECTIONS) delete projected[field];
  projected.schemaVersion = 1;
  return projected;
}

describe('deterministic schema-v1 -> schema-v2 migration (M02)', () => {
  it.each(['canonical-current-v1.json', 'canonical-legacy-v1.json'])(
    'preserves every normalized v1 field for %s while introducing only inert v2 collections',
    (name) => {
      const raw = fixture(name);
      const expectedV1 = campaignStateSchemaV1.parse(raw);
      const migrated = migrateCampaign(raw);

      expect(CURRENT_SCHEMA_VERSION).toBe(2);
      expect(migrated.schemaVersion).toBe(2);
      expect(asLegacyProjection(migrated)).toEqual(expectedV1);
      for (const field of INERT_V2_COLLECTIONS) expect(migrated[field]).toEqual([]);
      expect(migrated.atlasSnapshots).toHaveLength(expectedV1.finalAssessment ? 1 : 0);
      expect(campaignStateSchemaV2.parse(migrated)).toEqual(migrated);
    }
  );

  it('is idempotent for already-migrated v2 state', () => {
    const migrated = migrateCampaign(fixture('canonical-current-v1.json'));
    expect(migrateCampaign(migrated)).toEqual(migrated);
  });

  it('creates fresh campaigns directly in valid schema v2', () => {
    const fresh = createInitialCampaign();
    expect(fresh.schemaVersion).toBe(2);
    expect(campaignStateSchemaV2.parse(fresh)).toEqual(fresh);
    for (const field of V2_COLLECTIONS) expect(fresh[field]).toEqual([]);
  });

  it('preserves the legacy FinalAssessment field while also creating one historical Snapshot', () => {
    const raw = fixture('canonical-current-v1.json');
    const migrated = migrateCampaign(raw);

    expect(migrated.finalAssessment?.id).toBe('assessment_fixture_v1');
    expect(migrated.atlasSnapshots).toEqual([{
      id: 'snapshot_legacy_assessment_fixture_v1',
      createdAt: '2026-01-02T03:04:05.000Z',
      evidenceIds: [],
      insightIds: [],
      contradictionIds: [],
      synthesis: migrated.finalAssessment
    }]);
  });
});
