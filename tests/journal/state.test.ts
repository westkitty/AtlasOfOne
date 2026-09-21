import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { compileContext } from '../../src/cartographer/context';
import { createInitialCampaign } from '../../src/game/engine';
import { deleteCampaign, loadCampaign, saveCampaign } from '../../src/persistence/db';
import { providerEligibleV2State } from '../../src/persistence/retirement';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';
import {
  journalEntriesForDate,
  journalEntryDates,
  journalEntriesNewestFirst,
  linkJournalEntry,
  retractJournalEntry,
  saveJournalEntry,
  setJournalEntryPrivacy
} from '../../src/journal/state';

afterEach(async () => { await deleteCampaign(); });

describe('J00-J08 Journal domain', () => {
  it('saves nonblank entries without any deterministic gameplay mutation', () => {
    const base = createInitialCampaign();
    const before = {
      xp: base.xp, level: base.level, turns: base.turns, evidence: base.evidence, territories: base.territories,
      quests: base.quests, achievements: base.achievements, fragments: base.mapFragments, bosses: base.bossRuns,
      doors: base.doorRuns, world: base.worldJourney
    };
    const saved = saveJournalEntry(base, { text: '  synthetic-journal-canary-a  ', inputMode: 'typed', privacy: 'normal' }, {
      id: 'journal_a', createdAt: '2026-09-20T10:00:00.000Z'
    });
    expect(saved.journalEntries).toEqual([expect.objectContaining({ id: 'journal_a', text: 'synthetic-journal-canary-a', status: 'active', reflectionIds: [], adventureIds: [] })]);
    expect({ xp: saved.xp, level: saved.level, turns: saved.turns, evidence: saved.evidence, territories: saved.territories, quests: saved.quests, achievements: saved.achievements, fragments: saved.mapFragments, bosses: saved.bossRuns, doors: saved.doorRuns, world: saved.worldJourney }).toEqual(before);
  });

  it('orders and filters history by ISO date deterministically', () => {
    const base = createInitialCampaign();
    const older = saveJournalEntry(base, { text: 'synthetic older', inputMode: 'typed', privacy: 'normal' }, { id: 'older', createdAt: '2026-09-19T10:00:00.000Z' });
    const newer = saveJournalEntry(older, { text: 'synthetic newer', inputMode: 'typed', privacy: 'normal' }, { id: 'newer', createdAt: '2026-09-20T09:00:00.000Z' });
    const sameTime = saveJournalEntry(newer, { text: 'synthetic newest tie', inputMode: 'speech-to-text', privacy: 'normal' }, { id: 'tie', createdAt: '2026-09-20T09:00:00.000Z' });
    expect(journalEntriesNewestFirst(sameTime.journalEntries).map((entry) => entry.id)).toEqual(['tie', 'newer', 'older']);
    expect(journalEntryDates(sameTime.journalEntries)).toEqual(['2026-09-20', '2026-09-19']);
    expect(journalEntriesForDate(sameTime.journalEntries, '2026-09-20').map((entry) => entry.id)).toEqual(['tie', 'newer']);
  });

  it('persists private/retracted/link metadata through IndexedDB and export serialization', async () => {
    const saved = saveJournalEntry(createInitialCampaign(), { text: 'synthetic-private-canary-journal', inputMode: 'speech-to-text', privacy: 'private', sourcePrompt: 'Synthetic prompt?' }, { id: 'journal_private', createdAt: '2026-09-20T10:00:00.000Z' });
    const linked = linkJournalEntry(linkJournalEntry(saved, 'journal_private', { reflectionId: 'reflection_1', adventureId: 'run_1' }), 'journal_private', { reflectionId: 'reflection_1', adventureId: 'run_1' });
    const retracted = retractJournalEntry(linked, 'journal_private');
    await saveCampaign(retracted);
    expect(await loadCampaign()).toEqual(retracted);
    expect(deserializeCampaign(serializeCampaign(retracted))).toEqual(retracted);
    expect(retracted.journalEntries[0]).toMatchObject({ privacy: 'private', status: 'retracted', reflectionIds: ['reflection_1'], adventureIds: ['run_1'], inputMode: 'speech-to-text' });
  });

  it('retires provenance dependents and keeps private/retracted Journal canaries outside provider context', () => {
    const base = createInitialCampaign();
    const saved = saveJournalEntry(base, { text: 'synthetic-provider-private-canary', inputMode: 'typed', privacy: 'normal' }, { id: 'journal_source', createdAt: '2026-09-20T10:00:00.000Z' });
    const withDependent = { ...saved, knowledgeGaps: [{ id: 'gap_journal', kind: 'underexplored' as const, territoryIds: ['identity'], dimensionIds: [], sourceEvidenceIds: [], sourceJournalEntryIds: ['journal_source'], summary: 'Synthetic dependent.', status: 'open' as const, priority: 1 }] };
    const privateState = setJournalEntryPrivacy(withDependent, 'journal_source', 'private');
    expect(privateState.knowledgeGaps[0].status).toBe('retired');
    expect(JSON.stringify(compileContext(privateState, { territoryId: 'identity', dimension: 'self-description', question: 'Synthetic question?' }, 'Synthetic answer.'))).not.toContain('synthetic-provider-private-canary');
    expect(JSON.stringify(providerEligibleV2State(privateState))).not.toContain('synthetic-provider-private-canary');
    expect(providerEligibleV2State(privateState).knowledgeGaps).toEqual([]);
    const retracted = retractJournalEntry({ ...withDependent, journalEntries: [{ ...withDependent.journalEntries[0], privacy: 'normal' }] }, 'journal_source');
    expect(retracted.journalEntries[0]).toMatchObject({ text: 'synthetic-provider-private-canary', status: 'retracted' });
    expect(retracted.knowledgeGaps[0].status).toBe('retired');
    expect(JSON.stringify(providerEligibleV2State(retracted))).not.toContain('synthetic-provider-private-canary');
    expect(providerEligibleV2State(retracted).knowledgeGaps).toEqual([]);
  });
});
