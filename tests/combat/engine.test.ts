import { describe, expect, it } from 'vitest';
import {
  createCombatState,
  DEFAULT_COMBAT_HP,
  DEFAULT_TECHNIQUE_CHARGES,
  reduceCombatLifecycle,
  validateCombatDefinition
} from '../../src/combat/engine';
import type { CombatDefinition } from '../../src/combat/types';

const definition = (overrides: Partial<CombatDefinition> = {}): CombatDefinition => ({
  id: 'combat_fixture',
  encounterId: 'encounter_fixture',
  objective: 'defeat',
  gimmicks: [],
  combatants: [
    { id: 'greyson', label: 'Greyson', side: 'player', maxHp: DEFAULT_COMBAT_HP },
    { id: 'enemy_1', label: 'Synthetic Foe', side: 'enemy', maxHp: 48 }
  ],
  rewards: [{ id: 'reward_fixture', kind: 'xp', amount: 10 }],
  fleeRule: 'always',
  ...overrides
});

describe('Combat core state/reducer (C01)', () => {
  it('creates deterministic encounter-local state from one definition', () => {
    const state = createCombatState(definition());

    expect(state).toEqual({
      definitionId: 'combat_fixture',
      round: 1,
      phase: 'player',
      combatants: [
        {
          id: 'greyson',
          side: 'player',
          maxHp: 100,
          hp: 100,
          techniqueCharges: DEFAULT_TECHNIQUE_CHARGES
        },
        {
          id: 'enemy_1',
          side: 'enemy',
          maxHp: 48,
          hp: 48,
          techniqueCharges: 0
        }
      ],
      statuses: [],
      techniqueReadyRound: {},
      objectiveProgress: 0
    });
  });

  it('uses an explicitly authored and labelled ambush opening without randomness', () => {
    expect(createCombatState(definition({
      openingPhase: 'enemy',
      openingReason: 'ambush'
    })).phase).toBe('enemy');

    expect(() => createCombatState(definition({ openingPhase: 'enemy' })))
      .toThrow('requires an explicitly authored ambush reason');
  });

  it('advances lifecycle deterministically and increments round only after enemy phase', () => {
    const start = createCombatState(definition());
    const enemy = reduceCombatLifecycle(start, { type: 'END_PLAYER_PHASE' });
    const nextRound = reduceCombatLifecycle(enemy, { type: 'END_ENEMY_PHASE' });

    expect(enemy).toMatchObject({ phase: 'enemy', round: 1 });
    expect(nextRound).toMatchObject({ phase: 'player', round: 2 });
  });

  it('resolves once and refuses a conflicting second outcome', () => {
    const start = createCombatState(definition());
    const resolved = reduceCombatLifecycle(start, { type: 'RESOLVE', outcome: 'pacified' });

    expect(resolved.phase).toBe('resolved');
    expect(resolved.outcome).toBe('pacified');
    expect(reduceCombatLifecycle(resolved, { type: 'RESOLVE', outcome: 'pacified' })).toBe(resolved);
    expect(() => reduceCombatLifecycle(resolved, { type: 'RESOLVE', outcome: 'victory' }))
      .toThrow('already resolved as pacified');
  });

  it('refuses impossible phase transitions instead of silently repairing them', () => {
    const start = createCombatState(definition());
    expect(() => reduceCombatLifecycle(start, { type: 'END_ENEMY_PHASE' }))
      .toThrow('requires enemy phase');

    const resolved = reduceCombatLifecycle(start, { type: 'RESOLVE', outcome: 'escaped' });
    expect(() => reduceCombatLifecycle(resolved, { type: 'END_PLAYER_PHASE' }))
      .toThrow('already resolved');
  });

  it('refuses malformed definitions and unreviewed player HP tuning', () => {
    expect(() => validateCombatDefinition(definition({
      combatants: [
        { id: 'greyson', label: 'Greyson', side: 'player', maxHp: 99 },
        { id: 'enemy_1', label: 'Synthetic Foe', side: 'enemy', maxHp: 48 }
      ]
    }))).toThrow('player maxHp must use the C00 baseline');

    expect(() => validateCombatDefinition(definition({
      combatants: [
        { id: 'greyson', label: 'Greyson', side: 'player', maxHp: 100 },
        { id: 'enemy_1', label: 'One', side: 'enemy', maxHp: 48 },
        { id: 'enemy_1', label: 'Duplicate', side: 'enemy', maxHp: 20 }
      ]
    }))).toThrow('Duplicate combatant id');

    expect(() => validateCombatDefinition(definition({
      combatants: [
        { id: 'greyson', label: 'Greyson', side: 'player', maxHp: 100, startingHp: 50 },
        { id: 'enemy_1', label: 'Synthetic Foe', side: 'enemy', maxHp: 48 }
      ]
    }))).toThrow('player startingHp must use the C00 baseline');

    expect(() => validateCombatDefinition(definition({
      combatants: [
        { id: 'greyson', label: 'Greyson', side: 'player', maxHp: 100, techniqueCharges: 9 },
        { id: 'enemy_1', label: 'Synthetic Foe', side: 'enemy', maxHp: 48 }
      ]
    }))).toThrow('player techniqueCharges must use the C00 baseline');

    expect(() => validateCombatDefinition(definition({
      rewards: [{ id: 'xp_without_amount', kind: 'xp' }]
    }))).toThrow('requires a fixed amount');

    expect(() => validateCombatDefinition(definition({
      rewards: [{ id: 'fractional_xp', kind: 'xp', amount: 1.5 }]
    }))).toThrow('amount must be a non-negative integer');
  });
});
