import { describe, expect, it } from 'vitest';
import {
  appendJournalEntry,
  createJournalEntry,
  journalEntryIsProviderEligible,
  selectJournalEntriesChronological,
  selectJournalEntriesNewestFirst,
  selectProviderEligibleJournalEntries
} from '../../src/journal/domain';

const at = '2026-01-02T03:04:05.000Z';

describe('JournalEntry domain (J00)', () => {
  it('creates a self-initiated typed entry without requiring a source prompt', () => {
    const entry = createJournalEntry({
      id: 'journal_1',
      createdAt: at,
      text: 'I wrote this because I wanted to.',
      inputMode: 'typed'
    });

    expect(entry).toEqual({
      id: 'journal_1',
      createdAt: at,
      text: 'I wrote this because I wanted to.',
      inputMode: 'typed',
      privacy: 'normal',
      status: 'active',
      linkedReflectionIds: [],
      linkedAdventureIds: []
    });
    expect('sourcePrompt' in entry).toBe(false);
  });

  it('preserves player-authored text exactly instead of normalizing it', () => {
    const text = '  First line.\nSecond line.  ';
    const entry = createJournalEntry({
      id: 'journal_exact',
      createdAt: at,
      text,
      inputMode: 'speech-to-text',
      sourcePrompt: 'Optional prompt'
    });

    expect(entry.text).toBe(text);
    expect(entry.inputMode).toBe('speech-to-text');
    expect(entry.sourcePrompt).toBe('Optional prompt');
  });

  it('treats only active normal entries as provider-eligible', () => {
    const base = createJournalEntry({
      id: 'journal_eligible',
      createdAt: at,
      text: 'Synthetic entry.',
      inputMode: 'typed'
    });
    const privateEntry = { ...base, id: 'journal_private', privacy: 'private' as const };
    const retractedEntry = { ...base, id: 'journal_retracted', status: 'retracted' as const };

    expect(journalEntryIsProviderEligible(base)).toBe(true);
    expect(journalEntryIsProviderEligible(privateEntry)).toBe(false);
    expect(journalEntryIsProviderEligible(retractedEntry)).toBe(false);
    expect(selectProviderEligibleJournalEntries([privateEntry, base, retractedEntry])).toEqual([base]);
  });

  it('sorts copies deterministically by timestamp and then stable id', () => {
    const a = createJournalEntry({
      id: 'journal_a',
      createdAt: '2026-01-02T03:04:05.000Z',
      text: 'A',
      inputMode: 'typed'
    });
    const b = createJournalEntry({
      id: 'journal_b',
      createdAt: '2026-01-02T03:04:05.000Z',
      text: 'B',
      inputMode: 'typed'
    });
    const c = createJournalEntry({
      id: 'journal_c',
      createdAt: '2026-01-03T03:04:05.000Z',
      text: 'C',
      inputMode: 'typed'
    });
    const source = [c, b, a];

    expect(selectJournalEntriesChronological(source).map((entry) => entry.id))
      .toEqual(['journal_a', 'journal_b', 'journal_c']);
    expect(selectJournalEntriesNewestFirst(source).map((entry) => entry.id))
      .toEqual(['journal_c', 'journal_b', 'journal_a']);
    expect(source.map((entry) => entry.id)).toEqual(['journal_c', 'journal_b', 'journal_a']);
  });

  it('refuses duplicate stable ids instead of overwriting prior history', () => {
    const entry = createJournalEntry({
      id: 'journal_duplicate',
      createdAt: at,
      text: 'Original.',
      inputMode: 'typed'
    });

    expect(appendJournalEntry([], entry)).toEqual([entry]);
    expect(() => appendJournalEntry([entry], { ...entry, text: 'Replacement.' }))
      .toThrow('Duplicate JournalEntry id: journal_duplicate');
  });
});
