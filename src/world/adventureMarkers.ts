import { selectWorldMemories } from '../adventure/journey';
import { selectAvailableAdventureSeeds } from '../adventure/seeds';
import type { CampaignState } from '../game/types';
import { isWalkable } from './collision';
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
 * Keep markers out of the landmark's pull. Target selection is nearest-wins,
 * and the first slot used to land 0-14 units from the landmark centre (on it,
 * in Politics), so the landmark's Talk usually beat the marker's Start and the
 * adventure could not be begun.
 */
export const LANDMARK_CLEARANCE = 26;
const ROTATE_STEP = Math.PI / 12;

/**
 * Deterministic presentation-only position near a territory's canonical stand.
 * Placement is derived state: it never mutates AdventureSeed.locationId or worldJourney.
 * Each slot starts at its golden-angle spot and rotates, then steps outward, until
 * it is walkable and clear of the landmark.
 */
export function positionFor(territoryId: string, slotIndex: number): { x: number; y: number } | null {
  const region = regionById.get(territoryId);
  if (!region) return null;
  const ring = Math.floor(slotIndex / RING_SIZE);
  for (let grow = 0; grow < 4; grow += 1) {
    const radius = BASE_RADIUS + ring * RING_STEP + grow * RING_STEP;
    for (let turn = 0; turn < 24; turn += 1) {
      const angle = -Math.PI / 2 + slotIndex * GOLDEN_ANGLE + turn * ROTATE_STEP;
      const x = clamp(Math.round(region.stand.x + Math.cos(angle) * radius), MARKER_MARGIN, WORLD.width - MARKER_MARGIN);
      const y = clamp(Math.round(region.stand.y + Math.sin(angle) * radius), MARKER_MARGIN, WORLD.height - MARKER_MARGIN);
      if (Math.hypot(x - region.centre.x, y - region.centre.y) >= LANDMARK_CLEARANCE && isWalkable(x, y)) return { x, y };
    }
  }
  return null;
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

export interface WorldMemoryMarker extends WorldMarkerRenderModel {
  runId: string;
  territoryId: string;
  recollection: string;
  x: number;
  y: number;
}

/** Memories sit on an outer ring so opportunity markers never shift when one appears. */
const MEMORY_SLOT_OFFSET = RING_SIZE * 2;

/**
 * World memory: every completed, still-eligible adventure leaves a `memory`
 * marker where it happened. Derived state only — nothing here is stored, so
 * retirement (PRIVATE/retraction upstream) removes the marker automatically.
 */
export function selectWorldMemoryMarkers(state: CampaignState): WorldMemoryMarker[] {
  const slotByTerritory = new Map<string, number>();
  const markers: WorldMemoryMarker[] = [];
  const memories = selectWorldMemories(state).sort((a, b) => a.startedAt.localeCompare(b.startedAt) || a.runId.localeCompare(b.runId));
  for (const memory of memories) {
    if (!regionById.has(memory.territoryId)) continue;
    const slotIndex = slotByTerritory.get(memory.territoryId) ?? 0;
    const position = positionFor(memory.territoryId, MEMORY_SLOT_OFFSET + slotIndex);
    const render = createWorldMarkerRenderModel({ kind: 'memory', sourceId: memory.runId });
    if (!position || !render) continue;
    slotByTerritory.set(memory.territoryId, slotIndex + 1);
    markers.push({ ...render, runId: memory.runId, territoryId: memory.territoryId, recollection: memory.outcome ?? 'Something happened here.', x: position.x, y: position.y });
  }
  return markers;
}
