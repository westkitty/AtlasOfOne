import 'fake-indexeddb/auto';
import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it } from 'vitest';
import { createJournalEntry } from '../../src/journal/domain';
import { deleteCampaign, loadCampaign, saveCampaign } from '../../src/persistence/db';
import { migrateCampaign } from '../../src/persistence/migrations';
import { retireIneligibleV2DerivedState } from '../../src/persistence/retirement';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';
import type { CampaignState } from '../../src/game/types';

const fixture = (name: string) =>
  JSON.parse(readFileSync(new URL(`../fixtures/v1/${name}`, import.meta.url), 'utf8'));

afterEach(async () => {
  await deleteCampaign();
});

function addV2PrivacyChain(state: CampaignState): CampaignState {
  const entry = {
    ...createJournalEntry({
      id: 'journal_m07_private',
      createdAt: '2026-01-04T00:00:00.000Z',
      text: 'M07_PRIVATE_CANARY',
      inputMode: 'typed'
    }),
    privacy: 'private' as const
  };

  return {
    ...state,
    journalEntries: [...state.journalEntries, entry],
    knowledgeGaps: [{
      id: 'gap_m07_private',
      kind: 'curiosity',
      territoryIds: ['identity'],
      dimensionIds: ['self-description'],
      sourceEvidenceIds: [],
      sourceJournalEntryIds: [entry.id],
      summary: 'M07_PRIVATE_GAP',
      status: 'open',
      priority: 8
    }],
    adventureSeeds: [{
      id: 'seed_m07_private',
      sourceGapIds: ['gap_m07_private'],
      kind: 'social-dilemma',
      territoryId: 'identity',
      premise: 'M07_PRIVATE_SEED',
      learningTarget: 'reflection-eligible',
      status: 'available'
    }],
    adventureMemories: [{
      id: 'memory_m07_private',
      type: 'event',
      summary: 'M07_PRIVATE_MEMORY',
      triggerTerms: ['m07'],
      sourceIds: ['seed_m07_private'],
      privacy: 'normal',
      status: 'active'
    }]
  };
}

describe('M07 v1/v2 persistence torture', () => {
  it('migrates canonical v1, retires private-derived v2 state, then survives IndexedDB + transfer round trips', async () => {
    const migrated = migrateCampaign(fixture('canonical-current-v1.json'));

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.finalAssessment?.id).toBe('assessment_fixture_v1');
    expect(migrated.atlasSnapshots).toEqual([{
      id: 'snapshot_legacy_assessment_fixture_v1',
      createdAt: '2026-01-02T03:04:05.000Z',
      evidenceIds: [],
      insightIds: [],
      contradictionIds: [],
      synthesis: migrated.finalAssessment
    }]);

    const retired = retireIneligibleV2DerivedState(addV2PrivacyChain(migrated));

    expect(retired.journalEntries.at(-1)).toMatchObject({
      id: 'journal_m07_private',
      text: 'M07_PRIVATE_CANARY',
      privacy: 'private',
      status: 'active'
    });
    expect(retired.knowledgeGaps[0].status).toBe('retired');
    expect(retired.adventureSeeds[0].status).toBe('retired');
    expect(retired.adventureMemories[0].status).toBe('retired');

    await saveCampaign(retired);
    const reloaded = await loadCampaign();
    expect(reloaded).toEqual(retired);

    const exported = serializeCampaign(reloaded!);
    const imported = deserializeCampaign(exported);
    expect(imported).toEqual(retired);

    await deleteCampaign();
    expect(await loadCampaign()).toBeNull();

    await saveCampaign(imported);
    expect(await loadCampaign()).toEqual(retired);
  });

  it('migrates legacy v1 with no assessment and remains stable through delete/re-import', async () => {
    const migrated = migrateCampaign(fixture('canonical-legacy-v1.json'));

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.finalAssessment).toBeNull();
    expect(migrated.atlasSnapshots).toEqual([]);

    await saveCampaign(migrated);
    const exported = serializeCampaign((await loadCampaign())!);

    await deleteCampaign();
    expect(await loadCampaign()).toBeNull();

    const restored = deserializeCampaign(exported);
    await saveCampaign(restored);
    expect(await loadCampaign()).toEqual(migrated);
  });
});
