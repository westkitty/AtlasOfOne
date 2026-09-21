import type { JournalEntry, JournalInputMode, JournalPrivacy } from '../contracts/journal';
import type { CampaignState } from '../game/types';
import { retireIneligibleV2State } from '../persistence/retirement';

export interface JournalEntryInput {
  text: string;
  inputMode: JournalInputMode;
  privacy: JournalPrivacy;
  sourcePrompt?: string;
}

export interface JournalEntryFactoryOptions {
  id?: string;
  createdAt?: string;
  createId?: () => string;
  now?: () => string;
}

const defaultId = () => `journal_${crypto.randomUUID()}`;
const defaultNow = () => new Date().toISOString();

/** Creates a durable Journal record without involving game events or progression. */
export function createJournalEntry(input: JournalEntryInput, options: JournalEntryFactoryOptions = {}): JournalEntry {
  const text = input.text.trim();
  if (!text) throw new Error('Journal entries must contain text.');
  return {
    id: options.id ?? options.createId?.() ?? defaultId(),
    createdAt: options.createdAt ?? options.now?.() ?? defaultNow(),
    text,
    inputMode: input.inputMode,
    privacy: input.privacy,
    status: 'active',
    ...(input.sourcePrompt?.trim() ? { sourcePrompt: input.sourcePrompt.trim() } : {}),
    reflectionIds: [],
    adventureIds: []
  };
}

/** The stable display order: newest timestamp first, newest insertion first on ties. */
export function journalEntriesNewestFirst(entries: readonly JournalEntry[]): JournalEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => right.entry.createdAt.localeCompare(left.entry.createdAt) || right.index - left.index)
    .map(({ entry }) => entry);
}

export const journalEntryDate = (entry: Pick<JournalEntry, 'createdAt'>) => entry.createdAt.slice(0, 10);

export function journalEntryDates(entries: readonly JournalEntry[]): string[] {
  return [...new Set(journalEntriesNewestFirst(entries).map(journalEntryDate))];
}

export function journalEntriesForDate(entries: readonly JournalEntry[], date: string): JournalEntry[] {
  return journalEntriesNewestFirst(entries).filter((entry) => journalEntryDate(entry) === date);
}

export function saveJournalEntry(state: CampaignState, input: JournalEntryInput, options: JournalEntryFactoryOptions = {}): CampaignState {
  const entry = createJournalEntry(input, options);
  return { ...state, journalEntries: [...state.journalEntries, entry], updatedAt: entry.createdAt };
}

function updateEntry(state: CampaignState, entryId: string, update: (entry: JournalEntry) => JournalEntry, updatedAt?: string): CampaignState {
  let changed = false;
  const journalEntries = state.journalEntries.map((entry) => {
    if (entry.id !== entryId) return entry;
    const next = update(entry);
    changed ||= next !== entry;
    return next;
  });
  if (!changed) return state;
  return retireIneligibleV2State({ ...state, journalEntries, updatedAt: updatedAt ?? state.updatedAt });
}

export function setJournalEntryPrivacy(state: CampaignState, entryId: string, privacy: JournalPrivacy, updatedAt?: string): CampaignState {
  return updateEntry(state, entryId, (entry) => entry.privacy === privacy ? entry : { ...entry, privacy }, updatedAt);
}

export function retractJournalEntry(state: CampaignState, entryId: string, updatedAt?: string): CampaignState {
  return updateEntry(state, entryId, (entry) => entry.status === 'retracted' ? entry : { ...entry, status: 'retracted' }, updatedAt);
}

export function linkJournalEntry(state: CampaignState, entryId: string, links: { reflectionId?: string; adventureId?: string }, updatedAt?: string): CampaignState {
  return updateEntry(state, entryId, (entry) => {
    const reflectionIds = links.reflectionId ? [...new Set([...entry.reflectionIds, links.reflectionId])] : entry.reflectionIds;
    const adventureIds = links.adventureId ? [...new Set([...entry.adventureIds, links.adventureId])] : entry.adventureIds;
    return reflectionIds === entry.reflectionIds && adventureIds === entry.adventureIds
      ? entry
      : { ...entry, reflectionIds, adventureIds };
  }, updatedAt);
}
