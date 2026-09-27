import { describe, expect, it } from 'vitest';
import type { CombatDefinition, CombatState } from '../../src/contracts/combat';
import { initializeCombatState, reduceCombatState } from '../../src/combat/engine';
import { checkLeaveAvailability, resolveLeave, resolvePlayerDefeat } from '../../src/combat/leave';

function definition(overrides: Partial<CombatDefinition> = {}): CombatDefinition {
  return {
    id: 'combat-leave-synthetic', encounterId: 'encounter-leave-synthetic', objective: 'defeat', gimmicks: [],
    combatants: [
      { id: 'player', templateId: 'player-synthetic', team: 'player', maxHp: 100 },
      { id: 'enemy', templateId: 'enemy-synthetic', team: 'enemy', maxHp: 54 }
    ],
    rewards: [{ id: 'xp-synthetic', kind: 'xp', amount: 20 }], fleeRule: 'always', ...overrides
  };
}

function stateFor(input: CombatDefinition): CombatState {
  const initialized = initializeCombatState(input);
  if (!initialized.ok) throw new Error('Synthetic LEAVE definition unexpectedly failed.');
  return initialized.state;
}

function nextRound(input: CombatDefinition, state: CombatState): CombatState {
  const enemy = reduceCombatState(input, state, { type: 'PLAYER_PHASE_ENDED' }).state;
  return reduceCombatState(input, enemy, { type: 'ROUND_ADVANCED' }).state;
}

describe('C06 LEAVE / flee / story exit and fail-forward defeat', () => {
  it('always: LEAVE escapes on the first player turn with a no-penalty fail-forward', () => {
    const input = definition();
    const state = stateFor(input);
    const result = resolveLeave(input, state);
    expect(result.accepted).toBe(true);
    expect(result.state).toMatchObject({ phase: 'resolved', outcome: 'escaped', objectiveProgress: 0 });
    expect(result.state.combatants).toEqual(state.combatants);
    expect(result.failForward).toEqual({ kind: 'withdrew', retryAvailable: true });
    expect(Object.keys(result).sort()).toEqual(['accepted', 'failForward', 'state']);
  });

  it('after-turn: blocked in round 1, allowed once a full round has passed', () => {
    const input = definition({ fleeRule: 'after-turn' });
    const state = stateFor(input);
    expect(resolveLeave(input, state)).toMatchObject({ accepted: false, issue: 'leave-not-yet' });
    expect(resolveLeave(input, state).state).toBe(state);
    expect(resolveLeave(input, nextRound(input, state))).toMatchObject({ accepted: true, state: { outcome: 'escaped' } });
  });

  it('story-gated: only runtime story context opens the exit, never the command itself', () => {
    const input = definition({ fleeRule: 'story-gated' });
    const state = stateFor(input);
    expect(resolveLeave(input, state)).toMatchObject({ accepted: false, issue: 'story-gated' });
    expect(resolveLeave(input, state, { storyExitOpen: false })).toMatchObject({ accepted: false, issue: 'story-gated' });
    expect(resolveLeave(input, state, { storyExitOpen: 'true' as never })).toMatchObject({ accepted: false, issue: 'story-gated' });
    const opened = resolveLeave(input, state, { storyExitOpen: true });
    expect(opened).toMatchObject({ accepted: true, state: { phase: 'resolved', outcome: 'story' }, failForward: { kind: 'story-exit', retryAvailable: true } });
  });

  it('rejects LEAVE outside the player phase, after resolution, or when the player is down', () => {
    const input = definition();
    const state = stateFor(input);
    const enemyPhase = reduceCombatState(input, state, { type: 'PLAYER_PHASE_ENDED' }).state;
    expect(checkLeaveAvailability(input, enemyPhase)).toEqual({ available: false, issue: 'invalid-phase' });
    const resolved = resolveLeave(input, state).state;
    expect(resolveLeave(input, resolved)).toMatchObject({ accepted: false, issue: 'invalid-phase' });
    const downed = reduceCombatState(input, state, { type: 'DAMAGE', targetId: 'player', amount: 100 }).state;
    expect(resolveLeave(input, downed)).toMatchObject({ accepted: false, issue: 'player-defeated' });
  });

  it('double LEAVE cannot resolve twice or change the first outcome', () => {
    const input = definition();
    const first = resolveLeave(input, stateFor(input));
    const second = resolveLeave(input, first.state);
    expect(second.accepted).toBe(false);
    expect(second.state).toBe(first.state);
  });

  it('defeat is a fail-forward retreat, only when HP is actually zero', () => {
    const input = definition();
    const state = stateFor(input);
    expect(resolvePlayerDefeat(input, state)).toMatchObject({ accepted: false, issue: 'player-standing' });
    const downed = reduceCombatState(input, state, { type: 'DAMAGE', targetId: 'player', amount: 250 }).state;
    const defeat = resolvePlayerDefeat(input, downed);
    expect(defeat).toMatchObject({ accepted: true, state: { phase: 'resolved', outcome: 'defeat' }, failForward: { kind: 'retreat-to-sanctuary', retryAvailable: true } });
    expect(resolvePlayerDefeat(input, defeat.state)).toMatchObject({ accepted: false, issue: 'combat-already-resolved' });
  });

  it('fails closed on malformed definitions and states', () => {
    const input = definition();
    const state = stateFor(input);
    expect(resolveLeave(definition({ fleeRule: 'whenever' as never }), state)).toMatchObject({ accepted: false });
    expect(resolveLeave(input, { ...state, round: 0 })).toMatchObject({ accepted: false, issue: 'invalid-state' });
    expect(resolvePlayerDefeat(input, { ...state, definitionId: 'other' })).toMatchObject({ accepted: false, issue: 'invalid-state' });
  });
});
