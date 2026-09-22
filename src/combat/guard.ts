import type { CombatDefinition, CombatState } from '../contracts/combat';
import { reduceCombatState, validateCombatStateAgainstDefinition, type CombatReducerIssueCode } from './engine';
import {
  COMBAT_TIMING_GRADES,
  resolveGuardedDamage,
  validateCombatDefinitionContract,
  type CombatTimingGrade
} from './rules';

export interface PendingGuard {
  combatantId: string;
  timing: CombatTimingGrade;
}

export type GuardSetupIssueCode =
  | 'invalid-definition'
  | 'invalid-state'
  | 'invalid-phase'
  | 'invalid-timing-grade'
  | 'player-missing'
  | 'player-defeated'
  | 'already-guarding';

export interface GuardSetupResult {
  state: CombatState;
  accepted: boolean;
  pending?: PendingGuard;
  issue?: GuardSetupIssueCode;
}

export type GuardedHitIssueCode =
  | 'invalid-definition'
  | 'invalid-state'
  | 'invalid-phase'
  | 'invalid-timing-grade'
  | 'invalid-incoming-damage'
  | 'player-missing'
  | 'player-defeated'
  | 'guard-receipt-mismatch'
  | 'not-guarding'
  | 'reducer-rejected';

export interface GuardedHitResult {
  state: CombatState;
  accepted: boolean;
  pending: PendingGuard;
  incomingDamage?: number;
  appliedDamage?: number;
  issue?: GuardedHitIssueCode;
  reducerIssue?: CombatReducerIssueCode;
}

const TIMING_SET = new Set<string>(COMBAT_TIMING_GRADES);
const isPositiveInteger = (value: number) => Number.isFinite(value) && Number.isInteger(value) && value > 0;

function playerIds(definition: CombatDefinition): string[] {
  return definition.combatants.filter((combatant) => combatant.team === 'player').map((combatant) => combatant.id);
}

function withGuardedStatus(state: CombatState, combatantId: string): CombatState {
  return {
    ...state,
    combatants: state.combatants.map((combatant) => combatant.id === combatantId
      ? { ...combatant, statuses: [...combatant.statuses, 'guarded'] }
      : combatant)
  };
}

function withoutGuardedStatus(state: CombatState, combatantId: string): CombatState {
  return {
    ...state,
    combatants: state.combatants.map((combatant) => combatant.id === combatantId
      ? { ...combatant, statuses: combatant.statuses.filter((status) => status !== 'guarded') }
      : combatant)
  };
}

/**
 * C03 GUARD setup. The durable state records only the already-frozen `guarded`
 * marker; timing grade stays in a transient receipt for the next incoming hit.
 */
export function beginGuard(
  definition: CombatDefinition,
  state: CombatState,
  timing: CombatTimingGrade
): GuardSetupResult {
  if (!validateCombatDefinitionContract(definition).ok) return { state, accepted: false, issue: 'invalid-definition' };
  if (!validateCombatStateAgainstDefinition(definition, state).ok) return { state, accepted: false, issue: 'invalid-state' };
  if (state.phase !== 'player') return { state, accepted: false, issue: 'invalid-phase' };
  if (!TIMING_SET.has(timing as string)) return { state, accepted: false, issue: 'invalid-timing-grade' };

  const [playerId] = playerIds(definition);
  const player = state.combatants.find((combatant) => combatant.id === playerId);
  if (!playerId || !player) return { state, accepted: false, issue: 'player-missing' };
  if (player.currentHp <= 0) return { state, accepted: false, issue: 'player-defeated' };
  if (player.statuses.includes('guarded')) return { state, accepted: false, issue: 'already-guarding' };

  return {
    state: withGuardedStatus(state, playerId),
    accepted: true,
    pending: { combatantId: playerId, timing }
  };
}

/**
 * Consume one pending GUARD against one deterministic enemy-phase incoming hit.
 * Other statuses are preserved. Guard removal and HP loss commit atomically from
 * the caller's perspective: reducer failure returns the original guarded state.
 */
export function resolveGuardedIncomingDamage(
  definition: CombatDefinition,
  state: CombatState,
  pending: PendingGuard,
  incomingDamage: number
): GuardedHitResult {
  const reject = (issue: GuardedHitIssueCode): GuardedHitResult => ({ state, accepted: false, pending, issue });
  if (!validateCombatDefinitionContract(definition).ok) return reject('invalid-definition');
  if (!validateCombatStateAgainstDefinition(definition, state).ok) return reject('invalid-state');
  if (state.phase !== 'enemy') return reject('invalid-phase');
  if (!TIMING_SET.has(pending.timing as string)) return reject('invalid-timing-grade');
  if (!isPositiveInteger(incomingDamage)) return reject('invalid-incoming-damage');

  const [playerId] = playerIds(definition);
  const player = state.combatants.find((combatant) => combatant.id === playerId);
  if (!playerId || !player) return reject('player-missing');
  if (player.currentHp <= 0) return reject('player-defeated');
  if (pending.combatantId !== playerId) return reject('guard-receipt-mismatch');
  if (!player.statuses.includes('guarded')) return reject('not-guarding');

  const appliedDamage = resolveGuardedDamage(incomingDamage, pending.timing);
  const stripped = withoutGuardedStatus(state, playerId);
  const reduced = reduceCombatState(definition, stripped, { type: 'DAMAGE', targetId: playerId, amount: appliedDamage });
  if (!reduced.accepted) {
    return {
      state,
      accepted: false,
      pending,
      incomingDamage,
      appliedDamage,
      issue: 'reducer-rejected',
      reducerIssue: reduced.issue
    };
  }
  return { state: reduced.state, accepted: true, pending, incomingDamage, appliedDamage };
}
