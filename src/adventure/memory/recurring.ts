import type { CampaignState } from '../../game/types';
import { findAdventureTemplate } from '../content/templates';
import { DEFAULT_ADVENTURE_MEMORY_BUDGET, selectMemoriesWithinBudget, type AdventureMemoryBudget } from './budget';
import { eligibleAdventureMemories } from './retirement';
import { retrieveAdventureMemories, type RankedMemory } from './retrieval';

/**
 * N05 recurring NPC/place reference.
 *
 * When a new adventure starts in a territory, select prior memory cards the
 * scene MAY reference. Pipeline: N04 gate (eligibleAdventureMemories) ->
 * N02 retrieval on the territory term -> N03 budget. Cards sourced from the
 * current run/seed are excluded so a run never "remembers" itself.
 *
 * The local-fallback line names a prior character/place only by its
 * structural label (the authored template title), never by memory summary,
 * journal text or action text.
 */

export interface RecurringReferenceInput {
  territoryId: string;
  /** The new run (and its seed) — their own cards are never recurring references. */
  currentRunId?: string;
  currentSeedId?: string;
  budget?: AdventureMemoryBudget;
}

export interface RecurringReferences {
  memories: readonly RankedMemory[];
  fallbackLine: string | null;
}

const RECURRING_TYPES = new Set(['character', 'place']);

function structuralLabel(ranked: RankedMemory): string | undefined {
  for (const term of ranked.memory.triggerTerms) {
    const template = findAdventureTemplate(term);
    if (template) return template.title;
  }
  return undefined;
}

export function recurringFallbackLine(selected: readonly RankedMemory[]): string | null {
  for (const ranked of selected) {
    if (!RECURRING_TYPES.has(ranked.memory.type)) continue;
    const label = structuralLabel(ranked);
    if (!label) continue;
    return ranked.memory.type === 'character'
      ? `A familiar face from "${label}" is somewhere nearby.`
      : `The path passes the place from "${label}" again.`;
  }
  return null;
}

export function selectRecurringReferences(state: CampaignState, input: RecurringReferenceInput): RecurringReferences {
  const territory = input.territoryId.trim().toLowerCase();
  if (!territory) throw new Error('territoryId must not be empty.');
  const excluded = new Set([input.currentRunId, input.currentSeedId].filter((id): id is string => Boolean(id)));
  const prior = eligibleAdventureMemories(state).filter((memory) =>
    memory.triggerTerms.includes(territory) && !memory.sourceIds.some((id) => excluded.has(id)));
  const ranked = retrieveAdventureMemories(prior, { terms: [territory] })
    // Recurring NPCs/places first; stable within the N02 order otherwise.
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) =>
      Number(RECURRING_TYPES.has(right.entry.memory.type)) - Number(RECURRING_TYPES.has(left.entry.memory.type))
      || left.index - right.index)
    .map(({ entry }) => entry);
  const { selected } = selectMemoriesWithinBudget(ranked, input.budget ?? DEFAULT_ADVENTURE_MEMORY_BUDGET);
  return { memories: selected, fallbackLine: recurringFallbackLine(selected) };
}
