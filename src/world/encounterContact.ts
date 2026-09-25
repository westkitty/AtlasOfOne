import type { Point } from './geography';

/**
 * W03: visible encounter entity + contact/trigger contract.
 *
 * An encounter is a visible entity on the world grid bound to an
 * encounter-owned CombatDefinition id. Contact detection is pure and
 * deterministic. Only a hostile, roaming entity produces `start-combat`;
 * peaceful contact only offers an interaction and never starts combat.
 * This module never creates combat state, rewards, or Evidence.
 */

export type EncounterHostility = 'hostile' | 'peaceful';
export type EncounterEntityState = 'roaming' | 'engaged' | 'resolved';

export interface EncounterEntity {
  id: string;
  combatDefinitionId: string;
  territoryId: string;
  hostility: EncounterHostility;
  state: EncounterEntityState;
  position: Point;
  /** World-pixel contact radius; clamped to [MIN, MAX]. */
  contactRadius: number;
}

export const MIN_CONTACT_RADIUS = 4;
export const MAX_CONTACT_RADIUS = 32;

export type EncounterContactTrigger =
  | { type: 'none' }
  | { type: 'start-combat'; entityId: string; combatDefinitionId: string }
  | { type: 'offer-interaction'; entityId: string };

const finitePoint = (point: Point) => Number.isFinite(point.x) && Number.isFinite(point.y);

export function effectiveContactRadius(radius: number): number {
  if (!Number.isFinite(radius)) return MIN_CONTACT_RADIUS;
  return Math.min(MAX_CONTACT_RADIUS, Math.max(MIN_CONTACT_RADIUS, radius));
}

/**
 * Returns the trigger for the player's current position. When several roaming
 * entities are in contact, the nearest wins; ties break by entity id. Engaged
 * or resolved entities, invalid coordinates, and hostile entities with no
 * combat definition id never trigger.
 */
export function detectEncounterContact(player: Point, entities: readonly EncounterEntity[]): EncounterContactTrigger {
  if (!finitePoint(player)) return { type: 'none' };
  let best: { entity: EncounterEntity; distance: number } | null = null;
  for (const entity of entities) {
    if (entity.state !== 'roaming' || !finitePoint(entity.position)) continue;
    if (entity.hostility === 'hostile' && !entity.combatDefinitionId.trim()) continue;
    const distance = Math.hypot(player.x - entity.position.x, player.y - entity.position.y);
    if (distance > effectiveContactRadius(entity.contactRadius)) continue;
    if (!best || distance < best.distance || (distance === best.distance && entity.id < best.entity.id)) {
      best = { entity, distance };
    }
  }
  if (!best) return { type: 'none' };
  if (best.entity.hostility === 'hostile') {
    return { type: 'start-combat', entityId: best.entity.id, combatDefinitionId: best.entity.combatDefinitionId };
  }
  return { type: 'offer-interaction', entityId: best.entity.id };
}

/** roaming -> engaged -> resolved; any other move throws. */
export function transitionEncounterEntity(entity: EncounterEntity, to: EncounterEntityState): EncounterEntity {
  const legal = (entity.state === 'roaming' && to === 'engaged') || (entity.state === 'engaged' && to === 'resolved');
  if (!legal) throw new Error(`Encounter ${entity.id} cannot move from ${entity.state} to ${to}.`);
  return { ...entity, state: to };
}
