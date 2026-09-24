import type { CampaignState } from '../game/types';
import { journalEntrySchema, type JournalEntry } from './schema';

export type JournalLinkTarget =
  | { kind: 'reflection'; id: string }
  | { kind: 'adventure'; id: string };

/**
 * Journal "adventure" links refer to concrete AdventureRun ids, not AdventureSeed ids.
 * A seed is an eligible proposal; a run is the actual played/history-bearing adventure.
 */
export function linkJournalEntry(
  state: CampaignState,
  journalEntryId: string,
  target: JournalLinkTarget
): CampaignState {
  const journalIndex = state.journalEntries.findIndex((entry) => entry.id === journalEntryId);
  if (journalIndex < 0) throw new Error(`Unknown JournalEntry id: ${journalEntryId}`);

  const entry = state.journalEntries[journalIndex];
  if (entry.status === 'retracted') {
    throw new Error(`Cannot add a new link to retracted JournalEntry: ${journalEntryId}`);
  }

  if (target.kind === 'reflection') {
    const reflection = state.reflections.find((record) => record.id === target.id);
    if (!reflection) throw new Error(`Unknown ReflectionRecord id: ${target.id}`);
    if (reflection.recordStatus !== 'active') {
      throw new Error(`Cannot link retracted ReflectionRecord: ${target.id}`);
    }
  } else {
    const run = state.adventureRuns.find((record) => record.id === target.id);
    if (!run) throw new Error(`Unknown AdventureRun id: ${target.id}`);
  }

  const nextEntry: JournalEntry = journalEntrySchema.parse(
    target.kind === 'reflection'
      ? {
          ...entry,
          linkedReflectionIds: entry.linkedReflectionIds.includes(target.id)
            ? entry.linkedReflectionIds
            : [...entry.linkedReflectionIds, target.id]
        }
      : {
          ...entry,
          linkedAdventureIds: entry.linkedAdventureIds.includes(target.id)
            ? entry.linkedAdventureIds
            : [...entry.linkedAdventureIds, target.id]
        }
  );

  if (nextEntry === entry
    || (nextEntry.linkedReflectionIds === entry.linkedReflectionIds
      && nextEntry.linkedAdventureIds === entry.linkedAdventureIds)) {
    return state;
  }

  const journalEntries = state.journalEntries.slice();
  journalEntries[journalIndex] = nextEntry;
  return { ...state, journalEntries };
}
