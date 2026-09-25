import { reduceCombatLifecycle, resolveGuardDamage } from './engine';
import { swarmDamage, validateGimmicks } from './gimmicks';
import { applyObjective, validateObjectiveDefinition } from './objectives';
import { applyStatus, hasStatus, removeStatus, tickStatuses } from './statuses';
import { COMBAT_INTENTS } from './types';
import type { CombatDefinition, CombatIntent, CombatIntentPlan, CombatState, CombatantState } from './types';

/** Ordinary enemy action damage inside the C00 10-22 envelope. */
export const ENEMY_ATTACK_DAMAGE = 12;
export const CHARGED_RELEASE_DAMAGE = 22;
export const OBJECTIVE_ACTION_DAMAGE = 14;
export const MAX_ENEMY_ACTION_DAMAGE = 22;

/**
 * Deterministic intent selection. Inputs are engine state only (statuses,
 * round parity, gimmicks, objective, HP). No randomness, clock, or provider.
 *
 * Priority:
 *  1. staggered            -> recover (0)
 *  2. already charging     -> attack 'charged-release' (22) on the player
 *  3. charging gimmick, odd round -> charge (0), becomes charging this phase
 *  4. protect objective, ally alive -> objective-action (14) on the ally
 *  5. swarm                -> attack scaled by living members (18/14/10)
 *  6. otherwise            -> attack (12) on the player
 */
export function selectEnemyIntent(
  definition: CombatDefinition,
  state: CombatState,
  enemy: CombatantState
): CombatIntentPlan {
  const player = state.combatants.find((combatant) => combatant.side === 'player')!;
  const ally = state.combatants.find((combatant) => combatant.side === 'ally');
  const plan = (intent: CombatIntent, targetId: string, rawDamage: number, telegraphKey: string): CombatIntentPlan => ({
    round: state.round,
    enemyId: enemy.id,
    intent,
    targetId,
    rawDamage,
    telegraphKey
  });

  if (hasStatus(state, 'staggered', enemy.id)) return plan('recover', player.id, 0, 'recover');
  if (hasStatus(state, 'charging', enemy.id)) {
    return plan('attack', player.id, CHARGED_RELEASE_DAMAGE, 'charged-release');
  }
  if (definition.gimmicks.includes('charging') && state.round % 2 === 1) {
    return plan('charge', player.id, 0, 'charge-up');
  }
  if (definition.objective === 'protect' && ally && ally.hp > 0) {
    return plan('objective-action', ally.id, OBJECTIVE_ACTION_DAMAGE, 'threaten-ally');
  }
  if (definition.gimmicks.includes('swarm')) {
    return plan('attack', player.id, swarmDamage(enemy.hp, enemy.maxHp), 'swarm-attack');
  }
  return plan('attack', player.id, ENEMY_ATTACK_DAMAGE, 'attack');
}

/**
 * Compute and store the visible telegraph for every living enemy this round.
 * Idempotent: telegraphing twice yields an equal state.
 */
export function telegraphIntents(definition: CombatDefinition, state: CombatState): CombatState {
  validateGimmicks(definition);
  validateObjectiveDefinition(definition);
  if (state.definitionId !== definition.id) {
    throw new Error(`Intent definition mismatch: state=${state.definitionId}, definition=${definition.id}`);
  }
  if (state.phase === 'resolved') throw new Error('Cannot telegraph intent after combat is resolved.');
  const telegraphedIntents = state.combatants
    .filter((combatant) => combatant.side === 'enemy' && combatant.hp > 0)
    .map((enemy) => selectEnemyIntent(definition, state, enemy));
  return { ...state, telegraphedIntents };
}

export interface EnemyPhaseInput {
  /** Injected optional perfect-guard timing. Missing/false is ordinary GUARD. */
  guardTimedSuccess?: boolean;
}

export interface EnemyActionResult {
  enemyId: string;
  intent: CombatIntent;
  telegraphKey: string;
  /** What actually happened; may differ from the telegraph only via engine statuses. */
  resolvedAs: 'charged' | 'damage' | 'recovered' | 'interrupted' | 'prevented' | 'skipped';
  targetId: string;
  damage: number;
}

export interface EnemyPhaseResolution {
  state: CombatState;
  actions: EnemyActionResult[];
}

