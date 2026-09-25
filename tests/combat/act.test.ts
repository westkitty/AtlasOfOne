import { describe, expect, it } from 'vitest';
import {
  createCombatState,
  DEFAULT_COMBAT_HP,
  reduceCombatLifecycle,
  resolveAct,
  validateCombatDefinition
} from '../../src/combat/engine';
import type { CombatDefinition } from '../../src/combat/types';

const definition = (overrides: Partial<CombatDefinition> = {}): CombatDefinition => ({
  id: 'combat_act_fixture',
  encounterId: 'encounter_act_fixture',
  objective: 'pacify',
  gimmicks: ['non-kill-target'],
  combatants: [
    { id: 'greyson', label: 'Greyson', side: 'player', maxHp: DEFAULT_COMBAT_HP },
    { id: 'enemy_1', label: 'Synthetic Foe', side: 'enemy', maxHp: 50 },
    { id: 'ally_1', label: 'Synthetic Ally', side: 'ally', maxHp: 30 }
  ],
  actOptions: [
    {
      id: 'notice_pattern',
      label: 'Notice the pattern',
      job: 'reveal-information',
      targetKind: 'enemy',
      targetId: 'enemy_1',
      requiredSteps: 0,
      observationKey: 'obs_notice_pattern'
    },
    {
      id: 'lower_tension',
      label: 'Lower the tension',
      job: 'pacify-progress',
      targetKind: 'enemy',
      targetId: 'enemy_1',
      requiredSteps: 3,
      observationKey: 'obs_lower_tension'
    },
    {
      id: 'cover_ally',
      label: 'Cover the ally',
      job: 'redirect',
      targetKind: 'ally',
      targetId: 'ally_1',
      requiredSteps: 1
    },
    {
      id: 'move_crate',
      label: 'Move the crate',
      job: 'objective-progress',
      targetKind: 'object',
      targetId: 'crate_a',
      requiredSteps: 1
    },
    {
      id: 'read_room',
      label: 'Read the room',
      job: 'reveal-information',
      targetKind: 'terrain',
      targetId: 'room_state',
      requiredSteps: 0
    },
    {
      id: 'hold_objective',
      label: 'Hold the objective',
      job: 'objective-progress',
      targetKind: 'objective',
      requiredSteps: 2
    }
  ],
  rewards: [],
  fleeRule: 'always',
  ...overrides
});

