import { describe, expect, it } from 'vitest';
import {
  createCombatState,
  DEFAULT_COMBAT_HP,
  guardedIncomingDamage,
  GUARD_REDUCTION,
  PERFECT_GUARD_REDUCTION,
  resolveGuardDamage
} from '../../src/combat/engine';
import type { CombatDefinition } from '../../src/combat/types';

const definition = (): CombatDefinition => ({
  id: 'combat_guard_fixture',
  encounterId: 'encounter_guard_fixture',
  objective: 'survive',
  gimmicks: [],
  combatants: [
    { id: 'greyson', label: 'Greyson', side: 'player', maxHp: DEFAULT_COMBAT_HP },
    { id: 'enemy_1', label: 'Synthetic Foe', side: 'enemy', maxHp: 48 }
  ],
  rewards: [],
  fleeRule: 'always'
});

describe('Combat GUARD mechanics (C03)', () => {
  it('uses exactly 50% ordinary reduction with ceil integer rounding', () => {
    expect(GUARD_REDUCTION).toBe(0.50);
    expect(guardedIncomingDamage(20)).toBe(10);
    expect(guardedIncomingDamage(11)).toBe(6);
    expect(guardedIncomingDamage(1)).toBe(1);
  });

  it('uses exactly 75% perfect-guard reduction when timing succeeds', () => {
    expect(PERFECT_GUARD_REDUCTION).toBe(0.75);
    expect(guardedIncomingDamage(20, true)).toBe(5);
    expect(guardedIncomingDamage(11, true)).toBe(3);
    expect(guardedIncomingDamage(1, true)).toBe(1);
  });

  it('keeps timing optional rather than making GUARD a reflex gate', () => {
    const state = createCombatState(definition());
    const ordinary = resolveGuardDamage(state, { actorId: 'greyson' }, 18);
    const perfect = resolveGuardDamage(state, { actorId: 'greyson', timedSuccess: true }, 18);
    expect(ordinary).toEqual({ actorId: 'greyson', rawDamage: 18, damageTaken: 9, damagePrevented: 9, timedSuccess: false });
    expect(perfect).toEqual({ actorId: 'greyson', rawDamage: 18, damageTaken: 5, damagePrevented: 13, timedSuccess: true });
  });

  it('is deterministic and does not mutate CombatState', () => {
    const state = createCombatState(definition());
    const command = { actorId: 'greyson', timedSuccess: true };
    expect(resolveGuardDamage(state, command, 17)).toEqual(resolveGuardDamage(state, command, 17));
    expect(state.combatants.find((combatant) => combatant.id === 'greyson')?.hp).toBe(100);
    expect(state.statuses).toEqual([]);
  });

  it('refuses invalid raw damage and non-player/defeated actors', () => {
    const state = createCombatState(definition());
    expect(() => guardedIncomingDamage(-1)).toThrow('non-negative integer');
    expect(() => guardedIncomingDamage(1.5)).toThrow('non-negative integer');
    expect(() => resolveGuardDamage(state, { actorId: 'enemy_1' }, 10)).toThrow('is not the player');
    const defeated = { ...state, combatants: state.combatants.map((combatant) => combatant.id === 'greyson' ? { ...combatant, hp: 0 } : combatant) };
    expect(() => resolveGuardDamage(defeated, { actorId: 'greyson' }, 10)).toThrow('is defeated');
  });

  it('does not apply damage, advance phase, resolve outcome or grant rewards itself', () => {
    const state = createCombatState(definition());
    resolveGuardDamage(state, { actorId: 'greyson' }, 22);
    expect(state.phase).toBe('player');
    expect(state.outcome).toBeUndefined();
    expect(state.objectiveProgress).toBe(0);
    expect(state.combatants.find((combatant) => combatant.id === 'greyson')?.hp).toBe(100);
  });
});
