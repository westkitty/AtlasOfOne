import { describe, expect, it } from 'vitest';
import {
  applyAttack,
  createCombatState,
  reduceCombatLifecycle,
  resolveAct
} from '../../src/combat/engine';
import {
  applyObjective,
  evaluateObjective,
  MVP_COMBAT_OBJECTIVES,
  validateObjectiveDefinition
} from '../../src/combat/objectives';
import type { CombatState } from '../../src/combat/types';
import { objectiveFixture } from './fixtures';

const setHp = (state: CombatState, id: string, hp: number): CombatState => ({
  ...state,
  combatants: state.combatants.map((c) => (c.id === id ? { ...c, hp } : c))
});

const passRound = (state: CombatState): CombatState =>
  reduceCombatLifecycle(reduceCombatLifecycle(state, { type: 'END_PLAYER_PHASE' }), {
    type: 'END_ENEMY_PHASE'
  });

describe('C07 objective matrix', () => {
  it('implements exactly the five MVP objectives', () => {
    expect([...MVP_COMBAT_OBJECTIVES]).toEqual(['defeat', 'survive', 'protect', 'interrupt', 'pacify']);
  });

  it.each(MVP_COMBAT_OBJECTIVES)('%s starts incomplete with zero progress', (objective) => {
    const def = objectiveFixture(objective);
    const evaluation = evaluateObjective(def, createCombatState(def));
    expect(evaluation).toMatchObject({ objective, progress: 0, complete: false, failed: false });
    expect(evaluation.outcome).toBeUndefined();
    expect(evaluation.required).toBeGreaterThan(0);
  });

  it.each(MVP_COMBAT_OBJECTIVES)('%s fails forward to defeat when the player reaches 0 HP', (objective) => {
    const def = objectiveFixture(objective);
    const evaluation = evaluateObjective(def, setHp(createCombatState(def), 'greyson', 0));
    expect(evaluation).toMatchObject({ failed: true, complete: false, outcome: 'defeat' });
  });

  it.each(MVP_COMBAT_OBJECTIVES)('%s ends as victory if every enemy is defeated', (objective) => {
    const def = objectiveFixture(objective);
    const evaluation = evaluateObjective(def, setHp(createCombatState(def), 'enemy_1', 0));
    expect(evaluation.outcome).toBe('victory');
    expect(evaluation.failed).toBe(false);
  });

  it('refuses non-MVP objectives and objective-invalid definitions', () => {
    expect(() => validateObjectiveDefinition(objectiveFixture('escort'))).toThrow(/not implemented/);
    expect(() => validateObjectiveDefinition(objectiveFixture('survive', { turnLimit: undefined }))).toThrow(/turnLimit/);
    expect(() =>
      validateObjectiveDefinition(
        objectiveFixture('protect', { combatants: objectiveFixture('defeat').combatants })
      )
    ).toThrow(/exactly one ally/);
    expect(() => validateObjectiveDefinition(objectiveFixture('interrupt', { gimmicks: [] }))).toThrow(/charging/);
    expect(() => validateObjectiveDefinition(objectiveFixture('interrupt', { techniques: [] }))).toThrow(/interrupt Technique or ACT/);
    expect(() => validateObjectiveDefinition(objectiveFixture('pacify', { actOptions: [] }))).toThrow(/pacify ACT/);
  });

  it('refuses a state from another definition', () => {
    const def = objectiveFixture('defeat');
    const other = createCombatState(objectiveFixture('survive'));
    expect(() => evaluateObjective(def, other)).toThrow(/mismatch/);
  });

  it('protect fails forward when the ally reaches 0 HP', () => {
    const def = objectiveFixture('protect');
    const evaluation = evaluateObjective(def, setHp(createCombatState(def), 'ally_1', 0));
    expect(evaluation).toMatchObject({ failed: true, outcome: 'defeat' });
  });

  it('applyObjective is idempotent and a no-op once resolved', () => {
    const def = objectiveFixture('defeat');
    const resolved = applyObjective(def, setHp(createCombatState(def), 'enemy_1', 0));
    expect(resolved.outcome).toBe('victory');
    expect(applyObjective(def, resolved)).toBe(resolved);
    const open = createCombatState(def);
    expect(applyObjective(def, applyObjective(def, open))).toEqual(applyObjective(def, open));
  });
});

describe('C07 deterministic objective sims (2-5 player turns)', () => {
  it('defeat: 54 HP enemy falls in 3 base ATTACKs', () => {
    const def = objectiveFixture('defeat');
    let state = createCombatState(def);
    let turns = 0;
    while (state.phase !== 'resolved') {
      turns += 1;
      state = applyAttack(state, { actorId: 'greyson', targetId: 'enemy_1' }).state;
      state = applyObjective(def, state);
      if (state.phase !== 'resolved') state = passRound(state);
    }
    expect(turns).toBe(3);
    expect(state.outcome).toBe('victory');
    expect(state.objectiveProgress).toBe(1);
  });

  it('survive: completes after 3 held rounds without reducing enemy HP', () => {
    const def = objectiveFixture('survive');
    let state = createCombatState(def);
    const progress: number[] = [];
    let turns = 0;
    while (state.phase !== 'resolved') {
      turns += 1;
      state = applyObjective(def, passRound(state));
      progress.push(state.objectiveProgress);
    }
    expect(turns).toBe(3);
    expect(progress).toEqual([1, 2, 3]);
    expect(state.outcome).toBe('victory');
    expect(state.combatants.find((c) => c.id === 'enemy_1')!.hp).toBe(54);
  });

  it('protect: completes after 3 rounds with the ally standing and enemy HP untouched', () => {
    const def = objectiveFixture('protect');
    let state = createCombatState(def);
    let turns = 0;
    while (state.phase !== 'resolved') {
      turns += 1;
      state = applyObjective(def, passRound(state));
    }
    expect(turns).toBe(3);
    expect(state.outcome).toBe('victory');
    expect(state.combatants.find((c) => c.id === 'enemy_1')!.hp).toBe(54);
  });

  it('interrupt: one recorded interrupt completes the objective without a kill', () => {
    const def = objectiveFixture('interrupt');
    let state = passRound(createCombatState(def));
    state = applyObjective(def, { ...state, objectiveProgress: 1 });
    expect(state.outcome).toBe('victory');
    expect(state.combatants.find((c) => c.id === 'enemy_1')!.hp).toBe(54);
  });

  it('pacify: two ACT steps pacify without reducing enemy HP', () => {
    const def = objectiveFixture('pacify');
    let state = createCombatState(def);
    let turns = 0;
    while (state.phase !== 'resolved') {
      turns += 1;
      state = resolveAct(def, state, { actorId: 'greyson', actId: 'calm_foe' }).state;
      state = applyObjective(def, state);
      if (state.phase !== 'resolved') state = passRound(state);
    }
    expect(turns).toBe(2);
    expect(state.outcome).toBe('pacified');
    expect(state.objectiveProgress).toBe(2);
    expect(state.combatants.find((c) => c.id === 'enemy_1')!.hp).toBe(54);
  });
});

describe('C07 objective/gimmick compatibility (integration repair)', () => {
  it('rejects defeat combined with non-kill-target as unwinnable', async () => {
    const { validateObjectiveDefinition } = await import('../../src/combat/objectives');
    const definition = { ...objectiveFixture('defeat'), gimmicks: ['non-kill-target'] } as never;
    expect(() => validateObjectiveDefinition(definition)).toThrow('cannot be combined with the non-kill-target');
  });
});
