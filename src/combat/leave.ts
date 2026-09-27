import type { CombatDefinition, CombatState } from '../contracts/combat';
import { reduceCombatState, validateCombatStateAgainstDefinition } from './engine';
import { validateCombatDefinitionContract } from './rules';

/**
 * Runtime story context supplied by deterministic Adventure state owned by the
 * application. It is deliberately NOT part of the player's command: a LEAVE
 * command cannot declare its own story exit open.
 */
export interface LeaveContext {
  storyExitOpen: boolean;
}

export type FailForwardKind = 'withdrew' | 'story-exit' | 'retreat-to-sanctuary';

/**
 * What happens next after an exit. Every exit keeps the way back open and
 * carries no penalty field: leaving is not framed as failure, and defeat
 * attaches no real-world judgment (Appendix I.8).
 */
export interface FailForwardDescriptor {
  kind: FailForwardKind;
  retryAvailable: true;
}

export type LeaveIssueCode =
  | 'invalid-definition'
  | 'invalid-state'
  | 'invalid-phase'
  | 'player-defeated'
  | 'leave-not-yet'
  | 'story-gated'
  | 'reducer-rejected';

export interface LeaveResolution {
  state: CombatState;
  accepted: boolean;
  failForward?: FailForwardDescriptor;
  issue?: LeaveIssueCode;
}

export type DefeatIssueCode = 'invalid-definition' | 'invalid-state' | 'combat-already-resolved' | 'player-standing' | 'reducer-rejected';

export interface DefeatResolution {
  state: CombatState;
  accepted: boolean;
  failForward?: FailForwardDescriptor;
  issue?: DefeatIssueCode;
}

const CLOSED_STORY: LeaveContext = { storyExitOpen: false };

function player(definition: CombatDefinition, state: CombatState) {
  const id = definition.combatants.find((combatant) => combatant.team === 'player')?.id;
  return state.combatants.find((combatant) => combatant.id === id);
}

/** Pure availability check so a UI can show why LEAVE is unavailable without trying it. */
export function checkLeaveAvailability(
  definition: CombatDefinition,
  state: CombatState,
  context: LeaveContext = CLOSED_STORY
): { available: boolean; issue?: LeaveIssueCode } {
  if (!validateCombatDefinitionContract(definition).ok) return { available: false, issue: 'invalid-definition' };
  if (!validateCombatStateAgainstDefinition(definition, state).ok) return { available: false, issue: 'invalid-state' };
  if (state.phase !== 'player') return { available: false, issue: 'invalid-phase' };
  const self = player(definition, state);
  if (!self || self.currentHp <= 0) return { available: false, issue: 'player-defeated' };
  switch (definition.fleeRule) {
    case 'always':
      return { available: true };
    case 'after-turn':
      return state.round >= 2 ? { available: true } : { available: false, issue: 'leave-not-yet' };
    case 'story-gated':
      return context.storyExitOpen === true ? { available: true } : { available: false, issue: 'story-gated' };
    default:
      return { available: false, issue: 'invalid-definition' };
  }
}

/**
 * C06 LEAVE command. A permitted LEAVE resolves combat as `escaped` (or `story`
 * for an opened story exit) through the C01 reducer and returns a fail-forward
 * descriptor. It grants no reward and removes nothing; consequences belong to
 * the Adventure lane.
 */
export function resolveLeave(
  definition: CombatDefinition,
  state: CombatState,
  context: LeaveContext = CLOSED_STORY
): LeaveResolution {
  const availability = checkLeaveAvailability(definition, state, context);
  if (!availability.available) return { state, accepted: false, issue: availability.issue };

  const storyExit = definition.fleeRule === 'story-gated';
  const reduced = reduceCombatState(definition, state, { type: 'COMBAT_RESOLVED', outcome: storyExit ? 'story' : 'escaped' });
  if (!reduced.accepted) return { state, accepted: false, issue: 'reducer-rejected' };
  return { state: reduced.state, accepted: true, failForward: { kind: storyExit ? 'story-exit' : 'withdrew', retryAvailable: true } };
}

/**
 * Defeat is a fail-forward exit, not a game-over loop. It applies only once the
 * player's encounter-local HP is actually zero.
 */
export function resolvePlayerDefeat(definition: CombatDefinition, state: CombatState): DefeatResolution {
  if (!validateCombatDefinitionContract(definition).ok) return { state, accepted: false, issue: 'invalid-definition' };
  if (!validateCombatStateAgainstDefinition(definition, state).ok) return { state, accepted: false, issue: 'invalid-state' };
  if (state.phase === 'resolved') return { state, accepted: false, issue: 'combat-already-resolved' };
  const self = player(definition, state);
  if (self && self.currentHp > 0) return { state, accepted: false, issue: 'player-standing' };
  const reduced = reduceCombatState(definition, state, { type: 'COMBAT_RESOLVED', outcome: 'defeat' });
  if (!reduced.accepted) return { state, accepted: false, issue: 'reducer-rejected' };
  return { state: reduced.state, accepted: true, failForward: { kind: 'retreat-to-sanctuary', retryAvailable: true } };
}
