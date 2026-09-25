import { describe, expect, it } from 'vitest';
import {
  createCombatState,
  DEFAULT_COMBAT_HP,
  reduceCombatLifecycle,
  resolveLeave
} from '../../src/combat/engine';
import type { CombatDefinition } from '../../src/combat/types';

function definition(fleeRule: CombatDefinition['fleeRule']): CombatDefinition {
  return {
    id: 'combat_leave_fixture',
    encounterId: 'encounter_leave_fixture',
    objective: 'escape',
    gimmicks: [],
    combatants: [
      { id: 'greyson', label: 'Greyson', side: 'player', maxHp: DEFAULT_COMBAT_HP },
      { id: 'enemy_1', label: 'Synthetic Foe', side: 'enemy', maxHp: 40 }
    ],
    rewards: [{ id: 'story_only', kind: 'story-consequence', key: 'later' }],
    fleeRule
  };
}

describe('Combat LEAVE fail-forward rules (C06)', () => {
  it('allows immediate leave for an always encounter and resolves as escaped', () => {
    const def = definition('always');
    const start = createCombatState(def);
    const result = resolveLeave(def, start, { actorId: 'greyson' });

    expect(result).toMatchObject({
      actorId: 'greyson',
      fleeRule: 'always',
      outcome: 'escaped',
      failForward: true
    });
    expect(result.state.phase).toBe('resolved');
    expect(result.state.outcome).toBe('escaped');
    expect(result.state.combatants).toEqual(start.combatants);
    expect(result.state.objectiveProgress).toBe(start.objectiveProgress);
  });

  it('blocks after-turn leave until one complete round has passed', () => {
    const def = definition('after-turn');
    const round1 = createCombatState(def);

    expect(() => resolveLeave(def, round1, { actorId: 'greyson' }))
      .toThrow('until one full combat round has passed');

    const round2 = reduceCombatLifecycle(
      reduceCombatLifecycle(round1, { type: 'END_PLAYER_PHASE' }),
      { type: 'END_ENEMY_PHASE' }
    );
    expect(round2.round).toBe(2);

    const result = resolveLeave(def, round2, { actorId: 'greyson' });
    expect(result.outcome).toBe('escaped');
    expect(result.state).toMatchObject({ phase: 'resolved', outcome: 'escaped' });
  });

  it('keeps story-gated leave closed until deterministic encounter state opens it', () => {
    const def = definition('story-gated');
    const start = createCombatState(def);

    expect(() => resolveLeave(def, start, { actorId: 'greyson' }))
      .toThrow('story-gated by deterministic encounter state');

    const result = resolveLeave(
      def,
      start,
      { actorId: 'greyson' },
      { storyGateOpen: true }
    );

    expect(result).toMatchObject({
      fleeRule: 'story-gated',
      outcome: 'story',
      failForward: true
    });
    expect(result.state).toMatchObject({ phase: 'resolved', outcome: 'story' });
  });

  it('fails closed for wrong definition, phase, actor, or defeated player', () => {
    const def = definition('always');
    const start = createCombatState(def);

    expect(() => resolveLeave({ ...def, id: 'other' }, start, { actorId: 'greyson' }))
      .toThrow('definition mismatch');

    expect(() => resolveLeave(def, { ...start, phase: 'enemy' }, { actorId: 'greyson' }))
      .toThrow('requires player phase');

    expect(() => resolveLeave(def, start, { actorId: 'enemy_1' }))
      .toThrow('is not the player');

    expect(() => resolveLeave(def, {
      ...start,
      combatants: start.combatants.map((actor) =>
        actor.id === 'greyson' ? { ...actor, hp: 0 } : actor
      )
    }, { actorId: 'greyson' })).toThrow('is defeated');
  });

  it('does not grant rewards, evidence, observations, or progression itself', () => {
    const def = definition('always');
    const start = createCombatState(def);
    const result = resolveLeave(def, start, { actorId: 'greyson' });

    expect(result).not.toHaveProperty('rewards');
    expect(result).not.toHaveProperty('evidence');
    expect(result).not.toHaveProperty('observation');
    expect(result.state).not.toHaveProperty('rewards');
    expect(result.state).not.toHaveProperty('evidence');
    expect(result.state).not.toHaveProperty('xp');
  });
});
