import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADVENTURE_BEATS } from '../../src/adventure/beats';
import {
  adventureSceneProposalSchema,
  parseAdventureSceneProposalForContext
} from '../../src/cartographer/adventureSceneProposal';
import {
  ADVENTURE_CONTINUATION_BANK,
  ADVENTURE_CONTINUATION_LABEL_MAX,
  CONTINUATION_BEATS,
  localAdventureContinuation
} from '../../src/cartographer/fallbacks/adventureContinuation';

afterEach(() => vi.unstubAllGlobals());

describe('P10 local adventure continuation fallback', () => {
  it('validates against the AdventureSceneProposal schema for every beat', () => {
    for (const beat of ADVENTURE_BEATS) {
      const proposal = localAdventureContinuation('run_1', beat, 'Ring the bell');
      expect(adventureSceneProposalSchema.parse(proposal)).toEqual(proposal);
      expect(proposal.choices.length).toBeGreaterThan(0);
      expect(proposal.sceneProse).toContain('ring the bell');
    }
  });

  it('is deterministic in seed + beat + label and works offline (no fetch)', () => {
    vi.stubGlobal('fetch', () => { throw new Error('network forbidden'); });
    const a = localAdventureContinuation('run_7', 'complication', 'Ask the keeper');
    const b = localAdventureContinuation('run_7', 'complication', 'Ask the keeper');
    expect(a).toEqual(b);
    const seeds = new Set(Array.from({ length: 20 }, (_, i) =>
      localAdventureContinuation(`run_${i}`, 'complication', 'x').sceneProse));
    expect(seeds.size).toBe(ADVENTURE_CONTINUATION_BANK.complication.length);
  });

  it('references no IDs so it passes an empty bounded-context allow-list', () => {
    const proposal = localAdventureContinuation('run_1', 'encounter', 'Talk');
    expect(() => parseAdventureSceneProposalForContext(proposal, { entityIds: [], npcIds: [], memoryIds: [] })).not.toThrow();
    expect(proposal.dialogue).toEqual([]);
  });

  it('clips long labels, handles blank labels, and carries no mechanics fields', () => {
    const long = localAdventureContinuation('run_1', 'approach', `Go ${'far '.repeat(100)}`);
    expect(long.sceneProse.length).toBeLessThan(200 + ADVENTURE_CONTINUATION_LABEL_MAX);
    expect(localAdventureContinuation('run_1', 'approach', '   ').sceneProse).toContain('carry on');
    const keys = Object.keys(localAdventureContinuation('run_1', 'hook', 'Look'));
    for (const forbidden of ['xp', 'hp', 'damage', 'reward', 'outcome', 'evidence']) expect(keys).not.toContain(forbidden);
  });

  it('local beat list mirrors ADVENTURE_BEATS exactly', () => {
    expect([...CONTINUATION_BEATS]).toEqual([...ADVENTURE_BEATS]);
  });

  it('accepts no journal text parameter (signature is seed, beat, label)', () => {
    expect(localAdventureContinuation.length).toBe(3);
  });
});
