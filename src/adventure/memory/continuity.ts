import type { AdventureMemory } from '../schema';
import type { EligibleAdventureMemory } from './eligible';
import { retireAdventureMemory } from './records';
import { retrieveAdventureMemories, type MemoryQuery } from './retrieval';

/**
 * N06 promise / object / place continuity helpers.
 *
 * Pure grouping over N04-gated cards (`eligibleAdventureMemories`); the
 * EligibleAdventureMemory type makes raw state arrays a compile error.
 */

export interface ContinuityDigest {
  openPromises: readonly EligibleAdventureMemory[];
  objects: readonly EligibleAdventureMemory[];
  places: readonly EligibleAdventureMemory[];
}

const usable = (memory: AdventureMemory) => memory.status === 'active' && memory.privacy === 'normal';
const byId = (left: AdventureMemory, right: AdventureMemory) => left.id.localeCompare(right.id);

/** Everything the world should still remember, grouped. Stable order by id. */
export function continuityDigest(memories: readonly EligibleAdventureMemory[]): ContinuityDigest {
  const active = memories.filter(usable);
  return {
    openPromises: active.filter((memory) => memory.type === 'promise').sort(byId),
    objects: active.filter((memory) => memory.type === 'object').sort(byId),
    places: active.filter((memory) => memory.type === 'place').sort(byId)
  };
}

/** Continuity that is relevant to the current scene (N02 ranking, restricted to the three types). */
export function relevantContinuity(memories: readonly EligibleAdventureMemory[], query: MemoryQuery): ContinuityDigest {
  const ranked = retrieveAdventureMemories(
    memories.filter((memory) => memory.type === 'promise' || memory.type === 'object' || memory.type === 'place'),
    query
  ).map((entry) => entry.memory);
  return {
    openPromises: ranked.filter((memory) => memory.type === 'promise'),
    objects: ranked.filter((memory) => memory.type === 'object'),
    places: ranked.filter((memory) => memory.type === 'place')
  };
}

/** A kept or released promise stops being open; the card remains as history. */
export function resolvePromise(memory: AdventureMemory): AdventureMemory {
  if (memory.type !== 'promise') throw new Error(`AdventureMemory ${memory.id} is a ${memory.type}, not a promise.`);
  return retireAdventureMemory(memory);
}

/** Objects that a place card references by trigger term (e.g. what was left at a landmark). */
export function objectsAtPlace(memories: readonly EligibleAdventureMemory[], place: AdventureMemory): EligibleAdventureMemory[] {
  if (place.type !== 'place') throw new Error(`AdventureMemory ${place.id} is not a place.`);
  const placeTerms = new Set(place.triggerTerms);
  return memories
    .filter(usable)
    .filter((memory) => memory.type === 'object')
    .filter((memory) => memory.sourceIds.includes(place.id) || memory.triggerTerms.some((term) => placeTerms.has(term)))
    .sort(byId);
}
