import { applyAttack, attackDamage, validateCombatDefinition } from './engine';
import { applyStatus, hasStatus, removeStatus } from './statuses';
import type {
  CombatActResolution,
  CombatAttackCommand,
  CombatDefinition,
  CombatGimmick,
  CombatState,
  CombatTechniqueActivation
} from './types';

/** C08 implements exactly these five MVP gimmicks (COMBAT_CONTRACT §8). */
export const MVP_COMBAT_GIMMICKS = [
  'shielded',
  'charging',
  'counterattacking',
  'swarm',
  'non-kill-target'
] as const satisfies readonly CombatGimmick[];

/** Shielded enemies take half ATTACK damage (ceil) unless exposed. */
export const SHIELD_DAMAGE_FRACTION = 0.5;
/** Fixed reactive damage to the player when ATTACKing an un-staggered, un-exposed counterattacker. */
export const COUNTER_DAMAGE = 6;
/** Swarm is one bounded combatant that fictionally represents this many members. */
export const SWARM_MEMBERS = 3;
export const SWARM_BASE_DAMAGE = 6;
export const SWARM_DAMAGE_PER_MEMBER = 4;

/**
 * Gimmicks are encounter-level deterministic templates: every enemy in the
 * encounter carries every listed gimmick (ordinary encounters have 1-3 enemies).
 */
export function validateGimmicks(definition: CombatDefinition): CombatDefinition {
  validateCombatDefinition(definition);
  const seen = new Set<string>();
  for (const gimmick of definition.gimmicks) {
    if (!(MVP_COMBAT_GIMMICKS as readonly string[]).includes(gimmick)) {
      throw new Error(`Combat gimmick ${gimmick} is not implemented in the C08 MVP set.`);
    }
    if (seen.has(gimmick)) throw new Error(`Duplicate combat gimmick: ${gimmick}`);
    seen.add(gimmick);
  }
  return definition;
}

const has = (definition: CombatDefinition, gimmick: CombatGimmick) => definition.gimmicks.includes(gimmick);

/** Living swarm members, derived purely from HP (never stored separately). */
export function swarmMembersAlive(hp: number, maxHp: number): number {
  if (hp <= 0) return 0;
  return Math.ceil((hp / maxHp) * SWARM_MEMBERS);
}

export function swarmDamage(hp: number, maxHp: number): number {
  const alive = swarmMembersAlive(hp, maxHp);
  return alive === 0 ? 0 : SWARM_BASE_DAMAGE + SWARM_DAMAGE_PER_MEMBER * alive;
}

export interface GimmickAttackResolution {
  state: CombatState;
  actorId: string;
  targetId: string;
  baseDamage: number;
  damage: number;
  shieldApplied: boolean;
  nonKillClamped: boolean;
  counterDamage: number;
  targetDefeated: boolean;
}

/**
 * ATTACK with deterministic gimmick modifiers, in this fixed order:
 *  1. C00 base formula (18, +6 timed)
 *  2. shielded: ceil(half) unless the target is exposed
 *  3. apply to HP; non-kill-target clamps HP at 1
 *  4. counterattacking: fixed COUNTER_DAMAGE to the player unless the target
 *     is staggered or exposed (player HP floors at 0)
 * Only actorId/targetId/timedSuccess are read from the command.
 */
