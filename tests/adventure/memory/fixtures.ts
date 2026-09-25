import type { AdventureMemory } from '../../../src/adventure/schema';

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
