import { selectAvailableAdventureSeeds } from '../adventure/seeds';
import type { CampaignState } from '../game/types';
import { REGIONS, WORLD } from './geography';
import {
  createWorldMarkerRenderModel,
  markerKindForAdventureKind,
  type WorldMarkerRenderModel
} from './markers';

export interface AdventureWorldMarker extends WorldMarkerRenderModel {
  seedId: string;
  territoryId: string;
  x: number;
  y: number;
}

const MARKER_MARGIN = 14;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const BASE_RADIUS = 28;
const RING_STEP = 10;
const RING_SIZE = 8;

const regionById = new Map(REGIONS.map((region) => [region.id, region]));
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

/**
 * Deterministic presentation-only position near a territory's canonical stand.
 * Placement is derived state: it never mutates AdventureSeed.locationId or worldJourney.
 */
function positionFor(territoryId: string, slotIndex: number): { x: number; y: number } | null {
  const region = regionById.get(territoryId);
  if (!region) return null;
  const ring = Math.floor(slotIndex / RING_SIZE);
  const radius = BASE_RADIUS + ring * RING_STEP;
  const angle = -Math.PI / 2 + slotIndex * GOLDEN_ANGLE;
  return {
    x: clamp(Math.round(region.stand.x + Math.cos(angle) * radius), MARKER_MARGIN, WORLD.width - MARKER_MARGIN),
    y: clamp(Math.round(region.stand.y + Math.sin(angle) * radius), MARKER_MARGIN, WORLD.height - MARKER_MARGIN)
  };
}

/**
 * W02 read-only world opportunity view.
 *
 * A00 remains the authority on seed availability/privacy/deduplication. W02 only
 * projects that already-eligible view into W01-safe public marker state.
 */
export function selectAdventureWorldMarkers(state: CampaignState): AdventureWorldMarker[] {
  const slotByTerritory = new Map<string, number>();
  const markers: AdventureWorldMarker[] = [];

  for (const seed of selectAvailableAdventureSeeds(state)) {
    const kind = markerKindForAdventureKind(seed.kind);
    if (!kind || !regionById.has(seed.territoryId)) continue;

    const slotIndex = slotByTerritory.get(seed.territoryId) ?? 0;
    const position = positionFor(seed.territoryId, slotIndex);
    const render = createWorldMarkerRenderModel({ kind, sourceId: seed.id });
    if (!position || !render) continue;

    slotByTerritory.set(seed.territoryId, slotIndex + 1);
    markers.push({
      ...render,
      seedId: seed.id,
      territoryId: seed.territoryId,
      x: position.x,
      y: position.y
    });
  }

  return markers;
}
