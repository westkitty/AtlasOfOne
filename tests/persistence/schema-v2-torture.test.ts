import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { db, deleteCampaign, loadCampaign, replaceCampaignFromExport, saveCampaign } from '../../src/persistence/db';
import { serializeCampaign } from '../../src/persistence/transfer';
import { cloneV1Fixture } from '../fixtures/persistence-v1';
import { syntheticV2Campaign } from '../fixtures/persistence-v2';

afterEach(async () => { await deleteCampaign(); });

describe('M07 v1/v2 IndexedDB persistence torture', () => {
  it('migrates a v1 row, persists v2, exports, deletes, imports, and preserves legacy state', async () => {
    const legacy = cloneV1Fixture('withAssessment');
    await db.campaigns.put({ key: 'active', state: legacy });
    const migrated = (await loadCampaign())!;
    expect(migrated.schemaVersion).toBe(2);
    expect((await db.campaigns.get('active'))!.state).toMatchObject({ schemaVersion: 2 });

    const exported = serializeCampaign(migrated);
    await deleteCampaign();
    await replaceCampaignFromExport(exported);
    const restored = (await loadCampaign())!;
    expect(restored.turns).toEqual(migrated.turns);
    expect(restored.evidence).toEqual(migrated.evidence);
    expect(restored.bossRuns).toEqual(migrated.bossRuns);
    expect(restored.doorRuns).toEqual(migrated.doorRuns);
    expect(restored.worldJourney).toEqual(migrated.worldJourney);
    expect(restored.atlasSnapshots).toEqual(migrated.atlasSnapshots);
  });

  it('saves, reloads, exports, deletes, imports, and reloads every v2 durable collection', async () => {
    const source = syntheticV2Campaign();
    await saveCampaign(source);
    expect(await loadCampaign()).toEqual(source);
    const exported = serializeCampaign(source);
    await deleteCampaign();
    await replaceCampaignFromExport(exported);
    expect(await loadCampaign()).toEqual(source);
  });

  it('does not replace a valid active campaign when import validation fails', async () => {
    const active = syntheticV2Campaign();
    await saveCampaign(active);
    await expect(replaceCampaignFromExport('{"schemaVersion":2,"journalEntries":"invalid"}')).rejects.toThrow();
    expect(await loadCampaign()).toEqual(active);
  });

  it('persists structural retirement when an existing v2 row is loaded', async () => {
    const state = syntheticV2Campaign();
    const rawPrivate = {
      ...state,
      journalEntries: [{ ...state.journalEntries[0], id: 'journal_private_row', privacy: 'private' as const }],
      knowledgeGaps: [{ ...state.knowledgeGaps[0], sourceEvidenceIds: [], sourceJournalEntryIds: ['journal_private_row'] }]
    };
    await db.campaigns.put({ key: 'active', state: rawPrivate });
    expect((await loadCampaign())!.knowledgeGaps[0].status).toBe('retired');
    expect((await db.campaigns.get('active'))!.state).toMatchObject({ knowledgeGaps: [{ status: 'retired' }] });
  });
});
