import type { CombatDefinition, CombatGimmick, CombatState } from '../contracts/combat';
import type { CombatStatusKind } from './rules';

/**
 * C08 MVP gimmick set (Appendix B): shielded, charging, counterattacking,
 * swarm, and the pacify/ACT state carried by `morale-fear`.
 *
 * Enemy numbers stay inside the Appendix-I ordinary action envelope (10-22).
 * They are tuning defaults owned by C17, not canon.
 */
export const COMBAT_MVP_GIMMICKS = [
  'shielded', 'charging', 'counterattacking', 'swarm', 'morale-fear'
] as const satisfies readonly CombatGimmick[];

export const COMBAT_ENEMY_TUNING = {
  attackDamage: 12,
  swarmAttackDamage: 10,
  chargedReleaseDamage: 22,
  counterDamage: 6,
  shieldReduction: 0.5
} as const;

export function hasGimmick(definition: CombatDefinition, gimmick: CombatGimmick): boolean {
  return definition.gimmicks.includes(gimmick);
}

/** Shielded enemies halve ATTACK damage (rounded up) unless currently exposed. */
export function shieldedAttackDamage(definition: CombatDefinition, targetStatuses: readonly string[], damage: number): number {
  if (!hasGimmick(definition, 'shielded') || targetStatuses.includes('exposed')) return damage;
  return Math.ceil(damage * (1 - COMBAT_ENEMY_TUNING.shieldReduction));
}

/** Counterattacking enemies strike back after an ATTACK they survive, unless staggered. */
export function counterDamageFor(definition: CombatDefinition, targetStatuses: readonly string[], targetHp: number): number {
  if (!hasGimmick(definition, 'counterattacking') || targetHp <= 0 || targetStatuses.includes('staggered')) return 0;
  return COMBAT_ENEMY_TUNING.counterDamage;
}

export function enemyAttackDamage(definition: CombatDefinition): number {
  return hasGimmick(definition, 'swarm') ? COMBAT_ENEMY_TUNING.swarmAttackDamage : COMBAT_ENEMY_TUNING.attackDamage;
}

/** Statuses a gimmick establishes when the encounter begins. */
export function initialEnemyStatuses(definition: CombatDefinition): CombatStatusKind[] {
  return hasGimmick(definition, 'morale-fear') ? ['pacifiable'] : [];
}

export function withStatus(state: CombatState, combatantId: string, status: CombatStatusKind): CombatState {
  return {
    ...state,
    combatants: state.combatants.map((combatant) => combatant.id === combatantId && !combatant.statuses.includes(status)
      ? { ...combatant, statuses: [...combatant.statuses, status] }
      : combatant)
  };
}

export function withoutStatus(state: CombatState, combatantId: string, status: CombatStatusKind): CombatState {
  return {
    ...state,
    combatants: state.combatants.map((combatant) => combatant.id === combatantId && combatant.statuses.includes(status)
      ? { ...combatant, statuses: combatant.statuses.filter((entry) => entry !== status) }
      : combatant)
  };
}

/**
 * C10 status lifetimes, with no timers to drift:
 * - exposed: consumed by the next ATTACK on that target;
 * - staggered: consumed when that enemy would next act;
 * - charging: consumed when the charge releases or is interrupted;
 * - guarded / protected-target: consumed by a hit, otherwise cleared at round end;
 * - pacifiable: persists for the encounter.
 */
export const ROUND_SCOPED_STATUSES = ['guarded', 'protected-target'] as const satisfies readonly CombatStatusKind[];

export function clearRoundScopedStatuses(state: CombatState): CombatState {
  return {
    ...state,
    combatants: state.combatants.map((combatant) => {
      const statuses = combatant.statuses.filter((status) => !(ROUND_SCOPED_STATUSES as readonly string[]).includes(status));
      return statuses.length === combatant.statuses.length ? combatant : { ...combatant, statuses };
    })
  };
}