function assertPlan(state: CombatState, plan: CombatIntentPlan): void {
  const enemy = state.combatants.find((combatant) => combatant.id === plan.enemyId);
  const target = state.combatants.find((combatant) => combatant.id === plan.targetId);
  if (
    !enemy || enemy.side !== 'enemy'
    || !target || target.side === 'enemy'
    || !(COMBAT_INTENTS as readonly string[]).includes(plan.intent)
    || !Number.isInteger(plan.rawDamage) || plan.rawDamage < 0 || plan.rawDamage > MAX_ENEMY_ACTION_DAMAGE
  ) {
    throw new Error(`Invalid telegraphed intent for ${plan.enemyId}.`);
  }
}

const damage = (state: CombatState, targetId: string, amount: number): CombatState =>
  amount <= 0
    ? state
    : {
        ...state,
        combatants: state.combatants.map((combatant) =>
          combatant.id === targetId ? { ...combatant, hp: Math.max(0, combatant.hp - amount) } : combatant
        )
      };

/**
 * Resolve the enemy phase strictly from the intents telegraphed for this
 * round (visible-before-resolution invariant), in definition order, then:
 * tick statuses -> END_ENEMY_PHASE -> objective check -> telegraph next round.
 */
export function resolveEnemyPhase(
  definition: CombatDefinition,
  state: CombatState,
  input: EnemyPhaseInput = {}
): EnemyPhaseResolution {
  validateGimmicks(definition);
  validateObjectiveDefinition(definition);
  if (state.definitionId !== definition.id) {
    throw new Error(`Enemy phase definition mismatch: state=${state.definitionId}, definition=${definition.id}`);
  }
  if (state.phase !== 'enemy') throw new Error(`Enemy phase requires enemy phase, got ${state.phase}.`);

  const plans = state.telegraphedIntents ?? [];
  if (plans.length === 0 || plans.some((plan) => plan.round !== state.round)) {
    throw new Error('Enemy intents must be telegraphed for this round before resolution.');
  }
  plans.forEach((plan) => assertPlan(state, plan));

  const guardTimedSuccess = input.guardTimedSuccess === true;
  let next = state;
  const actions: EnemyActionResult[] = [];

  for (const plan of plans) {
    const enemy = next.combatants.find((combatant) => combatant.id === plan.enemyId)!;
    const player = next.combatants.find((combatant) => combatant.side === 'player')!;
    const base = { enemyId: plan.enemyId, intent: plan.intent, telegraphKey: plan.telegraphKey, targetId: plan.targetId };

    if (enemy.hp <= 0 || player.hp <= 0) {
      actions.push({ ...base, resolvedAs: 'skipped', damage: 0 });
      continue;
    }
    if (hasStatus(next, 'staggered', enemy.id)) {
      actions.push({ ...base, resolvedAs: plan.intent === 'recover' ? 'recovered' : 'interrupted', damage: 0 });
      continue;
    }

    if (plan.intent === 'charge') {
      next = applyStatus(next, 'charging', enemy.id);
      actions.push({ ...base, resolvedAs: 'charged', damage: 0 });
      continue;
    }

    if (plan.intent === 'attack' || plan.intent === 'objective-action') {
      if (plan.telegraphKey === 'charged-release') {
        if (!hasStatus(next, 'charging', enemy.id)) {
          actions.push({ ...base, resolvedAs: 'interrupted', damage: 0 });
          continue;
        }
        next = removeStatus(next, 'charging', enemy.id);
      }
      const target = next.combatants.find((combatant) => combatant.id === plan.targetId)!;
      if (target.hp <= 0) {
        actions.push({ ...base, resolvedAs: 'skipped', damage: 0 });
        continue;
      }
      let dealt = plan.rawDamage;
      if (target.side === 'ally' && hasStatus(next, 'protected-target', target.id)) {
        actions.push({ ...base, resolvedAs: 'prevented', damage: 0 });
        continue;
      }
      if (target.side === 'player' && hasStatus(next, 'guarded', target.id)) {
        dealt = resolveGuardDamage(next, { actorId: target.id, timedSuccess: guardTimedSuccess }, plan.rawDamage)
          .damageTaken;
      }
      next = damage(next, target.id, dealt);
      actions.push({ ...base, resolvedAs: 'damage', damage: dealt });
      continue;
    }

    actions.push({ ...base, resolvedAs: 'recovered', damage: 0 });
  }

  next = tickStatuses({ ...next, telegraphedIntents: [] });
  next = reduceCombatLifecycle(next, { type: 'END_ENEMY_PHASE' });
  next = applyObjective(definition, next);
  if (next.phase !== 'resolved') next = telegraphIntents(definition, next);
  return { state: next, actions };
}
