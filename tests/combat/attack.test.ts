import { describe, expect, it } from 'vitest';
import {
  applyAttack,
  attackDamage,
  BASE_ATTACK_DAMAGE,
  createCombatState,
  DEFAULT_COMBAT_HP,
  TIMED_ATTACK_BONUS
} from '../../src/combat/engine';
import type { CombatDefinition } from '../../src/combat/types';

const definition = (enemyHp = 60): CombatDefinition => ({
  id: 'combat_attack_fixture',
  encounterId: 'encounter_attack_fixture',
  objective: 'defeat',
  gimmicks: [],
  combatants: [
    { id: 'greyson', label: 'Greyson', side: 'player', maxHp: DEFAULT_COMBAT_HP },
    { id: 'enemy_1', label: 'Synthetic Foe', side: 'enemy', maxHp: enemyHp }
  ],
  rewards: [{ id: 'reward_attack_fixture', kind: 'xp', amount: 10 }],
  fleeRule: 'always'
});

describe('Combat ATTACK mechanics (C02)', () => {
  it('uses the frozen 18 base damage when timing is absent or declined', () => {
    expect(BASE_ATTACK_DAMAGE).toBe(18);
    expect(attackDamage()).toBe(18);
    expect(attackDamage(false)).toBe(18);

    const state = createCombatState(definition());
    const result = applyAttack(state, { actorId: 'greyson', targetId: 'enemy_1' });

    expect(result.damage).toBe(18);
    expect(result.timedSuccess).toBe(false);
    expect(result.state.combatants.find((combatant) => combatant.id === 'enemy_1')?.hp).toBe(42);
  });

  it('adds exactly +6 for an injected successful timing result', () => {
    expect(TIMED_ATTACK_BONUS).toBe(6);
    expect(attackDamage(true)).toBe(24);

    const state = createCombatState(definition());
    const result = applyAttack(state, {
      actorId: 'greyson',
      targetId: 'enemy_1',
      timedSuccess: true
    });

    expect(result.damage).toBe(24);
    expect(result.timedSuccess).toBe(true);
    expect(result.state.combatants.find((combatant) => combatant.id === 'enemy_1')?.hp).toBe(36);
  });

  it('is deterministic for identical state and input and uses no random roll', () => {
    const state = createCombatState(definition());
    const command = { actorId: 'greyson', targetId: 'enemy_1', timedSuccess: true };

    expect(applyAttack(state, command)).toEqual(applyAttack(state, command));
    expect(state.combatants.find((combatant) => combatant.id === 'enemy_1')?.hp).toBe(60);
  });

  it('floors HP at zero and reports defeat without resolving outcome/reward/phase', () => {
    const state = createCombatState(definition(10));
    const result = applyAttack(state, { actorId: 'greyson', targetId: 'enemy_1' });

    expect(result.state.combatants.find((combatant) => combatant.id === 'enemy_1')?.hp).toBe(0);
    expect(result.targetDefeated).toBe(true);
    expect(result.state.phase).toBe('player');
    expect(result.state.outcome).toBeUndefined();
    expect(result.state.objectiveProgress).toBe(0);
  });

  it('refuses invalid authority/phase/target states instead of repairing them', () => {
    const state = createCombatState(definition());
    const enemyPhase = { ...state, phase: 'enemy' as const };

    expect(() => applyAttack(enemyPhase, { actorId: 'greyson', targetId: 'enemy_1' }))
      .toThrow('ATTACK requires player phase');

    expect(() => applyAttack(state, { actorId: 'enemy_1', targetId: 'greyson' }))
      .toThrow('is not the player');

    expect(() => applyAttack(state, { actorId: 'greyson', targetId: 'greyson' }))
      .toThrow('is not an enemy');

    expect(() => applyAttack(state, { actorId: 'missing', targetId: 'enemy_1' }))
      .toThrow('Unknown ATTACK actor');
  });
});