export function resolveGimmickAttack(
  definition: CombatDefinition,
  state: CombatState,
  command: CombatAttackCommand
): GimmickAttackResolution {
  validateGimmicks(definition);
  if (state.definitionId !== definition.id) {
    throw new Error(`ATTACK definition mismatch: state=${state.definitionId}, definition=${definition.id}`);
  }
  const clean: CombatAttackCommand = {
    actorId: command.actorId,
    targetId: command.targetId,
    timedSuccess: command.timedSuccess === true
  };
  // Reuse C02 validation (phase, actor, target); its HP result is recomputed below.
  applyAttack(state, clean);

  const target = state.combatants.find((combatant) => combatant.id === clean.targetId)!;
  const exposed = hasStatus(state, 'exposed', target.id);
  const staggered = hasStatus(state, 'staggered', target.id);

  const baseDamage = attackDamage(clean.timedSuccess);
  const shieldApplied = has(definition, 'shielded') && !exposed;
  const damage = shieldApplied ? Math.ceil(baseDamage * SHIELD_DAMAGE_FRACTION) : baseDamage;

  let nextHp = Math.max(0, target.hp - damage);
  const nonKillClamped = has(definition, 'non-kill-target') && nextHp < 1;
  if (nonKillClamped) nextHp = 1;

  const counterDamage = has(definition, 'counterattacking') && !staggered && !exposed ? COUNTER_DAMAGE : 0;

  const nextState: CombatState = {
    ...state,
    combatants: state.combatants.map((combatant) => {
      if (combatant.id === target.id) return { ...combatant, hp: nextHp };
      if (combatant.id === clean.actorId && counterDamage > 0) {
        return { ...combatant, hp: Math.max(0, combatant.hp - counterDamage) };
      }
      return combatant;
    })
  };

  return {
    state: nextState,
    actorId: clean.actorId,
    targetId: target.id,
    baseDamage,
    damage,
    shieldApplied,
    nonKillClamped,
    counterDamage,
    targetDefeated: nextHp === 0
  };
}

export type GimmickEffect =
  | 'interrupted'
  | 'exposed'
  | 'protected'
  | 'pacifiable'
  | 'none';

export interface GimmickEffectResolution {
  state: CombatState;
  effect: GimmickEffect;
}

function interruptCharge(definition: CombatDefinition, state: CombatState, enemyId: string): GimmickEffectResolution {
  if (!hasStatus(state, 'charging', enemyId)) return { state, effect: 'none' };
  let next = removeStatus(state, 'charging', enemyId);
  next = applyStatus(next, 'staggered', enemyId);
  if (definition.objective === 'interrupt') {
    next = { ...next, objectiveProgress: next.objectiveProgress + 1 };
  }
  return { state: next, effect: 'interrupted' };
}

function requireSide(state: CombatState, id: string, side: 'enemy' | 'ally') {
  const target = state.combatants.find((combatant) => combatant.id === id);
  if (!target || target.side !== side) throw new Error(`Technique target ${id} is not an ${side}.`);
  if (target.hp <= 0) throw new Error(`Technique target ${id} is defeated.`);
}

/**
 * Apply the tactical job of an already-activated C04 Technique. C04 spends
 * the charge; C08 applies the deterministic effect. Jobs without an MVP
 * gimmick consumer (reposition-objective, trade-damage-for-control) are no-ops.
 */
export function applyTechniqueEffect(
  definition: CombatDefinition,
  activation: CombatTechniqueActivation,
  targetId: string
): GimmickEffectResolution {
  validateGimmicks(definition);
  const state = activation.state;
  switch (activation.job) {
    case 'interrupt-charge':
      requireSide(state, targetId, 'enemy');
      return interruptCharge(definition, state, targetId);
    case 'expose-shield':
      requireSide(state, targetId, 'enemy');
      return { state: applyStatus(state, 'exposed', targetId), effect: 'exposed' };
    case 'protect-ally':
      requireSide(state, targetId, 'ally');
      return { state: applyStatus(state, 'protected-target', targetId), effect: 'protected' };
    default:
      return { state, effect: 'none' };
  }
}

/**
 * Apply deterministic gimmick consequences of a C05 ACT resolution:
 * - completed `interrupt` ACT on a charging enemy -> interrupted
 * - `pacify-progress` on a non-kill/enemy target -> pacifiable marker
 */
export function applyActEffect(
  definition: CombatDefinition,
  resolution: CombatActResolution
): GimmickEffectResolution {
  validateGimmicks(definition);
  const state = resolution.state;
  if (resolution.targetKind !== 'enemy' || !resolution.targetId) return { state, effect: 'none' };
  const enemy = state.combatants.find((combatant) => combatant.id === resolution.targetId);
  if (!enemy || enemy.hp <= 0) return { state, effect: 'none' };

  if (resolution.job === 'interrupt' && resolution.completed) {
    return interruptCharge(definition, state, enemy.id);
  }
  if (resolution.job === 'pacify-progress') {
    return { state: applyStatus(state, 'pacifiable', enemy.id), effect: 'pacifiable' };
  }
  return { state, effect: 'none' };
}
