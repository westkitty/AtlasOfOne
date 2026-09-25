import type { AdventureMemory } from '../schema';

declare const eligibleBrand: unique symbol;

/**
 * An AdventureMemory that has passed the N04 provenance gate (active, normal
 * privacy, and EVERY source eligible). Only `eligibleAdventureMemories(state)`
 * produces this type, so retrieval/continuity helpers cannot be fed raw
 * `state.adventureMemories` (which may include mixed-provenance cards whose
 * summaries reflect PRIVATE/retracted sources).
 */
export type EligibleAdventureMemory = AdventureMemory & { readonly [eligibleBrand]: true };
