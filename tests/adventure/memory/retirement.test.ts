import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../../src/game/engine';
import type { CampaignState } from '../../../src/game/types';
import {
  eligibleAdventureMemories,
  retireAdventureMemoriesWithIneligibleSources,
  retrieveEligibleAdventureMemories
} from '../../../src/adventure/memory/retirement';
import { mem } from './fixtures';

function stateWith(privacy: 'normal' | 'private', status: 'active' | 'retracted' = 'active'): CampaignState {
  const state = createInitialCampaign();
  state.journalEntries = [
    { id: 'journal_x', createdAt: '2026-01-01T00:00:00.000Z', text: 'PRIVATE_CANARY_JOURNAL', inputMode: 'typed', privacy, status, linkedReflectionIds: [], linkedAdventureIds: [] },
    { id: 'journal_ok', createdAt: '2026-01-01T00:00:00.000Z', text: 'Synthetic public entry.', inputMode: 'typed', privacy: 'normal', status: 'active', linkedReflectionIds: [], linkedAdventureIds: [] }
  ] as CampaignState['journalEntries'];
  state.adventureMemories = [
    mem({ id: 'mem_canary', summary: 'PRIVATE_CANARY_MEMORY about the ferry.', triggerTerms: ['ferry'], sourceIds: ['journal_x'] }),
    mem({ id: 'mem_mixed', summary: 'Mixed provenance ferry card.', triggerTerms: ['ferry'], sourceIds: ['journal_ok', 'journal_x'] }),
    mem({ id: 'mem_ok', summary: 'Public ferry card.', triggerTerms: ['ferry'], sourceIds: ['journal_ok'] })
  ];
  return state;
}

describe('N04 retire memory from PRIVATE/retracted sources', () => {
  it('baseline: normal sources are all eligible and stay active', () => {
    const state = stateWith('normal');
    expect(eligibleAdventureMemories(state).map((m) => m.id)).toEqual(['mem_canary', 'mem_mixed', 'mem_ok']);
    expect(retireAdventureMemoriesWithIneligibleSources(state).every((m) => m.status === 'active')).toBe(true);
  });

  for (const [label, privacy, status] of [['PRIVATE', 'private', 'active'], ['retracted', 'normal', 'retracted']] as const) {
    it(`${label} source: canary never reaches retrieval and its card is retired`, () => {
      const state = stateWith(privacy, status);
      const ranked = retrieveEligibleAdventureMemories(state, { text: 'ferry' });
      expect(ranked.map((r) => r.memory.id)).toEqual(['mem_ok']);
      expect(JSON.stringify(ranked)).not.toContain('PRIVATE_CANARY');

      const memories = retireAdventureMemoriesWithIneligibleSources(state);
      const byId = Object.fromEntries(memories.map((m) => [m.id, m]));
      expect(byId.mem_canary!.status).toBe('retired');
      expect(byId.mem_canary!.summary).toContain('PRIVATE_CANARY_MEMORY');
      // Mixed provenance: withheld from context (strict gate) but not retired (M06 rule).
      expect(byId.mem_mixed!.status).toBe('active');
      expect(byId.mem_ok!.status).toBe('active');
    });
  }

  it('fails closed on unknown or missing provenance', () => {
    const state = createInitialCampaign();
    state.adventureMemories = [mem({ id: 'orphan', sourceIds: ['does_not_exist'] }), mem({ id: 'none', sourceIds: [] })];
    expect(eligibleAdventureMemories(state)).toEqual([]);
    expect(retireAdventureMemoriesWithIneligibleSources(state).map((m) => m.status)).toEqual(['retired', 'retired']);
  });

  it('does not mutate the input state', () => {
    const state = stateWith('private');
    const snapshot = JSON.stringify(state);
    retireAdventureMemoriesWithIneligibleSources(state);
    retrieveEligibleAdventureMemories(state, { text: 'ferry' });
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
