import { describe, expect, it } from 'vitest';
import { retrieveAdventureMemories, scoreAdventureMemory, tokenize } from '../../../src/adventure/memory/retrieval';
import { mem } from './fixtures';

const bank = [
  mem({ id: 'ferry', triggerTerms: ['ferry', 'pell'], sourceIds: ['run_1'] }),
  mem({ id: 'mill', type: 'place', summary: 'The old mill.', triggerTerms: ['old mill', 'river'], sourceIds: ['run_2'] }),
  mem({ id: 'npc_bram', summary: 'Bram the baker.', triggerTerms: ['bakery', 'bram'], sourceIds: ['run_3'], lastUsedAt: '2026-01-03T00:00:00.000Z' }),
  mem({ id: 'bakery', type: 'place', summary: 'The bakery.', triggerTerms: ['bakery'], sourceIds: ['run_3'], lastUsedAt: '2026-01-05T00:00:00.000Z' }),
  mem({ id: 'retired', triggerTerms: ['ferry'], status: 'retired' }),
  mem({ id: 'private', triggerTerms: ['ferry'], privacy: 'private' })
];

describe('N02 entity/tag/recency retrieval without vectors', () => {
  it('tokenizes locally', () => {
    expect(tokenize('Meet Pell at the FERRY, then the old-mill!'))
      .toEqual(['meet', 'pell', 'at', 'the', 'ferry', 'then', 'the', 'old', 'mill']);
  });

  it('ranks direct entity references above tag matches', () => {
    const ranked = retrieveAdventureMemories(bank, { entityIds: ['npc_bram'], text: 'I walk to the river' });
    expect(ranked.map((r) => [r.memory.id, r.score])).toEqual([['npc_bram', 3], ['mill', 2]]);
  });

  it('matches multi-word triggers only when every word is present', () => {
    expect(scoreAdventureMemory(bank[1]!, { text: 'the old barn' }).matchedTerms).toEqual([]);
    expect(scoreAdventureMemory(bank[1]!, { text: 'past the old mill' }).matchedTerms).toEqual(['old mill']);
    expect(scoreAdventureMemory(bank[1]!, { terms: ['Old Mill'] }).matchedTerms).toEqual(['old mill']);
  });

  it('breaks score ties by recency, then id', () => {
    expect(retrieveAdventureMemories(bank, { text: 'bakery' }).map((r) => r.memory.id)).toEqual(['bakery', 'npc_bram']);
    const tie = retrieveAdventureMemories([mem({ id: 'b', triggerTerms: ['x'] }), mem({ id: 'a', triggerTerms: ['x'] })], { text: 'x' });
    expect(tie.map((r) => r.memory.id)).toEqual(['a', 'b']);
  });

  it('never returns retired, private, or zero-score cards; recency alone is not relevance', () => {
    expect(retrieveAdventureMemories(bank, { text: 'ferry' }).map((r) => r.memory.id)).toEqual(['ferry']);
    expect(retrieveAdventureMemories(bank, { text: 'unrelated words' })).toEqual([]);
    expect(retrieveAdventureMemories(bank, {})).toEqual([]);
  });

  it('matches source ids as entity references and is order-independent', () => {
    const ranked = retrieveAdventureMemories(bank, { entityIds: ['run_3'] });
    expect(ranked.map((r) => r.memory.id)).toEqual(['bakery', 'npc_bram']);
    expect(retrieveAdventureMemories([...bank].reverse(), { entityIds: ['run_3'] })).toEqual(ranked);
  });
});
