import { REGIONS, Region, routeBetween } from './geography';
import { resolveMovement } from './collision';
import type { CampaignState } from '../game/types';
import { availableBosses, availableDoors } from '../game/encounters';

import { findNearbyWaystone, WAYSTONES } from './props';

export interface InteractableTarget {
  type: 'landmark' | 'door' | 'boss' | 'waystone' | 'prop' | 'exit';
  id: string;
  label: string;
  x: number;
  y: number;
  distance: number;
  inscription?: string;
}

export interface PlayerState {
  x: number;
  y: number;
  facing: 'front' | 'back' | 'left' | 'right';
  isMoving: boolean;
  territoryId: string;
  nearbyTarget: InteractableTarget | null;
}

export const PLAYER_SPEED = 85; // px per second
export const INTERACTION_RADIUS = 42; // px proximity threshold for interaction

/**
 * Calculates which region Greyson is standing in based on proximity to region centres and stands.
 */
export function detectTerritory(x: number, y: number): Region {
  let closest = REGIONS[0];
  let minDistance = Infinity;

  for (const region of REGIONS) {
    const distCentre = Math.hypot(x - region.centre.x, y - region.centre.y);
    const distStand = Math.hypot(x - region.stand.x, y - region.stand.y);
    const effectiveDist = Math.min(distCentre, distStand);

    if (effectiveDist < minDistance) {
      minDistance = effectiveDist;
      closest = region;
    }
  }

  return closest;
}

/**
 * Calculates nearby interactable targets (territory landmarks, Mystery Doors, Boss Arenas).
 */
export function findNearbyInteractable(
  x: number,
  y: number,
  state: CampaignState
): InteractableTarget | null {
  const candidates: InteractableTarget[] = [];

  // 1. Territory landmarks
  for (const region of REGIONS) {
    const d = Math.hypot(x - region.centre.x, y - region.centre.y);
    if (d <= INTERACTION_RADIUS) {
      candidates.push({
        type: 'landmark',
        id: region.id,
        label: region.label,
        x: region.centre.x,
        y: region.centre.y,
        distance: d
      });
    }
  }

  // 2. Active Mystery Doors along trail waypoints
  const openDoors = availableDoors(state);
  for (const door of openDoors) {
    const route = routeBetween(door.territoryIds[0], door.territoryIds[1]);
    if (route && route.length > 0) {
      const midPoint = route[Math.floor(route.length / 2)];
      const d = Math.hypot(x - midPoint.x, y - midPoint.y);
      if (d <= INTERACTION_RADIUS + 8) {
        candidates.push({
          type: 'door',
          id: door.doorId,
          label: `Mystery Door (${door.territoryIds[0]} × ${door.territoryIds[1]})`,
          x: midPoint.x,
          y: midPoint.y,
          distance: d
        });
      }
    }
  }

  // 3. Active / Available Boss fights
  const openBosses = availableBosses(state);
  for (const boss of openBosses) {
    const region = REGIONS.find((r) => r.id === boss.territoryId);
    if (region) {
      // Boss arena sits just north-east of the territory landmark
      const arenaX = region.centre.x + 16;
      const arenaY = region.centre.y - 18;
      const d = Math.hypot(x - arenaX, y - arenaY);
      if (d <= INTERACTION_RADIUS + 8) {
        candidates.push({
          type: 'boss',
          id: boss.id,
          label: boss.label,
          x: arenaX,
          y: arenaY,
          distance: d
        });
      }
    }
  }

  // 4. Discoverable trail Waystones
  const stone = findNearbyWaystone(x, y, INTERACTION_RADIUS);
  if (stone) {
    const d = Math.hypot(x - stone.x, y - stone.y);
    candidates.push({
      type: 'waystone',
      id: stone.id,
      label: stone.title,
      x: stone.x,
      y: stone.y,
      distance: d,
      inscription: stone.inscription
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0];
}

/**
 * Updates player position, direction, territory, and interaction target for one frame.
 */
export function updatePlayer(
  current: PlayerState,
  inputVector: { x: number; y: number },
  dtSeconds: number,
  campaignState: CampaignState
): PlayerState {
  const isMoving = Math.hypot(inputVector.x, inputVector.y) > 0.05;

  let newX = current.x;
  let newY = current.y;
  let newFacing = current.facing;

  if (isMoving) {
    // Normalize input vector
    const len = Math.hypot(inputVector.x, inputVector.y);
    const normX = inputVector.x / len;
    const normY = inputVector.y / len;

    const dx = normX * PLAYER_SPEED * dtSeconds;
    const dy = normY * PLAYER_SPEED * dtSeconds;

    const res = resolveMovement(current.x, current.y, dx, dy);
    newX = res.x;
    newY = res.y;

    if (Math.abs(normX) >= Math.abs(normY)) {
      newFacing = normX > 0 ? 'right' : 'left';
    } else {
      newFacing = normY > 0 ? 'front' : 'back';
    }
  }

  const territory = detectTerritory(newX, newY);
  const nearbyTarget = findNearbyInteractable(newX, newY, campaignState);

  return {
    x: newX,
    y: newY,
    facing: newFacing,
    isMoving,
    territoryId: territory.id,
    nearbyTarget
  };
}
