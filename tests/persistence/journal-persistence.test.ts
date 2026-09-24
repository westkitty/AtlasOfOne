import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it } from 'vitest';
import { appendJournalEntry, createJournalEntry, selectJournalEntriesChronological } from '../../src/journal/domain';
import { createInitialCampaign } from '../../src/game/engine';
import { deleteCampaign, loadCampaign, saveCampaign } from '../../src/persistence/db';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';

afterEach(async () => {
  await deleteCampaign();
});

describe('Journal persistence and transfer (J01)', () => {
  it('round-trips Journal entries through the existing local campaign row', async () => {
    const initial = createInitialCampaign();
    const first = createJournalEntry({
      id: 'journal_1',
      createdAt: '2026-01-02T03:04:05.000Z',
      text: 'Synthetic local Journal entry.',
      inputMode: 'typed'
    });
    const second = createJournalEntry({
      id: 'journal_2',
      createdAt: '2026-01-03T03:04:05.000Z',
      text: 'Second synthetic Journal entry.',
      inputMode: 'typed'
    });
    const state = {
      ...initial,
      journalEntries: appendJournalEntry(appendJournalEntry(initial.journalEntries, first), second)
    };

    await saveCampaign(state);
    const restored = await loadCampaign();

    expect(restored?.journalEntries).toEqual([first, second]);
    expect(selectJournalEntriesChronological(restored!.journalEntries).map((entry) => entry.id))
      .toEqual(['journal_1', 'journal_2']);
  });

  it('preserves Journal entries through export/import without creating a second storage model', () => {
    const initial = createInitialCampaign();
    const entry = createJournalEntry({
      id: 'journal_transfer',
      createdAt: '2026-01-02T03:04:05.000Z',
      text: 'Synthetic transfer entry.',
      inputMode: 'typed'
    });
    const state = {
      ...initial,
      journalEntries: appendJournalEntry(initial.journalEntries, entry)
    };

    const restored = deserializeCampaign(serializeCampaign(state));

    expect(restored.journalEntries).toEqual([entry]);
    expect(restored.turns).toEqual(initial.turns);
    expect(restored.evidence).toEqual(initial.evidence);
    expect(restored.xp).toBe(initial.xp);
  });
});