describe('Combat ACT resolver (C05)', () => {
  it('initializes deterministic progress for authored ACT options', () => {
    const state = createCombatState(definition());
    expect(state.actProgressById).toEqual({
      notice_pattern: 0,
      lower_tension: 0,
      cover_ally: 0,
      move_crate: 0,
      read_room: 0,
      hold_objective: 0
    });
    expect(state.completedActIds).toEqual([]);
  });

  it('completes a zero-step reveal immediately without applying later mechanics', () => {
    const def = definition();
    const start = createCombatState(def);
    const result = resolveAct(def, start, {
      actorId: 'greyson',
      actId: 'notice_pattern'
    });

    expect(result).toMatchObject({
      actorId: 'greyson',
      actId: 'notice_pattern',
      job: 'reveal-information',
      targetKind: 'enemy',
      targetId: 'enemy_1',
      previousProgress: 0,
      progress: 0,
      requiredSteps: 0,
      completed: true,
      observationKey: 'obs_notice_pattern'
    });
    expect(result.state.completedActIds).toEqual(['notice_pattern']);
    expect(result.state.objectiveProgress).toBe(0);
    expect(result.state.statuses).toEqual([]);
    expect(result.state.outcome).toBeUndefined();
    expect(result.state.combatants).toEqual(start.combatants);
  });

  it('advances a three-step nonviolent path one deterministic step per player round', () => {
    const def = definition();
    const first = resolveAct(def, createCombatState(def), {
      actorId: 'greyson',
      actId: 'lower_tension'
    });
    const round2 = reduceCombatLifecycle(
      reduceCombatLifecycle(first.state, { type: 'END_PLAYER_PHASE' }),
      { type: 'END_ENEMY_PHASE' }
    );
    const second = resolveAct(def, round2, {
      actorId: 'greyson',
      actId: 'lower_tension'
    });
    const round3 = reduceCombatLifecycle(
      reduceCombatLifecycle(second.state, { type: 'END_PLAYER_PHASE' }),
      { type: 'END_ENEMY_PHASE' }
    );
    const third = resolveAct(def, round3, {
      actorId: 'greyson',
      actId: 'lower_tension'
    });

    expect(first).toMatchObject({ previousProgress: 0, progress: 1, completed: false });
    expect(second).toMatchObject({ previousProgress: 1, progress: 2, completed: false });
    expect(third).toMatchObject({ previousProgress: 2, progress: 3, completed: true });
    expect(third.state.round).toBe(3);
    expect(third.state.completedActIds).toEqual(['lower_tension']);
    expect(third.state.objectiveProgress).toBe(0);
    expect(third.state.outcome).toBeUndefined();
  });

  it('refuses replay after a path completes instead of making ACT farmable', () => {
    const def = definition();
    const completed = resolveAct(def, createCombatState(def), {
      actorId: 'greyson',
      actId: 'cover_ally'
    });

    expect(completed.completed).toBe(true);
    expect(() => resolveAct(def, completed.state, {
      actorId: 'greyson',
      actId: 'cover_ally'
    })).toThrow('ACT cover_ally is already complete');
  });

  it('supports enemy, ally, object, terrain and objective targets without hidden inference', () => {
    const def = definition();
    const start = createCombatState(def);

    for (const actId of [
      'notice_pattern',
      'cover_ally',
      'move_crate',
      'read_room',
      'hold_objective'
    ]) {
      expect(() => resolveAct(def, start, { actorId: 'greyson', actId })).not.toThrow();
    }
  });

  it('validates 0-3 step tuning and scenario-owned target references', () => {
    expect(() => validateCombatDefinition(definition({
      actOptions: [{
        id: 'too_long',
        label: 'Too long',
        job: 'pacify-progress',
        targetKind: 'enemy',
        targetId: 'enemy_1',
        requiredSteps: 4 as 3
      }]
    }))).toThrow('requiredSteps must be an integer from 0 to 3');

    expect(() => validateCombatDefinition(definition({
      actOptions: [{
        id: 'wrong_enemy',
        label: 'Wrong enemy',
        job: 'interrupt',
        targetKind: 'enemy',
        targetId: 'ally_1',
        requiredSteps: 1
      }]
    }))).toThrow('is not an authored enemy');

    expect(() => validateCombatDefinition(definition({
      actOptions: [{
        id: 'missing_object',
        label: 'Missing object',
        job: 'objective-progress',
        targetKind: 'object',
        requiredSteps: 1
      }]
    }))).toThrow('needs a stable object targetId');

    expect(() => validateCombatDefinition(definition({
      actOptions: [{
        id: 'objective_with_fake_target',
        label: 'Objective',
        job: 'objective-progress',
        targetKind: 'objective',
        targetId: 'invented',
        requiredSteps: 1
      }]
    }))).toThrow('objective target must not invent a targetId');
  });

  it('fails closed for invalid phase, actor, definition or ACT id', () => {
    const def = definition();
    const state = createCombatState(def);

    expect(() => resolveAct(def, { ...state, phase: 'enemy' }, {
      actorId: 'greyson',
      actId: 'notice_pattern'
    })).toThrow('requires player phase');

    expect(() => resolveAct(def, state, {
      actorId: 'enemy_1',
      actId: 'notice_pattern'
    })).toThrow('is not the player');

    expect(() => resolveAct(def, state, {
      actorId: 'greyson',
      actId: 'missing'
    })).toThrow('Unknown ACT id');

    expect(() => resolveAct({ ...def, id: 'other_definition' }, state, {
      actorId: 'greyson',
      actId: 'notice_pattern'
    })).toThrow('definition mismatch');
  });

  it('returns an observation key as inert authored data, never Evidence', () => {
    const def = definition();
    const start = createCombatState(def);
    const result = resolveAct(def, start, {
      actorId: 'greyson',
      actId: 'lower_tension'
    });

    expect(result.observationKey).toBe('obs_lower_tension');
    expect(result).not.toHaveProperty('evidence');
    expect(result).not.toHaveProperty('personality');
    expect(result.state).not.toHaveProperty('evidence');
  });
});
