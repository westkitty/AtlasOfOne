import { journalEntrySchema, type JournalEntry } from './schema';

export interface NewJournalEntry {
  id: string;
  createdAt: string;
  text: string;
  inputMode: JournalEntry['inputMode'];
  sourcePrompt?: string;
}

/**
 * Constructs one player-authored Journal entry without inventing analysis,
 * progression, links, privacy state or prompts.
 *
 * Text is preserved exactly as supplied. A caller may omit sourcePrompt entirely
 * for the primary blank/self-initiated Journal path.
 */
export function createJournalEntry(input: NewJournalEntry): JournalEntry {
  return journalEntrySchema.parse({
    id: input.id,
    createdAt: input.createdAt,
    text: input.text,
    inputMode: input.inputMode,
    privacy: 'normal',
    status: 'active',
    ...(input.sourcePrompt === undefined ? {} : { sourcePrompt: input.sourcePrompt }),
    linkedReflectionIds: [],
    linkedAdventureIds: []
  });
}

export function journalEntryIsActive(entry: JournalEntry): boolean {
  return entry.status === 'active';
}

export function journalEntryIsProviderEligible(entry: JournalEntry): boolean {
  return entry.status === 'active' && entry.privacy === 'normal';
}

export function selectJournalEntryById(
  entries: readonly JournalEntry[],
  id: string
): JournalEntry | undefined {
  return entries.find((entry) => entry.id === id);
}

export function selectProviderEligibleJournalEntries(
  entries: readonly JournalEntry[]
): JournalEntry[] {
  return entries.filter(journalEntryIsProviderEligible);
}

function compareJournalEntries(left: JournalEntry, right: JournalEntry): number {
  const byTime = left.createdAt.localeCompare(right.createdAt);
  return byTime || left.id.localeCompare(right.id);
}

export function selectJournalEntriesChronological(
  entries: readonly JournalEntry[]
): JournalEntry[] {
  return [...entries].sort(compareJournalEntries);
}

export function selectJournalEntriesNewestFirst(
  entries: readonly JournalEntry[]
): JournalEntry[] {
  return [...entries].sort((left, right) => compareJournalEntries(right, left));
}

/**
 * Appends a validated Journal entry while protecting stable identity.
 *
 * Duplicate IDs are a data-integrity error, not an invitation to overwrite an
 * earlier human-authored record.
 */
export function appendJournalEntry(
  entries: readonly JournalEntry[],
  entry: JournalEntry
): JournalEntry[] {
  const parsed = journalEntrySchema.parse(entry);
  if (entries.some((existing) => existing.id === parsed.id)) {
    throw new Error(`Duplicate JournalEntry id: ${parsed.id}`);
  }
  return [...entries, parsed];
}
