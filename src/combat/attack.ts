import type { CombatDefinition, CombatState } from '../contracts/combat';
import {
  reduceCombatState,
  validateCombatStateAgainstDefinition,
  type CombatReducerIssueCode
} from './engine';
import {
  COMBAT_TIMING_GRADES,
  resolveAttackDamage,
  validateCombatDefinitionContract,
  type CombatTimingGrade
} from './rules';

export type AttackIssueCode =
  | 'invalid-definition'
  | 'invalid-state'
  | 'invalid-phase'
  | 'invalid-timing-grade'
  | 'unknown-target'
  | 'target-not-enemy'
  | 'target-defeated'
  | 'reducer-rejected';

export interface AttackResolution {
  state: CombatState;
  accepted: boolean;
  targetId: string;
  timing?: CombatTimingGrade;
  damage?: number;
  issue?: AttackIssueCode;
  reducerIssue?: CombatReducerIssueCode;
}

const TIMING_GRADE_SET = new Set<string>(COMBAT_TIMING_GRADES);

function reject(state: CombatState, targetId: string, issue: AttackIssueCode): AttackResolution {
  return { state, accepted: false, targetId, issue };
}

/**
 * C02 ATTACK command adapter.
 *
 * ATTACK owns only target/phase/timing eligibility and the C00 damage formula.
 * C01 remains the sole HP mutation path. It deliberately does not end the
 * player's phase, resolve an objective/combat, grant rewards, or narrate.
 */
export function resolveAttack(
  definition: CombatDefinition,
  state: CombatState,
  targetId: string,
  timing: CombatTimingGrade
): AttackResolution {
  if (!validateCombatDefinitionContract(definition).ok) return reject(state, targetId, 'invalid-definition');
  if (!validateCombatStateAgainstDefinition(definition, state).ok) return reject(state, targetId, 'invalid-state');
  if (state.phase !== 'player') return reject(state, targetId, 'invalid-phase');
  if (!TIMING_GRADE_SET.has(timing as string)) return reject(state, targetId, 'invalid-timing-grade');

  const definitionTarget = definition.combatants.find((combatant) => combatant.id === targetId);
  const stateTarget = state.combatants.find((combatant) => combatant.id === targetId);
  if (!definitionTarget || !stateTarget) return reject(state, targetId, 'unknown-target');
  if (definitionTarget.team !== 'enemy') return reject(state, targetId, 'target-not-enemy');
  if (stateTarget.currentHp <= 0) return reject(state, targetId, 'target-defeated');

  const damage = resolveAttackDamage(timing);
  const reduced = reduceCombatState(definition, state, { type: 'DAMAGE', targetId, amount: damage });
  if (!reduced.accepted) {
    return {
      state,
      accepted: false,
      targetId,
      timing,
      damage,
      issue: 'reducer-rejected',
      reducerIssue: reduced.issue
    };
  }

  return { state: reduced.state, accepted: true, targetId, timing, damage };
}
