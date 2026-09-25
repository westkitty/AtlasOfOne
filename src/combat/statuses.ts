import { COMBAT_STATUS_IDS } from './types';
import type { CombatState, CombatStatus, CombatStatusId } from './types';

/**
 * C10 frozen status resolution order. Statuses are always stored in this
 * order (then by targetId) so any consumer iterating `state.statuses` sees a
 * deterministic sequence regardless of application order.
 *
 * Enemy-phase semantics that follow this order (see intent.ts):
 *  1. staggered        -> the enemy recovers instead of acting
 *  2. charging         -> a telegraphed charged release fires only if still charging
 *  3. guarded          -> player incoming damage uses the C03 GUARD formula
 *  4. protected-target -> objective-action damage to the ally is prevented
 *  5. exposed          -> read by the shield/counter modifiers during ATTACK
 *  6. pacifiable       -> marker for scenario pacify progress (no numeric effect)
 * Then every status ticks down by one at the end of the enemy phase.
 */
export const STATUS_RESOLUTION_ORDER: readonly CombatStatusId[] = [
  'staggered',
  'charging',
  'guarded',
  'protected-target',
  'exposed',
  'pacifiable'
];

/**
 * Default durations in rounds (ticked at end of each enemy phase). All sit in
 * the contract's 1-2 round ordinary target.
 */
export const DEFAULT_STATUS_DURATION: Readonly<Record<CombatStatusId, 1 | 2>> = {
  guarded: 1,
  exposed: 2,
  charging: 2,
  staggered: 1,
  pacifiable: 2,
  'protected-target': 1
};

export const MAX_STATUS_DURATION = 2;

const orderIndex = (status: CombatStatusId) => STATUS_RESOLUTION_ORDER.indexOf(status);

export function statusKey(status: CombatStatusId, targetId: string): string {
  return `${status}:${targetId}`;
}

export function sortStatuses(statuses: readonly CombatStatus[]): CombatStatus[] {
  return [...statuses].sort(
    (a, b) =>
      orderIndex(a.status) - orderIndex(b.status)
      || (a.targetId < b.targetId ? -1 : a.targetId > b.targetId ? 1 : 0)
  );
}

export function hasStatus(state: CombatState, status: CombatStatusId, targetId: string): boolean {
  return state.statuses.some((item) => item.status === status && item.targetId === targetId);
}

/**
 * Idempotent status application. Re-applying the same status to the same
 * target never stacks: it refreshes to max(existing, requested) duration.
 */
export function applyStatus(
  state: CombatState,
  status: CombatStatusId,
  targetId: string,
  duration: number = DEFAULT_STATUS_DURATION[status]
): CombatState {
  if (!(COMBAT_STATUS_IDS as readonly string[]).includes(status)) {
    throw new Error(`Unknown combat status: ${String(status)}`);
  }
  if (!Number.isInteger(duration) || duration < 1 || duration > MAX_STATUS_DURATION) {
    throw new Error(`Combat status duration must be an integer from 1 to ${MAX_STATUS_DURATION}.`);
  }
  if (state.phase === 'resolved') throw new Error('Cannot apply a status after combat is resolved.');
  if (!state.combatants.some((combatant) => combatant.id === targetId)) {
    throw new Error(`Unknown status target: ${targetId}`);
  }

  const existing = state.statuses.find((item) => item.status === status && item.targetId === targetId);
  if (existing && existing.remainingRounds >= duration) return state;

  const next: CombatStatus = { id: statusKey(status, targetId), status, targetId, remainingRounds: duration };
  const others = state.statuses.filter((item) => !(item.status === status && item.targetId === targetId));
  return { ...state, statuses: sortStatuses([...others, next]) };
}

/** Idempotent removal: removing an absent status returns the same state. */
export function removeStatus(state: CombatState, status: CombatStatusId, targetId: string): CombatState {
  if (!hasStatus(state, status, targetId)) return state;
  return {
    ...state,
    statuses: state.statuses.filter((item) => !(item.status === status && item.targetId === targetId))
  };
}

/** End-of-enemy-phase tick: decrement every status, drop expired ones. */
export function tickStatuses(state: CombatState): CombatState {
  return {
    ...state,
    statuses: sortStatuses(
      state.statuses
        .map((item) => ({ ...item, remainingRounds: item.remainingRounds - 1 }))
        .filter((item) => item.remainingRounds > 0)
    )
  };
}

/** Player GUARD declaration: marks the player guarded through the next enemy phase. */
export function declareGuard(state: CombatState, actorId: string): CombatState {
  if (state.phase !== 'player') throw new Error(`GUARD requires player phase, got ${state.phase}.`);
  const actor = state.combatants.find((combatant) => combatant.id === actorId);
  if (!actor || actor.side !== 'player') throw new Error(`GUARD actor ${actorId} is not the player.`);
  if (actor.hp <= 0) throw new Error(`GUARD actor ${actorId} is defeated.`);
  return applyStatus(state, 'guarded', actorId);
}
