import type { CombatDefinition, CombatOutcome, CombatState } from '../contracts/combat';
import {
  COMBAT_OBJECTIVE_RULES,
  COMBAT_STATUS_KINDS,
  validateCombatDefinitionContract,
  type CombatContractIssue,
  type CombatStatusKind
} from './rules';

export type CombatReducerAction =
  | { type: 'DAMAGE'; targetId: string; amount: number }
  | { type: 'HEAL'; targetId: string; amount: number }
  | { type: 'OBJECTIVE_PROGRESS_SET'; progress: number }
  | { type: 'PLAYER_PHASE_ENDED' }
  | { type: 'ROUND_ADVANCED' }
  | { type: 'COMBAT_RESOLVED'; outcome: CombatOutcome };

export type CombatStateIssueCode =
  | 'definition-id-mismatch'
  | 'combatant-set-mismatch'
  | 'duplicate-state-combatant-id'
  | 'invalid-current-hp'
  | 'invalid-status'
  | 'duplicate-status'
  | 'invalid-round'
  | 'invalid-objective-progress'
  | 'invalid-phase'
  | 'invalid-outcome'
  | 'missing-outcome'
  | 'unexpected-outcome';

export interface CombatStateIssue {
  code: CombatStateIssueCode;
  path: string;
  detail: string;
}

export interface CombatStateValidation {
  ok: boolean;
  issues: CombatStateIssue[];
}

export type CombatInitializationResult =
  | { ok: true; state: CombatState }
  | { ok: false; issues: CombatContractIssue[] };

export type CombatReducerIssueCode =
  | 'invalid-definition'
  | 'invalid-state'
  | 'combat-already-resolved'
  | 'unknown-combatant'
  | 'invalid-amount'
  | 'invalid-objective-progress'
  | 'invalid-phase-transition'
  | 'invalid-outcome'
  | 'invalid-action';

export interface CombatReducerResult {
  state: CombatState;
  accepted: boolean;
  issue?: CombatReducerIssueCode;
}

const STATUS_SET = new Set<string>(COMBAT_STATUS_KINDS);
const PHASE_SET = new Set<string>(['player', 'enemy', 'resolved']);
const OUTCOME_SET = new Set<string>(['victory', 'pacified', 'escaped', 'defeat', 'story']);
const hasDuplicates = (values: readonly string[]) => new Set(values).size !== values.length;
const isNonNegativeInteger = (value: number) => Number.isFinite(value) && Number.isInteger(value) && value >= 0;

/**
 * C01 runtime state validator. Durable schema acceptance is intentionally a
 * separate concern: this checks whether a state can safely enter the combat
 * reducer under one already-C00-valid definition.
 */
export function validateCombatStateAgainstDefinition(
  definition: CombatDefinition,
  state: CombatState
): CombatStateValidation {
  const issues: CombatStateIssue[] = [];
  const push = (code: CombatStateIssueCode, path: string, detail: string) => issues.push({ code, path, detail });

  if (state.definitionId !== definition.id) {
    push('definition-id-mismatch', 'definitionId', `State ${state.definitionId} does not belong to definition ${definition.id}.`);
  }

  const definitionIds = definition.combatants.map((combatant) => combatant.id);
  const stateIds = state.combatants.map((combatant) => combatant.id);
  if (hasDuplicates(stateIds)) {
    push('duplicate-state-combatant-id', 'combatants', 'CombatState combatant ids must be unique.');
  }
  if (definitionIds.length !== stateIds.length || definitionIds.some((id) => !stateIds.includes(id))) {
    push('combatant-set-mismatch', 'combatants', 'CombatState must contain exactly the definition combatants.');
  }

  const maxHpById = new Map(definition.combatants.map((combatant) => [combatant.id, combatant.maxHp] as const));
  for (const [index, combatant] of state.combatants.entries()) {
    const maxHp = maxHpById.get(combatant.id);
    if (maxHp !== undefined && (!Number.isInteger(combatant.currentHp) || combatant.currentHp < 0 || combatant.currentHp > maxHp)) {
      push('invalid-current-hp', `combatants[${index}].currentHp`, `currentHp must be an integer from 0 to ${maxHp}.`);
    }
    if (hasDuplicates(combatant.statuses)) {
      push('duplicate-status', `combatants[${index}].statuses`, 'Combatant statuses must be unique.');
    }
    for (const status of combatant.statuses) {
      if (!STATUS_SET.has(status)) push('invalid-status', `combatants[${index}].statuses`, `Unknown C00 status: ${status}.`);
    }
  }

  if (hasDuplicates(state.statuses)) push('duplicate-status', 'statuses', 'Global combat statuses must be unique.');
  for (const status of state.statuses) {
    if (!STATUS_SET.has(status)) push('invalid-status', 'statuses', `Unknown C00 status: ${status}.`);
  }

  if (!Number.isInteger(state.round) || state.round < 1) push('invalid-round', 'round', 'Combat round must be an integer >= 1.');
  if (!PHASE_SET.has(state.phase as string)) push('invalid-phase', 'phase', `Unknown combat phase: ${String(state.phase)}.`);
  if (state.outcome !== undefined && !OUTCOME_SET.has(state.outcome as string)) {
    push('invalid-outcome', 'outcome', `Unknown combat outcome: ${String(state.outcome)}.`);
  }
  if (!isNonNegativeInteger(state.objectiveProgress)) {
    push('invalid-objective-progress', 'objectiveProgress', 'Objective progress must be a finite non-negative integer.');
  } else {
    const target = COMBAT_OBJECTIVE_RULES[definition.objective].progressTarget;
    if (target !== undefined && state.objectiveProgress > target) {
      push('invalid-objective-progress', 'objectiveProgress', `Objective progress cannot exceed target ${target}.`);
    }
  }

  if (state.phase === 'resolved' && state.outcome === undefined) {
    push('missing-outcome', 'outcome', 'Resolved combat must carry an outcome.');
  }
  if (state.phase !== 'resolved' && state.outcome !== undefined) {
    push('unexpected-outcome', 'outcome', 'Unresolved combat cannot carry an outcome.');
  }

  return { ok: issues.length === 0, issues };
}

