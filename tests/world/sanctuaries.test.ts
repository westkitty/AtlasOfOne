import { describe, expect, it } from 'vitest';
import { SANCTUARIES, sanctuaryFor } from '../../src/world/sanctuaries';
import { REGIONS } from '../../src/world/geography';

describe('Landmark Sanctuaries', () => {
  it('defines an architectural sanctuary for every region in the geography', () => {
    for (const region of REGIONS) {
      const sanctuary = sanctuaryFor(region.id);
      expect(sanctuary.territoryId).toBe(region.id);
      expect(sanctuary.name.length).toBeGreaterThan(3);
      expect(sanctuary.glyph.length).toBeGreaterThan(0);
      expect(sanctuary.architecture.length).toBeGreaterThan(15);
      expect(sanctuary.atmosphere.length).toBeGreaterThan(2);
      expect(sanctuary.accentColor).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('contains expected 8 canonical territory sanctuaries', () => {
    const keys = Object.keys(SANCTUARIES);
    expect(keys).toEqual([
      'identity',
      'values',
      'politics',
      'relationships',
      'cognition',
      'interests',
      'fears',
      'future'
    ]);
  });

  it('provides a graceful fallback for unknown territories', () => {
    const fallback = sanctuaryFor('non-existent');
    expect(fallback.territoryId).toBe('unknown');
    expect(fallback.name).toBe('Cartographer Sanctuary');
    expect(fallback.glyph).toBe('◈');
  });
});
