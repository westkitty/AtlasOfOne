import { afterEach, describe, expect, it, vi } from 'vitest';
import { adventureBeatPlan } from '../../src/adventure/beats';
import {
  FALLBACK_WITHDRAW_OPTION,
  renderFallbackAdventure,
  renderFallbackBeat
} from '../../src/adventure/fallbackRenderer';
import { ADVENTURE_KINDS, type AdventureSeed } from '../../src/adventure/schema';
import { createPureFunAdventureSeed } from '../../src/adventure/seeds';

const seed = (overrides: Partial<AdventureSeed> = {}): AdventureSeed => ({
  id: 'seed_1', sourceGapIds: ['gap_a'], kind: 'investigation', territoryId: 'identity',
  premise: 'A lantern flickers.', learningTarget: 'reflection-eligible', status: 'available', ...overrides
});

afterEach(() => vi.unstubAllGlobals());

describe('A06 local fallback adventure renderer', () => {
  it('renders every beat of the plan with a withdraw option and free input', () => {
    const frames = renderFallbackAdventure(seed());
    expect(frames.map((frame) => frame.beat)).toEqual(adventureBeatPlan(seed()));
    for (const frame of frames) {
      expect(frame.withdrawOption).toEqual(FALLBACK_WITHDRAW_OPTION);
      expect(frame.freeInputAccepted).toBe(true);
      expect(frame.source).toBe('local-fallback');
      expect(frame.options.length).toBeGreaterThan(0);
      expect(frame.options.some((option) => option.id === 'withdraw')).toBe(false);
      expect(frame.prompt.length).toBeGreaterThan(0);
    }
  });

  it('renders every adventure kind offline with no provider or network call', () => {
    const fetchSpy = vi.fn(() => { throw new Error('network forbidden'); });
    vi.stubGlobal('fetch', fetchSpy);
    for (const kind of ADVENTURE_KINDS) {
      const frames = renderFallbackAdventure(seed({ kind, id: `seed_${kind}` }));
      expect(frames[0]!.prompt).toContain('A lantern flickers.');
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('is deterministic and does not mutate the seed', () => {
    const input = seed();
    const snapshot = JSON.stringify(input);
    expect(renderFallbackAdventure(input)).toEqual(renderFallbackAdventure(input));
    expect(JSON.stringify(input)).toBe(snapshot);
  });

  it('pure-fun renders five beats and never offers reflection', () => {
    const fun = createPureFunAdventureSeed({ id: 'fun_1', territoryId: 'interests', premise: 'A goose steals a hat.' });
    const frames = renderFallbackAdventure(fun);
    expect(frames).toHaveLength(5);
    expect(frames.flatMap((frame) => frame.options.map((option) => option.id))).not.toContain('reflect');
    expect(() => renderFallbackBeat(fun, 'optional-reflection')).toThrow();
  });

  it('rejects malformed seeds and unknown beats', () => {
    expect(() => renderFallbackBeat({ ...seed(), kind: 'horror' } as unknown as AdventureSeed, 'hook')).toThrow();
    expect(() => renderFallbackBeat(seed(), 'epilogue' as never)).toThrow();
  });

  it('returns fresh option objects so callers cannot poison the template', () => {
    const first = renderFallbackBeat(seed(), 'hook');
    (first.options[0] as { label: string }).label = 'POISON';
    first.withdrawOption.label = 'POISON';
    const second = renderFallbackBeat(seed(), 'hook');
    expect(second.options[0]!.label).not.toBe('POISON');
    expect(second.withdrawOption.label).not.toBe('POISON');
  });
});
