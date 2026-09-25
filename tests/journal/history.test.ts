import { describe, expect, it } from 'vitest';
import { createJournalEntry, groupJournalEntriesByDay, journalEntryDayKey } from '../../src/journal/domain';
import { JOURNAL_PROMPTS, nextJournalPrompt } from '../../src/journal/prompts';

const entry = (id: string, createdAt: string) =>
  createJournalEntry({ id, createdAt, text: 'Synthetic ' + id, inputMode: 'typed' });

describe('Journal history grouping (J06)', () => {
  it('groups newest day first and newest entry first within a day', () => {
    const groups = groupJournalEntriesByDay([
      entry('a', '2026-03-01T09:00:00.000Z'),
      entry('c', '2026-03-02T10:00:00.000Z'),
      entry('b', '2026-03-01T18:00:00.000Z'),
      entry('d', '2026-03-02T08:00:00.000Z')
    ], 'UTC');

    expect(groups.map((group) => group.dayKey)).toEqual(['2026-03-02', '2026-03-01']);
    expect(groups[0].entries.map((item) => item.id)).toEqual(['c', 'd']);
    expect(groups[1].entries.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('uses the supplied local time zone for day boundaries', () => {
    const late = entry('late', '2026-03-02T03:00:00.000Z');
    expect(journalEntryDayKey(late, 'UTC')).toBe('2026-03-02');
    expect(journalEntryDayKey(late, 'America/Vancouver')).toBe('2026-03-01');
  });

  it('keeps PRIVATE and retracted entries in local history', () => {
    const privateEntry = { ...entry('p', '2026-03-01T09:00:00.000Z'), privacy: 'private' as const };
    const retracted = { ...entry('r', '2026-03-01T10:00:00.000Z'), status: 'retracted' as const };
    const groups = groupJournalEntriesByDay([privateEntry, retracted], 'UTC');
    expect(groups[0].entries.map((item) => item.id)).toEqual(['r', 'p']);
  });

  it('does not mutate caller order and rejects invalid dates', () => {
    const source = [entry('a', '2026-03-01T09:00:00.000Z'), entry('b', '2026-03-02T09:00:00.000Z')];
    groupJournalEntriesByDay(source, 'UTC');
    expect(source.map((item) => item.id)).toEqual(['a', 'b']);
    expect(() => journalEntryDayKey({ createdAt: 'not-a-date' })).toThrow('Invalid JournalEntry createdAt');
  });

  it('returns no groups for an empty history', () => {
    expect(groupJournalEntriesByDay([], 'UTC')).toEqual([]);
  });
});

describe('Optional Journal prompts (J08)', () => {
  it('rotates deterministically and wraps', () => {
    expect(nextJournalPrompt()).toBe(JOURNAL_PROMPTS[0]);
    expect(nextJournalPrompt(JOURNAL_PROMPTS[0])).toBe(JOURNAL_PROMPTS[1]);
    expect(nextJournalPrompt(JOURNAL_PROMPTS[JOURNAL_PROMPTS.length - 1])).toBe(JOURNAL_PROMPTS[0]);
    expect(nextJournalPrompt('unknown prompt')).toBe(JOURNAL_PROMPTS[0]);
  });

  it('never probes for pain, diagnosis, or disclosure', () => {
    const probing = /\b(trauma|hurt|pain|diagnos|depress|anxi|secret|confess|worst|ashamed|afraid)\w*/i;
    for (const prompt of JOURNAL_PROMPTS) expect(prompt).not.toMatch(probing);
  });

  it('a prompted entry records sourcePrompt; an unprompted one omits it', () => {
    const prompted = createJournalEntry({
      id: 'x', createdAt: '2026-03-01T09:00:00.000Z', text: 'Synthetic', inputMode: 'typed', sourcePrompt: JOURNAL_PROMPTS[0]
    });
    const plain = entry('y', '2026-03-01T09:00:00.000Z');
    expect(prompted.sourcePrompt).toBe(JOURNAL_PROMPTS[0]);
    expect('sourcePrompt' in plain).toBe(false);
  });
});