/**
 * Create the one canonical initial state. Invalid definitions return no partial
 * state, so callers cannot accidentally continue with a half-valid encounter.
 */
export function initializeCombatState(definition: CombatDefinition): CombatInitializationResult {
  const validation = validateCombatDefinitionContract(definition);
  if (!validation.ok) return { ok: false, issues: validation.issues };

  return {
    ok: true,
    state: {
      definitionId: definition.id,
      round: 1,
      phase: 'player',
      combatants: definition.combatants.map((combatant) => ({ id: combatant.id, currentHp: combatant.maxHp, statuses: [] })),
      statuses: [],
      objectiveProgress: 0
    }
  };
}

function reject(state: CombatState, issue: CombatReducerIssueCode): CombatReducerResult {
  return { state, accepted: false, issue };
}

function accept(state: CombatState): CombatReducerResult {
  return { state, accepted: true };
}

function validAmount(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

function replaceCombatantHp(state: CombatState, targetId: string, currentHp: number): CombatState {
  const current = state.combatants.find((combatant) => combatant.id === targetId);
  if (!current || current.currentHp === currentHp) return state;
  return {
    ...state,
    combatants: state.combatants.map((combatant) => combatant.id === targetId ? { ...combatant, currentHp } : combatant)
  };
}

/**
 * Pure primitive reducer for C02-C10. It owns no player command semantics yet.
 * Provider proposals are never an accepted input type. Rewards/progression are
 * deliberately absent: C01 can resolve combat state, not grant consequences.
 */
export function reduceCombatState(
  definition: CombatDefinition,
  state: CombatState,
  action: CombatReducerAction
): CombatReducerResult {
  if (!validateCombatDefinitionContract(definition).ok) return reject(state, 'invalid-definition');
  if (!validateCombatStateAgainstDefinition(definition, state).ok) return reject(state, 'invalid-state');
  if (state.phase === 'resolved') return reject(state, 'combat-already-resolved');

  switch (action.type) {
    case 'DAMAGE': {
      if (!validAmount(action.amount)) return reject(state, 'invalid-amount');
      const target = state.combatants.find((combatant) => combatant.id === action.targetId);
      if (!target) return reject(state, 'unknown-combatant');
      return accept(replaceCombatantHp(state, action.targetId, Math.max(0, target.currentHp - action.amount)));
    }
    case 'HEAL': {
      if (!validAmount(action.amount)) return reject(state, 'invalid-amount');
      const target = state.combatants.find((combatant) => combatant.id === action.targetId);
      const maxHp = definition.combatants.find((combatant) => combatant.id === action.targetId)?.maxHp;
      if (!target || maxHp === undefined) return reject(state, 'unknown-combatant');
      return accept(replaceCombatantHp(state, action.targetId, Math.min(maxHp, target.currentHp + action.amount)));
    }
    case 'OBJECTIVE_PROGRESS_SET': {
      if (!isNonNegativeInteger(action.progress)) return reject(state, 'invalid-objective-progress');
      const target = COMBAT_OBJECTIVE_RULES[definition.objective].progressTarget;
      if (target !== undefined && action.progress > target) return reject(state, 'invalid-objective-progress');
      if (state.objectiveProgress === action.progress) return accept(state);
      return accept({ ...state, objectiveProgress: action.progress });
    }
    case 'PLAYER_PHASE_ENDED':
      if (state.phase !== 'player') return reject(state, 'invalid-phase-transition');
      return accept({ ...state, phase: 'enemy' });
    case 'ROUND_ADVANCED':
      if (state.phase !== 'enemy') return reject(state, 'invalid-phase-transition');
      return accept({ ...state, round: state.round + 1, phase: 'player' });
    case 'COMBAT_RESOLVED':
      if (!OUTCOME_SET.has(action.outcome as string)) return reject(state, 'invalid-outcome');
      return accept({ ...state, phase: 'resolved', outcome: action.outcome });
    default:
      return reject(state, 'invalid-action');
  }
}

/** Compile-time helper used by later status lanes without widening the shared string[] shape. */
export function isCombatStatusKind(value: string): value is CombatStatusKind {
  return STATUS_SET.has(value);
}
