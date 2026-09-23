import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ADVENTURE_KINDS, adventureKindSchema } from '../../src/adventure/schema';
import { atlasSnapshotSchema } from '../../src/atlas/schema';
import { campaignStateSchemaV2 } from '../../src/persistence/schema-v2';
import { campaignStateSchemaV1 } from '../../src/persistence/schema';
import { CURRENT_SCHEMA_VERSION, migrateCampaign } from '../../src/persistence/migrations';
import { reflectionRecordSchema } from '../../src/reflection/schema';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/v1/${name}`, import.meta.url), 'utf8'));

describe('schema-v2 surface', () => {
  it('activates v2 while preserving the canonical v1 parser as historical input authority', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);

    const currentV1 = campaignStateSchemaV1.parse(fixture('canonical-current-v1.json'));
    const legacyV1 = campaignStateSchemaV1.parse(fixture('canonical-legacy-v1.json'));

    expect(currentV1.schemaVersion).toBe(1);
    expect(legacyV1.schemaVersion).toBe(1);
    expect(migrateCampaign(currentV1).schemaVersion).toBe(2);
    expect(migrateCampaign(legacyV1).schemaVersion).toBe(2);
  });

  it('defines v2 with inert empty defaults and preserves legacy fields', () => {
    const v1 = campaignStateSchemaV1.parse(fixture('canonical-current-v1.json'));
    const v2 = campaignStateSchemaV2.parse({ ...v1, schemaVersion: 2 });

    expect(v2.schemaVersion).toBe(2);
    expect(v2.journalEntries).toEqual([]);
    expect(v2.knowledgeGaps).toEqual([]);
    expect(v2.adventureSeeds).toEqual([]);
    expect(v2.adventureRuns).toEqual([]);
    expect(v2.adventureActions).toEqual([]);
    expect(v2.adventureObservations).toEqual([]);
    expect(v2.reflections).toEqual([]);
    expect(v2.adventureMemories).toEqual([]);
    expect(v2.atlasSnapshots).toEqual([]);

    expect(v2.turns).toEqual(v1.turns);
    expect(v2.bossRuns).toEqual(v1.bossRuns);
    expect(v2.doorRuns).toEqual(v1.doorRuns);
    expect(v2.worldJourney).toEqual(v1.worldJourney);
    expect(v2.settings).toEqual(v1.settings);
    expect(v2.finalAssessment).toEqual(v1.finalAssessment);
  });

  it('accepts already-migrated v2 state without semantic change', () => {
    const v1 = campaignStateSchemaV1.parse(fixture('canonical-current-v1.json'));
    const candidateV2 = campaignStateSchemaV2.parse({ ...v1, schemaVersion: 2 });
    expect(migrateCampaign(candidateV2)).toEqual(candidateV2);
  });

  it('freezes all fourteen initial Adventure kinds and refuses free-text additions', () => {
    expect(ADVENTURE_KINDS).toHaveLength(14);
    for (const kind of ADVENTURE_KINDS) {
      expect(adventureKindSchema.parse(kind)).toBe(kind);
    }
    expect(() => adventureKindSchema.parse('provider-invented-kind')).toThrow();
  });

  it('keeps Reflection decision, epistemic status, privacy, and retraction independent', () => {
    const privateConfirmed = reflectionRecordSchema.parse({
      id: 'reflection_fixture_private',
      sourceKind: 'journal',
      sourceIds: ['journal_fixture_1'],
      question: 'Synthetic reflection?',
      response: 'Synthetic response.',
      decision: 'private',
      epistemicStatus: 'confirmed',
      privacy: 'private',
      recordStatus: 'active',
      createdAt: '2026-01-02T03:04:05.000Z'
    });

    const retractedRevision = reflectionRecordSchema.parse({
      id: 'reflection_fixture_revision',
      sourceKind: 'pattern',
      sourceIds: ['ev_fixture_1', 'ev_fixture_2'],
      question: 'Synthetic pattern reflection?',
      response: 'Synthetic revision.',
      interpretation: 'Synthetic interpretation.',
      decision: 'revise',
      epistemicStatus: 'partial',
      privacy: 'normal',
      recordStatus: 'retracted',
      createdAt: '2026-01-02T03:04:05.000Z'
    });

    expect(privateConfirmed).toMatchObject({
      decision: 'private',
      epistemicStatus: 'confirmed',
      privacy: 'private',
      recordStatus: 'active'
    });
    expect(retractedRevision).toMatchObject({
      decision: 'revise',
      epistemicStatus: 'partial',
      privacy: 'normal',
      recordStatus: 'retracted'
    });
  });

  it('uses the validated FinalAssessment shape as the historical Snapshot compatibility bridge', () => {
    const v1 = campaignStateSchemaV1.parse(fixture('canonical-current-v1.json'));
    expect(v1.finalAssessment).not.toBeNull();

    const snapshot = atlasSnapshotSchema.parse({
      id: 'snapshot_fixture_1',
      createdAt: '2026-01-02T03:04:05.000Z',
      evidenceIds: v1.evidence.map((record) => record.id),
      insightIds: v1.insights.map((record) => record.id),
      contradictionIds: v1.contradictions.map((record) => record.id),
      synthesis: v1.finalAssessment,
      previousSnapshotId: undefined
    });

    expect(snapshot.synthesis.id).toBe('assessment_fixture_v1');
  });
});
