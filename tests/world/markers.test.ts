import { describe, expect, it } from 'vitest';
import {
  WORLD_MARKER_ICONS,
  WORLD_MARKER_KINDS,
  containsPsychologicalLabel,
  isWorldMarkerKind,
  renderWorldMarker,
  type WorldMarkerKind
} from '../../src/world/markers';
import { REGIONS } from '../../src/world/geography';

describe('W01 marker taxonomy + icon contract', () => {
  it('covers every 11.2 opportunity category', () => {
    expect(WORLD_MARKER_KINDS).toEqual(expect.arrayContaining([
      'adventure', 'journal-shrine', 'npc-conversation', 'encounter-hostile', 'encounter-peaceful',
      'mystery-door', 'boss-arena', 'memory', 'discovery', 'sanctuary', 'pure-fun'
    ]));
    for (const kind of WORLD_MARKER_KINDS) {
      expect(WORLD_MARKER_ICONS[kind].glyph.length).toBeGreaterThan(0);
      expect(WORLD_MARKER_ICONS[kind].label.trim().length).toBeGreaterThan(0);
    }
  });

  it('icon table is frozen', () => {
    expect(Object.isFrozen(WORLD_MARKER_ICONS)).toBe(true);
  });

  it('no marker label carries psychological/analytical vocabulary (11.3)', () => {
    for (const kind of WORLD_MARKER_KINDS) {
      expect(containsPsychologicalLabel(WORLD_MARKER_ICONS[kind].label)).toBe(false);
    }
  });

  it('real region labels pass the guard, so place names are usable', () => {
    for (const region of REGIONS) {
      expect(() => renderWorldMarker('adventure', region.label)).not.toThrow();
    }
  });

  it('rejects place labels that announce what is being tested', () => {
    expect(() => renderWorldMarker('adventure', 'This tests loyalty')).toThrow();
    expect(() => renderWorldMarker('encounter-hostile', 'Measures AUTHORITY')).toThrow();
    expect(() => renderWorldMarker('memory', 'Personality trait shrine')).toThrow();
  });

  it('rejects unknown kinds', () => {
    expect(isWorldMarkerKind('secret-analysis')).toBe(false);
    expect(() => renderWorldMarker('secret-analysis' as WorldMarkerKind)).toThrow();
  });
});

describe('W09 marker accessibility / non-color distinction', () => {
  it('each kind has a unique glyph and unique text label', () => {
    const glyphs = WORLD_MARKER_KINDS.map((kind) => WORLD_MARKER_ICONS[kind].glyph);
    const labels = WORLD_MARKER_KINDS.map((kind) => WORLD_MARKER_ICONS[kind].label.toLowerCase());
    expect(new Set(glyphs).size).toBe(WORLD_MARKER_KINDS.length);
    expect(new Set(labels).size).toBe(WORLD_MARKER_KINDS.length);
  });

  it('render contract carries no colour and exposes an accessible name', () => {
    for (const kind of WORLD_MARKER_KINDS) {
      const render = renderWorldMarker(kind, 'Origin Grove');
      expect(Object.keys(render).sort()).toEqual(['accessibleName', 'glyph', 'kind', 'label']);
      expect(render.accessibleName).toBe(`${render.label}, Origin Grove`);
    }
  });

  it('accessible names are unique per kind without a place label', () => {
    const names = WORLD_MARKER_KINDS.map((kind) => renderWorldMarker(kind).accessibleName);
    expect(new Set(names).size).toBe(names.length);
  });

  it('blank place label falls back to the kind label', () => {
    expect(renderWorldMarker('sanctuary', '   ').accessibleName).toBe('Sanctuary');
  });
});
