import { adventureMemorySchema, type AdventureMemory, type AdventureRun } from '../schema';

/**
 * N00 typed AdventureMemory card helpers (section 14.2). Uses the existing
 * D05 AdventureMemory shape unchanged; every helper is pure.
 */

export const ADVENTURE_MEMORY_SUMMARY_MAX_LENGTH = 280;
export const ADVENTURE_MEMORY_MAX_TRIGGER_TERMS = 12;
export const ADVENTURE_MEMORY_TRIGGER_TERM_MAX_LENGTH = 40;

export type AdventureMemoryType = AdventureMemory['type'];

function requireInstant(value: string, label: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${label}: ${value}`);
  return value;
}

/** Lowercase, trim, collapse whitespace, dedupe and sort. Empty terms are dropped. */
export function normalizeTriggerTerms(terms: readonly string[]): string[] {
  const normalized = terms
    .map((term) => term.trim().toLowerCase().replace(/\s+/g, ' '))
    .filter((term) => term.length > 0);
  for (const term of normalized) {
    if (term.length > ADVENTURE_MEMORY_TRIGGER_TERM_MAX_LENGTH) {
      throw new Error(`Trigger term exceeds ${ADVENTURE_MEMORY_TRIGGER_TERM_MAX_LENGTH} characters.`);
    }
  }
  const unique = [...new Set(normalized)].sort();
  if (unique.length > ADVENTURE_MEMORY_MAX_TRIGGER_TERMS) {
    throw new Error(`AdventureMemory allows at most ${ADVENTURE_MEMORY_MAX_TRIGGER_TERMS} trigger terms.`);
  }
  return unique;
}

export interface CreateAdventureMemoryInput {
  id: string;
  type: AdventureMemoryType;
  summary: string;
  triggerTerms: readonly string[];
  sourceIds: readonly string[];
  privacy?: AdventureMemory['privacy'];
}

/**
 * Create an active memory card. Provenance is mandatory (D05): a card with no
 * sourceIds could never be retired when its source becomes PRIVATE/retracted.
 */
export function createAdventureMemory(input: CreateAdventureMemoryInput): AdventureMemory {
  if (!input.id.trim()) throw new Error('AdventureMemory id must not be empty.');
  const summary = input.summary.trim();
  if (!summary) throw new Error('AdventureMemory summary must not be empty.');
  if (summary.length > ADVENTURE_MEMORY_SUMMARY_MAX_LENGTH) {
    throw new Error(`AdventureMemory summary exceeds ${ADVENTURE_MEMORY_SUMMARY_MAX_LENGTH} characters.`);
  }
  const sourceIds = [...new Set(input.sourceIds.map((id) => id.trim()).filter(Boolean))].sort();
  if (sourceIds.length === 0) throw new Error('AdventureMemory requires at least one source id.');
  return adventureMemorySchema.strict().parse({
    id: input.id,
    type: input.type,
    summary,
    triggerTerms: normalizeTriggerTerms(input.triggerTerms),
    sourceIds,
    privacy: input.privacy ?? 'normal',
    status: 'active'
  });
}

export function isActiveAdventureMemory(memory: AdventureMemory): boolean {
  return memory.status === 'active';
}

/** Record that a card was used in context. Never moves time backwards. */
export function touchAdventureMemory(memory: AdventureMemory, at: string): AdventureMemory {
  requireInstant(at, 'lastUsedAt');
  if (memory.status !== 'active') throw new Error(`AdventureMemory ${memory.id} is retired.`);
  if (memory.lastUsedAt && Date.parse(memory.lastUsedAt) >= Date.parse(at)) return memory;
  return { ...memory, lastUsedAt: at };
}

/** Retirement preserves the historical card; it only removes its authority. */
export function retireAdventureMemory(memory: AdventureMemory): AdventureMemory {
  if (memory.status === 'retired') return memory;
  return { ...memory, status: 'retired' };
}

export function markAdventureMemoryPrivate(memory: AdventureMemory): AdventureMemory {
  if (memory.privacy === 'private') return memory;
  return { ...memory, privacy: 'private' };
}

/** Link a memory card to a run (run.memoryIds stays sorted and unique). */
export function attachMemoryToRun(run: AdventureRun, memoryId: string): AdventureRun {
  if (!memoryId.trim()) throw new Error('memoryId must not be empty.');
  if (run.memoryIds.includes(memoryId)) return run;
  return { ...run, memoryIds: [...run.memoryIds, memoryId].sort() };
}

/** Insert or replace by id; result order is stable by id. */
export function upsertAdventureMemory(
  memories: readonly AdventureMemory[],
  memory: AdventureMemory
): AdventureMemory[] {
  const parsed = adventureMemorySchema.parse(memory);
  return [...memories.filter((existing) => existing.id !== parsed.id), parsed]
    .sort((left, right) => left.id.localeCompare(right.id));
}
