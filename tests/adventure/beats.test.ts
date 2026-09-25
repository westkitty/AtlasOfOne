import { describe, expect, it } from 'vitest';
import {
  ADVENTURE_BEATS,
  MAX_ADVENTURE_BEATS,
  adventureBeatPlan,
  buildLocalBeatFrame,
  isAdventureBeat,
  nextAdventureBeat
} from '../../src/adventure/beats';
import type { AdventureSeed } from '../../src/adventure/schema';
import { createPureFunAdventureSeed } from '../../src/adventure/seeds';

const seed: AdventureSeed = {
  id: 'seed_1', sourceGapIds: ['gap_a'], kind: 'investigation', territoryId: 'identity',
  premise: 'A lantern flickers.', learningTarget: 'reflection-eligible', status: 'available'
};
const fun = createPureFunAdventureSeed({ id: 'fun_1', territoryId: 'identity', premise: 'A goose steals a hat.' });

describe('six-beat bounded runtime skeleton (A03)', () => {
  it('has exactly six ordered beats and never exceeds the cap', () => {
    expect(MAX_ADVENTURE_BEATS).toBe(6);
    expect(adventureBeatPlan(seed)).toEqual(ADVENTURE_BEATS);
    expect(adventureBeatPlan(fun).length).toBeLessThanOrEqual(MAX_ADVENTURE_BEATS);
  });

  it('omits the reflection beat for learningTarget none', () => {
    expect(adventureBeatPlan(fun)).not.toContain('optional-reflection');
    expect(nextAdventureBeat(fun, 'choice-consequence')).toBeNull();
    expect(nextAdventureBeat(seed, 'choice-consequence')).toBe('optional-reflection');
  });

  it('rejects beats outside the plan', () => {
    expect(isAdventureBeat('hook')).toBe(true);
    expect(isAdventureBeat('epilogue')).toBe(false);
    expect(() => nextAdventureBeat(seed, 'epilogue')).toThrow();
    expect(() => buildLocalBeatFrame(fun, 'optional-reflection')).toThrow();
  });

  it('renders every beat locally and deterministically with withdrawal always offered', () => {
    const frames = adventureBeatPlan(seed).map((beat) => buildLocalBeatFrame(seed, beat));
    expect(frames.map((frame) => frame.index)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(frames.every((frame) => frame.total === 6 && frame.withdrawalAvailable)).toBe(true);
    expect(frames.every((frame) => frame.heading.length > 0 && frame.prompt.length > 0)).toBe(true);
    expect(frames[0].prompt).toContain('A lantern flickers.');
    expect(buildLocalBeatFrame(seed, 'hook')).toEqual(buildLocalBeatFrame(seed, 'hook'));
  });

  it('pure-fun frames never mention reflection', () => {
    const text = adventureBeatPlan(fun).map((beat) => JSON.stringify(buildLocalBeatFrame(fun, beat))).join(' ');
    expect(text).not.toMatch(/reflect/i);
  });

  it('falls back to generic flavor for kinds without a bespoke template', () => {
    expect(buildLocalBeatFrame({ ...seed, kind: 'negotiation' }, 'hook').prompt).toContain('A lantern flickers.');
  });
});
