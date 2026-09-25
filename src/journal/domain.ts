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


function updateJournalEntry(
  entries: readonly JournalEntry[],
  id: string,
  update: (entry: JournalEntry) => JournalEntry
): JournalEntry[] {
  let found = false;
  const next = entries.map((entry) => {
    if (entry.id !== id) return entry;
    found = true;
    return journalEntrySchema.parse(update(entry));
  });
  if (!found) throw new Error(`Unknown JournalEntry id: ${id}`);
  return next;
}

/**
 * PRIVATE is orthogonal to retraction and interpretation. It preserves the
 * complete local record while making the entry structurally provider-ineligible.
 */
export function markJournalEntryPrivate(
  entries: readonly JournalEntry[],
  id: string
): JournalEntry[] {
  return updateJournalEntry(entries, id, (entry) =>
    entry.privacy === 'private' ? entry : { ...entry, privacy: 'private' }
  );
}

/**
 * Retraction is history-preserving. The record remains in the local Atlas with
 * its original text, links, privacy state and timestamp; only authority changes.
 */
export function retractJournalEntry(
  entries: readonly JournalEntry[],
  id: string
): JournalEntry[] {
  return updateJournalEntry(entries, id, (entry) =>
    entry.status === 'retracted' ? entry : { ...entry, status: 'retracted' }
  );
}

export interface JournalDayGroup {
  /** Local calendar day, `YYYY-MM-DD`. */
  dayKey: string;
  /** Entries for this day, newest first. */
  entries: JournalEntry[];
}

/**
 * Calendar day for history navigation.
 *
 * `timeZone` is injectable so tests are deterministic; the app passes nothing
 * and gets the device's local day.
 */
export function journalEntryDayKey(entry: Pick<JournalEntry, 'createdAt'>, timeZone?: string): string {
  const date = new Date(entry.createdAt);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Invalid JournalEntry createdAt: ' + entry.createdAt);
  }
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(date);
}

/**
 * J06 history grouping: newest day first, newest entry first within a day.
 *
 * PRIVATE and retracted entries stay in local history (they are Greyson's own
 * records); callers render their status rather than hiding them.
 */
export function groupJournalEntriesByDay(
  entries: readonly JournalEntry[],
  timeZone?: string
): JournalDayGroup[] {
  const groups: JournalDayGroup[] = [];
  for (const entry of selectJournalEntriesNewestFirst(entries)) {
    const dayKey = journalEntryDayKey(entry, timeZone);
    const last = groups[groups.length - 1];
    if (last && last.dayKey === dayKey) last.entries.push(entry);
    else groups.push({ dayKey, entries: [entry] });
  }
  return groups;
}
