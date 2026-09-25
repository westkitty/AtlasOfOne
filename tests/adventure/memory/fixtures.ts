import type { AdventureMemory } from '../../../src/adventure/schema';
import type { EligibleAdventureMemory } from '../../../src/adventure/memory/eligible';

export const mem = (overrides: Partial<AdventureMemory> = {}): AdventureMemory => ({
  id: 'mem_1',
  type: 'character',
  summary: 'Pell the ferry keeper owes the player a favour.',
  triggerTerms: ['ferry', 'pell'],
  sourceIds: ['run_1'],
  privacy: 'normal',
  status: 'active',
  ...overrides
});

/**
 * Test-only stand-in for the N04 gate. Production code gets
 * EligibleAdventureMemory only from `eligibleAdventureMemories(state)`.
 */
export const asGated = (memory: AdventureMemory): EligibleAdventureMemory => memory as EligibleAdventureMemory;
export const gatedMem = (...args: Parameters<typeof mem>): EligibleAdventureMemory => asGated(mem(...args));
