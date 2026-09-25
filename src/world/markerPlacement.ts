import type { AdventureKind, AdventureSeed } from '../adventure/schema';
import type { Point } from './geography';
import type { WorldMarkerKind } from './markers';

/**
 * W02: deterministic placement of available AdventureSeeds as world markers.
 *
 * Pure: the same seeds + layout always yield the same markers in the same
 * positions, independent of input order. Only `available` seeds that pass the
 * caller-supplied eligibility check (normally A00 `adventureSeedIsEligible`
 * bound to the current CampaignState) and whose territory exists in the
 * layout are placed. Started, retired, ineligible and unknown-territory seeds
 * are never placed. The seed premise is not copied onto the marker.
 */

export interface TerritoryAnchor {
  territoryId: string;
  label: string;
  centre: Point;
}

export interface AdventureWorldMarker {
  id: string;
  seedId: string;
  territoryId: string;
  kind: WorldMarkerKind;
  position: Point;
  /** Stable slot index within the territory (0-based, by seed id order). */
  slot: number;
}

/** Fixed offsets from a territory centre, in world pixels. */
export const MARKER_SLOT_OFFSETS: readonly Point[] = Object.freeze([
  { x: 0, y: -18 },
  { x: 18, y: 0 },
  { x: 0, y: 18 },
  { x: -18, y: 0 },
  { x: 14, y: -14 },
  { x: 14, y: 14 },
  { x: -14, y: 14 },
  { x: -14, y: -14 }
]);

/** Seeds beyond this many per territory wait (lowest ids placed first). */
export const MAX_MARKERS_PER_TERRITORY = MARKER_SLOT_OFFSETS.length;

export function markerKindForAdventure(kind: AdventureKind): WorldMarkerKind {
  switch (kind) {
    case 'combat-forward': return 'encounter-hostile';
    case 'mystery-puzzle': return 'mystery-door';
    case 'memory-echo': return 'memory';
    case 'relationship-companion': return 'npc-conversation';
    case 'exploration-expedition': return 'discovery';
    case 'pure-fun': return 'pure-fun';
    default: return 'adventure';
  }
}

export function placeAdventureMarkers(
  seeds: readonly AdventureSeed[],
  layout: readonly TerritoryAnchor[],
  isEligible: (seed: AdventureSeed) => boolean
): AdventureWorldMarker[] {
  const anchors = new Map(layout.map((anchor) => [anchor.territoryId, anchor]));
  const seen = new Set<string>();
  const byTerritory = new Map<string, AdventureSeed[]>();
  for (const seed of seeds) {
    if (seed.status !== 'available' || seen.has(seed.id)) continue;
    if (!anchors.has(seed.territoryId) || !isEligible(seed)) continue;
    seen.add(seed.id);
    const list = byTerritory.get(seed.territoryId) ?? [];
    list.push(seed);
    byTerritory.set(seed.territoryId, list);
  }

  const markers: AdventureWorldMarker[] = [];
  for (const territoryId of [...byTerritory.keys()].sort()) {
    const anchor = anchors.get(territoryId)!;
    const sorted = byTerritory.get(territoryId)!.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    sorted.slice(0, MAX_MARKERS_PER_TERRITORY).forEach((seed, slot) => {
      const offset = MARKER_SLOT_OFFSETS[slot];
      markers.push({
        id: `marker:${seed.id}`,
        seedId: seed.id,
        territoryId,
        kind: markerKindForAdventure(seed.kind),
        position: { x: anchor.centre.x + offset.x, y: anchor.centre.y + offset.y },
        slot
      });
    });
  }
  return markers;
}
