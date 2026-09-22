import { describe, expect, it } from 'vitest';
import type { CombatDefinition } from '../../src/contracts/combat';
import { resolveAttack } from '../../src/combat/attack';
import { initializeCombatState, reduceCombatState } from '../../src/combat/engine';

function definition(overrides: Partial<CombatDefinition> = {}): CombatDefinition {
  return {
    id: 'combat-attack-synthetic',
    encounterId: 'encounter-attack-synthetic',
    objective: 'defeat',
    gimmicks: [],
    combatants: [
      { id: 'player', templateId: 'player-synthetic', team: 'player', maxHp: 100 },
      { id: 'enemy', templateId: 'enemy-synthetic', team: 'enemy', maxHp: 54 },
      { id: 'ally', templateId: 'ally-synthetic', team: 'ally', maxHp: 30 }
    ],
    rewards: [{ id: 'story-synthetic', kind: 'story' }],
    fleeRule: 'always',
    ...overrides
  };
}

function initialState(input = definition()) {
  const initialized = initializeCombatState(input);
  if (!initialized.ok) throw new Error('Synthetic attack definition unexpectedly failed.');
  return initialized.state;
}

describe('C02 deterministic ATTACK mechanics', () => {
  it('applies the always-available base ATTACK through the C01 damage primitive', () => {
    const input = definition();
    const before = initialState(input);
    const result = resolveAttack(input, before, 'enemy', 'base');

    expect(result).toMatchObject({ accepted: true, targetId: 'enemy', timing: 'base', damage: 18 });
    expect(result.state.combatants.find((combatant) => combatant.id === 'enemy')?.currentHp).toBe(36);
    expect(result.state).toMatchObject({ round: 1, phase: 'player', objectiveProgress: 0 });
    expect(result.state.outcome).toBeUndefined();
    expect(before.combatants.find((combatant) => combatant.id === 'enemy')?.currentHp).toBe(54);
  });

  it('applies only the fixed +6 optional timed bonus', () => {
    const input = definition();
    const before = initialState(input);
    const result = resolveAttack(input, before, 'enemy', 'timed');

    expect(result).toMatchObject({ accepted: true, timing: 'timed', damage: 24 });
    expect(result.state.combatants.find((combatant) => combatant.id === 'enemy')?.currentHp).toBe(30);
  });

  it('lets C01 clamp lethal damage to zero without auto-resolving combat', () => {
    const input = definition();
    const before = initialState(input);
    const weakened = reduceCombatState(input, before, { type: 'DAMAGE', targetId: 'enemy', amount: 50 });
    expect(weakened.accepted).toBe(true);

    const result = resolveAttack(input, weakened.state, 'enemy', 'base');
    expect(result.accepted).toBe(true);
    expect(result.state.combatants.find((combatant) => combatant.id === 'enemy')?.currentHp).toBe(0);
    expect(result.state.phase).toBe('player');
    expect(result.state.outcome).toBeUndefined();
    expect(result.state.objectiveProgress).toBe(0);
  });

  it('requires player phase and performs no implicit phase handoff', () => {
    const input = definition();
    const before = initialState(input);
    const enemyPhase = reduceCombatState(input, before, { type: 'PLAYER_PHASE_ENDED' });
    expect(enemyPhase.accepted).toBe(true);

    const rejected = resolveAttack(input, enemyPhase.state, 'enemy', 'base');
    expect(rejected).toEqual({ state: enemyPhase.state, accepted: false, targetId: 'enemy', issue: 'invalid-phase' });

    const accepted = resolveAttack(input, before, 'enemy', 'base');
    expect(accepted.state.phase).toBe('player');
    expect(accepted.state.round).toBe(1);
  });

  it('rejects player, ally, missing and already-defeated targets without mutation', () => {
    const input = definition();
    const before = initialState(input);

    expect(resolveAttack(input, before, 'player', 'base'))
      .toEqual({ state: before, accepted: false, targetId: 'player', issue: 'target-not-enemy' });
    expect(resolveAttack(input, before, 'ally', 'base'))
      .toEqual({ state: before, accepted: false, targetId: 'ally', issue: 'target-not-enemy' });
    expect(resolveAttack(input, before, 'missing', 'base'))
      .toEqual({ state: before, accepted: false, targetId: 'missing', issue: 'unknown-target' });

    const defeated = reduceCombatState(input, before, { type: 'DAMAGE', targetId: 'enemy', amount: 999 });
    expect(defeated.accepted).toBe(true);
    expect(resolveAttack(input, defeated.state, 'enemy', 'base'))
      .toEqual({ state: defeated.state, accepted: false, targetId: 'enemy', issue: 'target-defeated' });
  });

  it('rejects timing grades outside the frozen base/timed vocabulary at runtime', () => {
    const input = definition();
    const before = initialState(input);
    const result = resolveAttack(input, before, 'enemy', 'perfect-plus' as never);
    expect(result).toEqual({ state: before, accepted: false, targetId: 'enemy', issue: 'invalid-timing-grade' });
  });

  it('fails closed through C00/C01 validation before calculating damage', () => {
    const input = definition();
    const before = initialState(input);
    const badDefinition = definition({
      combatants: [
        { id: 'player', templateId: 'player-synthetic', team: 'player', maxHp: 99 },
        { id: 'enemy', templateId: 'enemy-synthetic', team: 'enemy', maxHp: 54 }
      ]
    });
    expect(resolveAttack(badDefinition, before, 'enemy', 'base'))
      .toEqual({ state: before, accepted: false, targetId: 'enemy', issue: 'invalid-definition' });

    const badState = { ...before, definitionId: 'wrong' };
    expect(resolveAttack(input, badState, 'enemy', 'base'))
      .toEqual({ state: badState, accepted: false, targetId: 'enemy', issue: 'invalid-state' });
  });

  it('is deterministic and leaves definition/source state unchanged', () => {
    const input = definition();
    const definitionBefore = structuredClone(input);
    const state = initialState(input);
    const stateBefore = structuredClone(state);

    const first = resolveAttack(input, state, 'enemy', 'timed');
    const second = resolveAttack(input, state, 'enemy', 'timed');
    expect(second).toEqual(first);
    expect(input).toEqual(definitionBefore);
    expect(state).toEqual(stateBefore);
  });
});
