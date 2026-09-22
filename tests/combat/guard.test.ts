import { describe, expect, it } from 'vitest';
import type { CombatDefinition } from '../../src/contracts/combat';
import { initializeCombatState, reduceCombatState } from '../../src/combat/engine';
import { beginGuard, resolveGuardedIncomingDamage } from '../../src/combat/guard';

function definition(overrides: Partial<CombatDefinition> = {}): CombatDefinition {
  return {
    id: 'combat-guard-synthetic', encounterId: 'encounter-guard-synthetic', objective: 'defeat', gimmicks: [],
    combatants: [
      { id: 'player', templateId: 'player-synthetic', team: 'player', maxHp: 100 },
      { id: 'enemy', templateId: 'enemy-synthetic', team: 'enemy', maxHp: 54 }
    ],
    rewards: [{ id: 'story-synthetic', kind: 'story' }], fleeRule: 'always', ...overrides
  };
}

function initialState(input = definition()) {
  const initialized = initializeCombatState(input);
  if (!initialized.ok) throw new Error('Synthetic guard definition unexpectedly failed.');
  return initialized.state;
}

function enemyPhaseAfterGuard(timing: 'base' | 'timed' = 'base') {
  const input = definition();
  const initial = initialState(input);
  const guarded = beginGuard(input, initial, timing);
  if (!guarded.accepted || !guarded.pending) throw new Error('Synthetic guard setup failed.');
  const enemy = reduceCombatState(input, guarded.state, { type: 'PLAYER_PHASE_ENDED' });
  if (!enemy.accepted) throw new Error('Synthetic enemy-phase transition failed.');
  return { input, initial, guarded, enemy };
}

describe('C03 deterministic GUARD mechanics', () => {
  it('sets one base guard in player phase without ending the phase', () => {
    const input = definition();
    const initial = initialState(input);
    const result = beginGuard(input, initial, 'base');
    expect(result.accepted).toBe(true);
    expect(result.pending).toEqual({ combatantId: 'player', timing: 'base' });
    expect(result.state.phase).toBe('player');
    expect(result.state.combatants.find((c) => c.id === 'player')?.statuses).toEqual(['guarded']);
    expect(initial.combatants.find((c) => c.id === 'player')?.statuses).toEqual([]);
  });

  it('base GUARD reduces one enemy-phase 20-damage hit to 10 and consumes only guarded', () => {
    const { input, guarded, enemy } = enemyPhaseAfterGuard('base');
    const player = enemy.state.combatants.find((c) => c.id === 'player')!;
    const decorated = {
      ...enemy.state,
      combatants: enemy.state.combatants.map((c) => c.id === 'player' ? { ...c, statuses: ['exposed', ...c.statuses] } : c)
    };
    expect(player.currentHp).toBe(100);
    const result = resolveGuardedIncomingDamage(input, decorated, guarded.pending!, 20);
    expect(result).toMatchObject({ accepted: true, incomingDamage: 20, appliedDamage: 10 });
    expect(result.state.combatants.find((c) => c.id === 'player')).toMatchObject({ currentHp: 90, statuses: ['exposed'] });
    expect(result.state.phase).toBe('enemy');
    expect(result.state.objectiveProgress).toBe(0);
    expect(result.state.outcome).toBeUndefined();
  });

  it('timed GUARD reduces one enemy-phase 20-damage hit to 5', () => {
    const { input, guarded, enemy } = enemyPhaseAfterGuard('timed');
    const result = resolveGuardedIncomingDamage(input, enemy.state, guarded.pending!, 20);
    expect(result).toMatchObject({ accepted: true, appliedDamage: 5 });
    expect(result.state.combatants.find((c) => c.id === 'player')?.currentHp).toBe(95);
  });

  it('consumes GUARD exactly once', () => {
    const { input, guarded, enemy } = enemyPhaseAfterGuard('base');
    const first = resolveGuardedIncomingDamage(input, enemy.state, guarded.pending!, 20);
    expect(first.accepted).toBe(true);
    const second = resolveGuardedIncomingDamage(input, first.state, guarded.pending!, 20);
    expect(second).toEqual({ state: first.state, accepted: false, pending: guarded.pending!, issue: 'not-guarding' });
  });

  it('requires player phase, living player and one unstacked guard setup', () => {
    const input = definition();
    const initial = initialState(input);
    const enemy = reduceCombatState(input, initial, { type: 'PLAYER_PHASE_ENDED' });
    expect(beginGuard(input, enemy.state, 'base')).toEqual({ state: enemy.state, accepted: false, issue: 'invalid-phase' });

    const first = beginGuard(input, initial, 'base');
    expect(first.accepted).toBe(true);
    expect(beginGuard(input, first.state, 'base')).toEqual({ state: first.state, accepted: false, issue: 'already-guarding' });

    const knockedOut = reduceCombatState(input, initial, { type: 'DAMAGE', targetId: 'player', amount: 999 });
    expect(beginGuard(input, knockedOut.state, 'base')).toEqual({ state: knockedOut.state, accepted: false, issue: 'player-defeated' });
  });

  it('rejects malformed timing, receipt, phase and incoming damage without consuming guard', () => {
    const { input, guarded, enemy } = enemyPhaseAfterGuard('base');
    const state = enemy.state;
    const pending = guarded.pending!;

    expect(resolveGuardedIncomingDamage(input, state, { ...pending, timing: 'bogus' as never }, 20).issue).toBe('invalid-timing-grade');
    expect(resolveGuardedIncomingDamage(input, state, { ...pending, combatantId: 'enemy' }, 20).issue).toBe('guard-receipt-mismatch');
    expect(resolveGuardedIncomingDamage(input, guarded.state, pending, 20).issue).toBe('invalid-phase');
    for (const amount of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = resolveGuardedIncomingDamage(input, state, pending, amount);
      expect(result).toEqual({ state, accepted: false, pending, issue: 'invalid-incoming-damage' });
    }
    expect(state.combatants.find((c) => c.id === 'player')?.statuses).toContain('guarded');
  });

  it('fails closed through C00/C01 validation before changing guard state', () => {
    const input = definition();
    const initial = initialState(input);
    const badDefinition = definition({ combatants: [
      { id: 'player', templateId: 'player-synthetic', team: 'player', maxHp: 99 },
      { id: 'enemy', templateId: 'enemy-synthetic', team: 'enemy', maxHp: 54 }
    ] });
    expect(beginGuard(badDefinition, initial, 'base')).toEqual({ state: initial, accepted: false, issue: 'invalid-definition' });
    const badState = { ...initial, definitionId: 'wrong' };
    expect(beginGuard(input, badState, 'base')).toEqual({ state: badState, accepted: false, issue: 'invalid-state' });
  });

  it('is deterministic and leaves input definition/state untouched', () => {
    const input = definition();
    const initial = initialState(input);
    const inputBefore = structuredClone(input);
    const stateBefore = structuredClone(initial);
    const first = beginGuard(input, initial, 'timed');
    const second = beginGuard(input, initial, 'timed');
    expect(second).toEqual(first);
    expect(input).toEqual(inputBefore);
    expect(initial).toEqual(stateBefore);
  });
});
