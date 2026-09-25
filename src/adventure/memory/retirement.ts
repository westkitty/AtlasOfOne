import type { CampaignState } from '../../game/types';
import { createV2ProvenanceVisibility, retireIneligibleV2DerivedState } from '../../persistence/retirement';
import type { AdventureMemory } from '../schema';
import { retrieveAdventureMemories, type MemoryQuery, type RankedMemory } from './retrieval';

/**
 * N04 memory retirement/withholding for PRIVATE or retracted provenance.
 *
 * Reuses the M06 provenance graph in src/persistence/retirement.ts rather than
 * inventing a second privacy rule:
 * - retrieval gate (strict): a card is usable only if adventureMemoryIsEligible,
 *   i.e. active, normal privacy, and EVERY source id is eligible;
 * - retirement (durable): a card is retired when NO source remains eligible,
 *   exactly as retireIneligibleV2DerivedState does (gaps/seeds cascade first).
 * Mixed-provenance cards are therefore withheld from context but kept active.
 */

export function eligibleAdventureMemories(state: CampaignState): AdventureMemory[] {
  const visibility = createV2ProvenanceVisibility(state);
  return state.adventureMemories.filter((memory) => visibility.adventureMemoryIsEligible(memory.id));
}

/** Retrieval over provenance-eligible cards only. */
export function retrieveEligibleAdventureMemories(state: CampaignState, query: MemoryQuery): RankedMemory[] {
  return retrieveAdventureMemories(eligibleAdventureMemories(state), query);
}

/**
 * Return the adventureMemories array with ineligible-provenance cards retired.
 * Delegates the cascade to M06 so gap -> seed -> memory transitivity matches.
 */
export function retireAdventureMemoriesWithIneligibleSources(state: CampaignState): AdventureMemory[] {
  return retireIneligibleV2DerivedState(state).adventureMemories;
}
