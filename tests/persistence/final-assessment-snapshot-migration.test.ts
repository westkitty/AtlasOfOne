import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { migrateCampaign } from '../../src/persistence/migrations';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/v1/${name}`, import.meta.url), 'utf8'));

describe('historical FinalAssessment -> AtlasSnapshot migration (M03)', () => {
  it('preserves the exact legacy synthesis in one deterministic historical Snapshot', () => {
    const raw = fixture('canonical-current-v1.json');
    const migrated = migrateCampaign(raw);

    expect(migrated.finalAssessment).toEqual(raw.finalAssessment);
    expect(migrated.atlasSnapshots).toEqual([{
      id: 'snapshot_legacy_assessment_fixture_v1',
      createdAt: raw.finalAssessment.generatedAt,
      evidenceIds: [],
      insightIds: [],
      contradictionIds: [],
      synthesis: raw.finalAssessment
    }]);
  });

  it('does not fabricate provenance links that schema v1 never recorded', () => {
    const migrated = migrateCampaign(fixture('canonical-current-v1.json'));
    const [snapshot] = migrated.atlasSnapshots;

    expect(snapshot.evidenceIds).toEqual([]);
    expect(snapshot.insightIds).toEqual([]);
    expect(snapshot.contradictionIds).toEqual([]);
  });

  it('creates no historical Snapshot when the v1 campaign has no FinalAssessment', () => {
    const migrated = migrateCampaign(fixture('canonical-legacy-v1.json'));
    expect(migrated.finalAssessment).toBeNull();
    expect(migrated.atlasSnapshots).toEqual([]);
  });

  it('is deterministic and does not duplicate the historical Snapshot on v2 revalidation', () => {
    const once = migrateCampaign(fixture('canonical-current-v1.json'));
    const twice = migrateCampaign(once);

    expect(twice).toEqual(once);
    expect(twice.atlasSnapshots).toHaveLength(1);
  });
});
