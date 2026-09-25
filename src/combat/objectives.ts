import { reduceCombatLifecycle, validateCombatDefinition } from './engine';
import type { CombatDefinition, CombatObjective, CombatOutcome, CombatState } from './types';

/** C07 implements exactly the five MVP objectives frozen in COMBAT_CONTRACT §7. */
export const MVP_COMBAT_OBJECTIVES = ['defeat', 'survive', 'protect', 'interrupt', 'pacify'] as const;
export type MvpCombatObjective = typeof MVP_COMBAT_OBJECTIVES[number];

export interface CombatObjectiveEvaluation {
  objective: MvpCombatObjective;
  /** Deterministic progress toward completion, capped at `required`. */
  progress: number;
  required: number;
  complete: boolean;
  /** True when a fail-forward defeat condition was reached. */
  failed: boolean;
  /** Terminal outcome implied by this evaluation, if any. */
  outcome?: CombatOutcome;
}

export function isMvpObjective(objective: CombatObjective): objective is MvpCombatObjective {
  return (MVP_COMBAT_OBJECTIVES as readonly string[]).includes(objective);
}

/**
 * Objective-specific authoring rules on top of the C01 structural validator.
 * Non-MVP objectives are refused rather than silently treated as `defeat`.
 */
export function validateObjectiveDefinition(definition: CombatDefinition): CombatDefinition {
  validateCombatDefinition(definition);
  const objective = definition.objective;
  if (!isMvpObjective(objective)) {
    throw new Error(`Combat objective ${objective} is not implemented in the C07 MVP set.`);
  }

  if ((objective === 'survive' || objective === 'protect') && definition.turnLimit === undefined) {
    throw new Error(`Combat objective ${objective} requires a turnLimit (rounds to hold).`);
  }

  if (objective === 'protect') {
    const allies = definition.combatants.filter((combatant) => combatant.side === 'ally');
    if (allies.length !== 1) throw new Error('Combat objective protect requires exactly one ally.');
  }

  if (objective === 'interrupt') {
    if (!definition.gimmicks.includes('charging')) {
      throw new Error('Combat objective interrupt requires the charging gimmick.');
    }
    const hasInterruptSource =
      (definition.techniques ?? []).some((technique) => technique.job === 'interrupt-charge')
      || (definition.actOptions ?? []).some((act) => act.job === 'interrupt');
    if (!hasInterruptSource) {
      throw new Error('Combat objective interrupt requires an interrupt Technique or ACT.');
    }
  }

  if (objective === 'pacify' && pacifyActs(definition).length === 0) {
    throw new Error('Combat objective pacify requires at least one enemy-targeted pacify ACT.');
  }

  return definition;
}

function pacifyActs(definition: CombatDefinition) {
  return (definition.actOptions ?? []).filter(
    (act) => act.job === 'pacify-progress' && act.targetKind === 'enemy' && act.requiredSteps > 0
  );
}

function roundsCompleted(state: CombatState, limit: number): number {
  return Math.min(limit, Math.max(0, state.round - 1));
}

/**
 * Pure deterministic objective evaluation. It reads only engine-owned state;
 * no narration, provider output or random value participates.
 *
 * Precedence (conservative, fail-forward):
 *  1. player at 0 HP -> defeat;
 *  2. protect: ally at 0 HP -> defeat;
 *  3. objective-specific completion;
 *  4. every enemy at 0 HP -> victory (ATTACK always remains a valid path).
 */
export function evaluateObjective(
  definition: CombatDefinition,
  state: CombatState
): CombatObjectiveEvaluation {
  validateObjectiveDefinition(definition);
  if (state.definitionId !== definition.id) {
    throw new Error(
      `Objective definition mismatch: state=${state.definitionId}, definition=${definition.id}`
    );
  }

  const objective = definition.objective as MvpCombatObjective;
  const enemies = state.combatants.filter((combatant) => combatant.side === 'enemy');
  const enemiesDown = enemies.filter((enemy) => enemy.hp <= 0).length;
  const allEnemiesDown = enemies.length > 0 && enemiesDown === enemies.length;
  const player = state.combatants.find((combatant) => combatant.side === 'player');
  const ally = state.combatants.find((combatant) => combatant.side === 'ally');

  let progress: number;
  let required: number;
  let complete: boolean;
  let completeOutcome: CombatOutcome = 'victory';

  switch (objective) {
    case 'defeat':
      required = enemies.length;
      progress = enemiesDown;
      complete = allEnemiesDown;
      break;
    case 'survive':
    case 'protect':
      required = definition.turnLimit!;
      progress = roundsCompleted(state, required);
      complete = progress >= required;
      break;
    case 'interrupt':
      required = 1;
      progress = Math.min(required, Math.max(0, state.objectiveProgress));
      complete = progress >= required;
      break;
    case 'pacify': {
      const acts = pacifyActs(definition);
      required = acts.reduce((sum, act) => sum + act.requiredSteps, 0);
      progress = acts.reduce(
        (sum, act) => sum + Math.min(act.requiredSteps, state.actProgressById[act.id] ?? 0),
        0
      );
      complete = acts.every((act) => state.completedActIds.includes(act.id));
      completeOutcome = 'pacified';
      break;
    }
  }

  const base = { objective, progress, required };

  if (!player || player.hp <= 0) {
    return { ...base, complete: false, failed: true, outcome: 'defeat' };
  }
  if (objective === 'protect' && (!ally || ally.hp <= 0)) {
    return { ...base, complete: false, failed: true, outcome: 'defeat' };
  }
  if (complete) return { ...base, complete: true, failed: false, outcome: completeOutcome };
  if (allEnemiesDown) return { ...base, complete: false, failed: false, outcome: 'victory' };
  return { ...base, complete: false, failed: false };
}

/**
 * Write deterministic objective progress into CombatState and resolve the
 * encounter when the evaluation implies a terminal outcome. Idempotent:
 * applying it twice yields an equal state.
 */
export function applyObjective(definition: CombatDefinition, state: CombatState): CombatState {
  if (state.phase === 'resolved') return state;
  const evaluation = evaluateObjective(definition, state);
  const withProgress = state.objectiveProgress === evaluation.progress
    ? state
    : { ...state, objectiveProgress: evaluation.progress };
  if (!evaluation.outcome) return withProgress;
  return reduceCombatLifecycle(withProgress, { type: 'RESOLVE', outcome: evaluation.outcome });
}
