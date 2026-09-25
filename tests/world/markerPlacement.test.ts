import { describe, expect, it } from 'vitest';
import type { AdventureSeed } from '../../src/adventure/schema';
import {
  MAX_MARKERS_PER_TERRITORY,
  markerKindForAdventure,
  placeAdventureMarkers,
  type TerritoryAnchor
} from '../../src/world/markerPlacement';
import { isWorldMarkerKind } from '../../src/world/markers';
import { ADVENTURE_KINDS } from '../../src/adventure/schema';

const layout: TerritoryAnchor[] = [
  { territoryId: 'identity', label: 'Origin Grove', centre: { x: 100, y: 200 } },
  { territoryId: 'values', label: 'Tribunal of Values', centre: { x: 50, y: 60 } }
];

const seed = (id: string, over: Partial<AdventureSeed> = {}): AdventureSeed => ({
  id, sourceGapIds: ['gap_x'], kind: 'investigation', territoryId: 'identity',
  premise: 'SYNTHETIC premise that must not reach the map', learningTarget: 'reflection-eligible',
  status: 'available', ...over
});
const all = () => true;

describe('W02 deterministic seed placement', () => {
  it('places available eligible seeds at stable slot positions', () => {
    const markers = placeAdventureMarkers([seed('b'), seed('a')], layout, all);
    expect(markers.map((m) => [m.seedId, m.slot, m.position])).toEqual([
      ['a', 0, { x: 100, y: 182 }],
      ['b', 1, { x: 118, y: 200 }]
    ]);
  });

  it('is independent of input order and repeatable', () => {
    const seeds = [seed('c'), seed('a', { territoryId: 'values' }), seed('b')];
    const first = placeAdventureMarkers(seeds, layout, all);
    expect(placeAdventureMarkers([...seeds].reverse(), layout, all)).toEqual(first);
    expect(placeAdventureMarkers(seeds, layout, all)).toEqual(first);
  });

  it('never places started, retired, ineligible or unknown-territory seeds', () => {
    const markers = placeAdventureMarkers([
      seed('started', { status: 'started' }),
      seed('retired', { status: 'retired' }),
      seed('inel'),
      seed('nowhere', { territoryId: 'atlantis' }),
      seed('ok')
    ], layout, (s) => s.id !== 'inel');
    expect(markers.map((m) => m.seedId)).toEqual(['ok']);
  });

  it('existing marker positions do not move when a later-sorted seed appears', () => {
    const before = placeAdventureMarkers([seed('a')], layout, all);
    const after = placeAdventureMarkers([seed('a'), seed('z')], layout, all);
    expect(after[0]).toEqual(before[0]);
  });

  it('caps markers per territory and ignores duplicate ids', () => {
    const many = Array.from({ length: 12 }, (_, i) => seed(`s${String(i).padStart(2, '0')}`));
    const markers = placeAdventureMarkers([...many, seed('s00')], layout, all);
    expect(markers).toHaveLength(MAX_MARKERS_PER_TERRITORY);
    expect(new Set(markers.map((m) => `${m.position.x},${m.position.y}`)).size).toBe(markers.length);
  });

  it('does not copy premise or gap ids onto markers', () => {
    const json = JSON.stringify(placeAdventureMarkers([seed('a')], layout, all));
    expect(json).not.toContain('SYNTHETIC');
    expect(json).not.toContain('gap_x');
  });

  it('maps every adventure kind to a valid marker kind', () => {
    for (const kind of ADVENTURE_KINDS) expect(isWorldMarkerKind(markerKindForAdventure(kind))).toBe(true);
    expect(markerKindForAdventure('combat-forward')).toBe('encounter-hostile');
    expect(markerKindForAdventure('pure-fun')).toBe('pure-fun');
  });
});
