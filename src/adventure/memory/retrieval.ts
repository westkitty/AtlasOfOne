import type { AdventureMemory } from '../schema';

/**
 * N02 deterministic memory retrieval without vectors (section 14.4).
 *
 * Score = 3 per direct entity reference (memory id or a source id)
 *       + 2 per matched trigger term (exact term or all words of a multi-word term).
 * Recency (lastUsedAt) and id only break ties; recency alone never makes an
 * irrelevant card relevant. Only active, normal-privacy cards are candidates;
 * callers should additionally pre-filter with the N04 provenance gate.
 */

export const ENTITY_MATCH_WEIGHT = 3;
export const TERM_MATCH_WEIGHT = 2;

export interface MemoryQuery {
  /** Direct entity references, e.g. NPC, place, run or seed ids in the current scene. */
  entityIds?: readonly string[];
  /** Free text from the current scene/action; tokenized locally. */
  text?: string;
  /** Additional explicit tags. */
  terms?: readonly string[];
}

export interface RankedMemory {
  memory: AdventureMemory;
  score: number;
  matchedEntityIds: readonly string[];
  matchedTerms: readonly string[];
}

export function tokenize(text: string): string[] {
  return text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((token) => token.length > 0);
}

function recencyValue(memory: AdventureMemory): number {
  if (!memory.lastUsedAt) return Number.NEGATIVE_INFINITY;
  const value = Date.parse(memory.lastUsedAt);
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

export function compareRankedMemories(left: RankedMemory, right: RankedMemory): number {
  if (right.score !== left.score) return right.score - left.score;
  const lr = recencyValue(left.memory);
  const rr = recencyValue(right.memory);
  if (lr !== rr) return rr > lr ? 1 : -1;
  return left.memory.id.localeCompare(right.memory.id);
}

export function scoreAdventureMemory(memory: AdventureMemory, query: MemoryQuery): RankedMemory {
  const entities = new Set(query.entityIds ?? []);
  const tokens = new Set([...tokenize(query.text ?? ''), ...(query.terms ?? []).flatMap(tokenize)]);
  const phrases = new Set((query.terms ?? []).map((term) => term.trim().toLowerCase()));

  const matchedEntityIds = [memory.id, ...memory.sourceIds]
    .filter((id, index, all) => entities.has(id) && all.indexOf(id) === index)
    .sort();
  const matchedTerms = memory.triggerTerms
    .filter((term) => {
      const words = tokenize(term);
      return phrases.has(term) || (words.length > 0 && words.every((word) => tokens.has(word)));
    })
    .sort();

  return {
    memory,
    score: matchedEntityIds.length * ENTITY_MATCH_WEIGHT + matchedTerms.length * TERM_MATCH_WEIGHT,
    matchedEntityIds,
    matchedTerms
  };
}

export function retrieveAdventureMemories(
  memories: readonly AdventureMemory[],
  query: MemoryQuery
): RankedMemory[] {
  return memories
    .filter((memory) => memory.status === 'active' && memory.privacy === 'normal')
    .map((memory) => scoreAdventureMemory(memory, query))
    .filter((ranked) => ranked.score > 0)
    .sort(compareRankedMemories);
}
