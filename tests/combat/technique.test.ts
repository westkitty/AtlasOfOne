import { describe, expect, it } from 'vitest';
import {
  activateTechnique,
  createCombatState,
  DEFAULT_COMBAT_HP,
  DEFAULT_TECHNIQUE_CHARGES,
  reduceCombatLifecycle,
  validateCombatDefinition
} from '../../src/combat/engine';
import type { CombatDefinition } from '../../src/combat/types';

const definition = (overrides: Partial<CombatDefinition> = {}): CombatDefinition => ({
  id: 'combat_technique_fixture',
  encounterId: 'encounter_technique_fixture',
  objective: 'interrupt',
  gimmicks: ['charging'],
  combatants: [
    { id: 'greyson', label: 'Greyson', side: 'player', maxHp: DEFAULT_COMBAT_HP },
    { id: 'enemy_1', label: 'Synthetic Foe', side: 'enemy', maxHp: 60 }
  ],
  techniques: [
    {
      id: 'break_charge',
      label: 'Break Charge',
      job: 'interrupt-charge',
      chargeCost: 1,
      cooldownRounds: 0
    },
    {
      id: 'hold_line',
      label: 'Hold the Line',
      job: 'protect-ally',
      chargeCost: 1,
      cooldownRounds: 1
    }
  ],
  rewards: [],
  fleeRule: 'always',
  ...overrides
});

describe('Combat TECHNIQUE mechanics (C04)', () => {
  it('starts with the frozen two encounter-local charges and deterministic ready rounds', () => {
    const state = createCombatState(definition());
    expect(DEFAULT_TECHNIQUE_CHARGES).toBe(2);
    expect(state.combatants.find((item) => item.id === 'greyson')?.techniqueCharges).toBe(2);
    expect(state.techniqueReadyRound).toEqual({
      break_charge: 1,
      hold_line: 1
    });
  });

  it('spends a charge and makes cooldown 0 available again on the next player round', () => {
    const def = definition();
    const state = createCombatState(def);
    const used = activateTechnique(def, state, {
      actorId: 'greyson',
      techniqueId: 'break_charge'
    });

    expect(used).toMatchObject({
      actorId: 'greyson',
      techniqueId: 'break_charge',
      job: 'interrupt-charge',
      chargeCost: 1,
      nextUsableRound: 2
    });
    expect(used.state.combatants.find((item) => item.id === 'greyson')?.techniqueCharges).toBe(1);
    expect(used.state.techniqueReadyRound.break_charge).toBe(2);
    expect(used.state.phase).toBe('player');
    expect(used.state.objectiveProgress).toBe(0);

    expect(() => activateTechnique(def, used.state, {
      actorId: 'greyson',
      techniqueId: 'break_charge'
    })).toThrow('unavailable until round 2');

    const enemy = reduceCombatLifecycle(used.state, { type: 'END_PLAYER_PHASE' });
    const round2 = reduceCombatLifecycle(enemy, { type: 'END_ENEMY_PHASE' });
    expect(activateTechnique(def, round2, {
      actorId: 'greyson',
      techniqueId: 'break_charge'
    }).nextUsableRound).toBe(3);
  });

  it('represents one full skipped round with cooldownRounds 1', () => {
    const def = definition();
    const used = activateTechnique(def, createCombatState(def), {
      actorId: 'greyson',
      techniqueId: 'hold_line'
    });
    expect(used.nextUsableRound).toBe(3);

    const round2 = reduceCombatLifecycle(
      reduceCombatLifecycle(used.state, { type: 'END_PLAYER_PHASE' }),
      { type: 'END_ENEMY_PHASE' }
    );
    expect(round2.round).toBe(2);
    expect(() => activateTechnique(def, round2, {
      actorId: 'greyson',
      techniqueId: 'hold_line'
    })).toThrow('unavailable until round 3');

    const round3 = reduceCombatLifecycle(
      reduceCombatLifecycle(round2, { type: 'END_PLAYER_PHASE' }),
      { type: 'END_ENEMY_PHASE' }
    );
    expect(activateTechnique(def, round3, {
      actorId: 'greyson',
      techniqueId: 'hold_line'
    }).nextUsableRound).toBe(5);
  });

  it('refuses an activation that cannot pay the fixed charge cost', () => {
    const def = definition({
      techniques: [{
        id: 'all_in',
        label: 'All In',
        job: 'trade-damage-for-control',
        chargeCost: 2,
        cooldownRounds: 0
      }]
    });
    const state = createCombatState(def);
    const used = activateTechnique(def, state, {
      actorId: 'greyson',
      techniqueId: 'all_in'
    });
    expect(used.state.combatants.find((item) => item.id === 'greyson')?.techniqueCharges).toBe(0);

    const round2 = reduceCombatLifecycle(
      reduceCombatLifecycle(used.state, { type: 'END_PLAYER_PHASE' }),
      { type: 'END_ENEMY_PHASE' }
    );
    expect(() => activateTechnique(def, round2, {
      actorId: 'greyson',
      techniqueId: 'all_in'
    })).toThrow('2 charges; 0 remain');
  });

  it('validates the small authored registry rather than accepting arbitrary costs/cooldowns', () => {
    expect(() => validateCombatDefinition(definition({
      techniques: [
        { id: 'same', label: 'One', job: 'interrupt-charge', chargeCost: 1, cooldownRounds: 0 },
        { id: 'same', label: 'Two', job: 'protect-ally', chargeCost: 1, cooldownRounds: 0 }
      ]
    }))).toThrow('Duplicate combat technique id');

    expect(() => validateCombatDefinition(definition({
      techniques: [{
        id: 'too_expensive',
        label: 'Too Expensive',
        job: 'interrupt-charge',
        chargeCost: 3,
        cooldownRounds: 0
      }]
    }))).toThrow('exceeds the C00 encounter charge baseline');

    expect(() => validateCombatDefinition(definition({
      techniques: [{
        id: 'fractional_cooldown',
        label: 'Fractional',
        job: 'protect-ally',
        chargeCost: 1,
        cooldownRounds: 0.5
      }]
    }))).toThrow('cooldownRounds must be a non-negative integer');
  });

  it('refuses invalid phase, actor, definition, or Technique IDs', () => {
    const def = definition();
    const state = createCombatState(def);

    expect(() => activateTechnique(def, { ...state, phase: 'enemy' }, {
      actorId: 'greyson',
      techniqueId: 'break_charge'
    })).toThrow('requires player phase');

    expect(() => activateTechnique(def, state, {
      actorId: 'enemy_1',
      techniqueId: 'break_charge'
    })).toThrow('is not the player');

    expect(() => activateTechnique(def, state, {
      actorId: 'greyson',
      techniqueId: 'missing'
    })).toThrow('Unknown TECHNIQUE id');

    expect(() => activateTechnique(
      { ...def, id: 'other_definition' },
      state,
      { actorId: 'greyson', techniqueId: 'break_charge' }
    )).toThrow('definition mismatch');
  });

  it('returns the tactical job but does not apply its future status/objective effect', () => {
    const def = definition();
    const state = createCombatState(def);
    const result = activateTechnique(def, state, {
      actorId: 'greyson',
      techniqueId: 'break_charge'
    });

    expect(result.job).toBe('interrupt-charge');
    expect(result.state.statuses).toEqual([]);
    expect(result.state.objectiveProgress).toBe(0);
    expect(result.state.outcome).toBeUndefined();
    expect(state.combatants.find((item) => item.id === 'greyson')?.techniqueCharges).toBe(2);
  });
});
