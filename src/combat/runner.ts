import { activateTechnique, createCombatState, reduceCombatLifecycle, resolveAct, resolveLeave } from './engine';
import { declareGuard } from './statuses';
import { applyActEffect, applyTechniqueEffect, resolveGimmickAttack, validateGimmicks } from './gimmicks';
import { resolveEnemyPhase, telegraphIntents } from './intent';
import { applyObjective, validateObjectiveDefinition } from './objectives';
import type { CombatDefinition, CombatLeaveContext, CombatState } from './types';

/**
 * Player intent emitted by the presentation layer (C13 CombatPanel) and
 * consumed by deterministic orchestration. Timing quality is optional input
 * texture only (C14): omitting it always yields the base action.
 */
export type CombatPlayerIntent =
  | { verb: 'attack'; targetId: string; timedSuccess?: boolean }
  | { verb: 'technique'; techniqueId: string; targetId: string }
  | { verb: 'guard'; timedSuccess?: boolean }
  | { verb: 'act'; actId: string }
  | { verb: 'leave' };

/** Start an encounter with the round-1 enemy intents already telegraphed. */
export function startEncounter(definition: CombatDefinition): CombatState {
  validateGimmicks(definition);
  validateObjectiveDefinition(definition);
  return telegraphIntents(definition, createCombatState(definition));
}

function playerId(state: CombatState): string {
  return state.combatants.find((combatant) => combatant.side === 'player')!.id;
}

/**
 * Resolve one full round deterministically: the player's verb, an objective
 * check, then (if unresolved) the telegraphed enemy phase. Pure; engine-only.
 */
export function playRound(
  definition: CombatDefinition,
  state: CombatState,
  intent: CombatPlayerIntent,
  leaveContext: CombatLeaveContext = {}
): CombatState {
  const actorId = playerId(state);
  let next = state;
  let guardTimedSuccess = false;

  switch (intent.verb) {
    case 'attack':
      next = resolveGimmickAttack(definition, next, {
        actorId,
        targetId: intent.targetId,
        timedSuccess: intent.timedSuccess === true
      }).state;
      break;
    case 'technique': {
      const activation = activateTechnique(definition, next, { actorId, techniqueId: intent.techniqueId });
      next = applyTechniqueEffect(definition, activation, intent.targetId).state;
      break;
    }
    case 'guard':
      next = declareGuard(next, actorId);
      guardTimedSuccess = intent.timedSuccess === true;
      break;
    case 'act':
      next = applyActEffect(definition, resolveAct(definition, next, { actorId, actId: intent.actId })).state;
      break;
    case 'leave':
      return resolveLeave(definition, next, { actorId }, leaveContext).state;
  }

  next = applyObjective(definition, next);
  if (next.phase === 'resolved') return next;
  next = reduceCombatLifecycle(next, { type: 'END_PLAYER_PHASE' });
  return resolveEnemyPhase(definition, next, { guardTimedSuccess }).state;
}

export interface EncounterSimulation {
  state: CombatState;
  turns: number;
  intents: CombatPlayerIntent[];
}

export type ScriptedPlayer = (definition: CombatDefinition, state: CombatState) => CombatPlayerIntent;

/** Run a scripted player until resolution or `maxTurns`. Deterministic. */
export function simulateEncounter(
  definition: CombatDefinition,
  script: ScriptedPlayer,
  maxTurns = 12
): EncounterSimulation {
  let state = startEncounter(definition);
  const intents: CombatPlayerIntent[] = [];
  while (state.phase !== 'resolved' && intents.length < maxTurns) {
    if (state.phase !== 'player') throw new Error('Simulation expected player phase.');
    const intent = script(definition, state);
    intents.push(intent);
    state = playRound(definition, state, intent);
  }
  return { state, turns: intents.length, intents };
}
