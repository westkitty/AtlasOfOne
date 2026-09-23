import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { campaignStateSchemaV1 } from '../../src/persistence/schema';
import { migrateCampaign } from '../../src/persistence/migrations';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/v1/${name}`, import.meta.url), 'utf8'));

describe('M04 legacy-state preservation', () => {
  it.each(['canonical-current-v1.json', 'canonical-legacy-v1.json'])(
    'preserves turns, encounters, worldJourney and settings for %s',
    (name) => {
      const normalizedV1 = campaignStateSchemaV1.parse(fixture(name));
      const migrated = migrateCampaign(fixture(name));

      expect(migrated.schemaVersion).toBe(2);
      expect(migrated.turns).toEqual(normalizedV1.turns);
      expect(migrated.bossRuns).toEqual(normalizedV1.bossRuns);
      expect(migrated.activeBoss).toEqual(normalizedV1.activeBoss);
      expect(migrated.doorRuns).toEqual(normalizedV1.doorRuns);
      expect(migrated.activeDoor).toEqual(normalizedV1.activeDoor);
      expect(migrated.worldJourney).toEqual(normalizedV1.worldJourney);
      expect(migrated.settings).toEqual(normalizedV1.settings);
    }
  );

  it('does not rewrite legacy turn provenance while raising the campaign schema', () => {
    const normalizedV1 = campaignStateSchemaV1.parse(fixture('canonical-current-v1.json'));
    const migrated = migrateCampaign(fixture('canonical-current-v1.json'));

    expect(migrated.turns[0]).toEqual(normalizedV1.turns[0]);
    expect(migrated.evidence[0]).toEqual(normalizedV1.evidence[0]);
    expect(migrated.worldJourney.encounterLocations).toEqual(normalizedV1.worldJourney.encounterLocations);
  });
});
