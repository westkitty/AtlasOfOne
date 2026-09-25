import { describe, expect, it } from 'vitest';
import { activateTechnique, createCombatState, reduceCombatLifecycle, resolveAct } from '../../src/combat/engine';
import { applyActEffect, applyTechniqueEffect, resolveGimmickAttack } from '../../src/combat/gimmicks';
import {
  CHARGED_RELEASE_DAMAGE,
  ENEMY_ATTACK_DAMAGE,
  OBJECTIVE_ACTION_DAMAGE,
  resolveEnemyPhase,
  telegraphIntents
} from '../../src/combat/intent';
import { applyObjective } from '../../src/combat/objectives';
import { applyStatus, declareGuard } from '../../src/combat/statuses';
import type { CombatDefinition, CombatState } from '../../src/combat/types';
import { objectiveFixture } from './fixtures';

const hp = (state: CombatState, id: string) => state.combatants.find((c) => c.id === id)!.hp;
const endPlayer = (state: CombatState) => reduceCombatLifecycle(state, { type: 'END_PLAYER_PHASE' });

describe('C09 deterministic intent / telegraph', () => {
  it('telegraphs before resolution and is idempotent', () => {
    const def = objectiveFixture('defeat');
    const once = telegraphIntents(def, createCombatState(def));
    expect(once.telegraphedIntents).toEqual([
      { round: 1, enemyId: 'enemy_1', intent: 'attack', targetId: 'greyson', rawDamage: ENEMY_ATTACK_DAMAGE, telegraphKey: 'attack' }
    ]);
    expect(telegraphIntents(def, once)).toEqual(once);
  });

  it('is a pure function of state: identical inputs always give identical telegraphs', () => {
    const def = objectiveFixture('interrupt');
    const runs = Array.from({ length: 5 }, () => telegraphIntents(def, createCombatState(def)).telegraphedIntents);
    for (const run of runs) expect(run).toEqual(runs[0]);
  });

  it('refuses to resolve an enemy phase that was never telegraphed', () => {
    const def = objectiveFixture('defeat');
    expect(() => resolveEnemyPhase(def, endPlayer(createCombatState(def)))).toThrow(/telegraphed/);
  });

  it('refuses a stale telegraph from a previous round', () => {
    const def = objectiveFixture('defeat');
    const stale = telegraphIntents(def, createCombatState(def));
    const round2 = { ...endPlayer(stale), round: 2 };
    expect(() => resolveEnemyPhase(def, round2)).toThrow(/telegraphed/);
  });

  it('rejects forged out-of-envelope telegraph damage', () => {
    const def = objectiveFixture('defeat');
    const state = telegraphIntents(def, createCombatState(def));
    const forged = endPlayer({
      ...state,
      telegraphedIntents: [{ ...state.telegraphedIntents![0], rawDamage: 999 }]
    });
    expect(() => resolveEnemyPhase(def, forged)).toThrow(/Invalid telegraphed intent/);
  });

  it('resolves exactly the telegraphed attack and re-telegraphs the next round', () => {
    const def = objectiveFixture('defeat');
    const result = resolveEnemyPhase(def, endPlayer(telegraphIntents(def, createCombatState(def))));
    expect(result.actions).toEqual([
      expect.objectContaining({ intent: 'attack', resolvedAs: 'damage', damage: ENEMY_ATTACK_DAMAGE })
    ]);
    expect(hp(result.state, 'greyson')).toBe(100 - ENEMY_ATTACK_DAMAGE);
    expect(result.state).toMatchObject({ round: 2, phase: 'player' });
    expect(result.state.telegraphedIntents![0].round).toBe(2);
  });

  it('GUARD uses the C03 formula (50% / timed 75%, ceil)', () => {
    const def = objectiveFixture('defeat');
    const guarded = endPlayer(declareGuard(telegraphIntents(def, createCombatState(def)), 'greyson'));
    expect(hp(resolveEnemyPhase(def, guarded).state, 'greyson')).toBe(94);
    expect(hp(resolveEnemyPhase(def, guarded, { guardTimedSuccess: true }).state, 'greyson')).toBe(97);
  });

  it('charging: charge-up telegraph, then charged release, unless interrupted', () => {
    const def = objectiveFixture('interrupt', { objective: 'defeat', techniques: [] });
    let state = telegraphIntents(def, createCombatState(def));
    expect(state.telegraphedIntents![0]).toMatchObject({ intent: 'charge', rawDamage: 0 });
    state = resolveEnemyPhase(def, endPlayer(state)).state;
    expect(state.telegraphedIntents![0]).toMatchObject({
      intent: 'attack', rawDamage: CHARGED_RELEASE_DAMAGE, telegraphKey: 'charged-release'
    });
    const released = resolveEnemyPhase(def, endPlayer(state));
    expect(hp(released.state, 'greyson')).toBe(100 - CHARGED_RELEASE_DAMAGE);
  });

  it('an interrupted charged release deals no damage and staggers into recover', () => {
    const def = objectiveFixture('interrupt', { objective: 'defeat' });
    let state = resolveEnemyPhase(def, endPlayer(telegraphIntents(def, createCombatState(def)))).state;
    const activation = activateTechnique(def, state, { actorId: 'greyson', techniqueId: 'break_focus' });
    state = applyTechniqueEffect(def, activation, 'enemy_1').state;
    const result = resolveEnemyPhase(def, endPlayer(state));
    expect(result.actions[0]).toMatchObject({ telegraphKey: 'charged-release', resolvedAs: 'interrupted', damage: 0 });
    expect(hp(result.state, 'greyson')).toBe(100);
  });

  it('protect: objective-action targets the ally; protected-target prevents it', () => {
    const def = objectiveFixture('protect');
    const state = telegraphIntents(def, createCombatState(def));
    expect(state.telegraphedIntents![0]).toMatchObject({ intent: 'objective-action', targetId: 'ally_1', rawDamage: OBJECTIVE_ACTION_DAMAGE });
    expect(hp(resolveEnemyPhase(def, endPlayer(state)).state, 'ally_1')).toBe(30 - OBJECTIVE_ACTION_DAMAGE);
    const covered = endPlayer(applyStatus(state, 'protected-target', 'ally_1'));
    const result = resolveEnemyPhase(def, covered);
    expect(result.actions[0].resolvedAs).toBe('prevented');
    expect(hp(result.state, 'ally_1')).toBe(30);
  });

  it('swarm telegraph damage follows living members', () => {
    const def = objectiveFixture('defeat', { gimmicks: ['swarm'] });
    let state = telegraphIntents(def, createCombatState(def));
    expect(state.telegraphedIntents![0].rawDamage).toBe(18);
    state = telegraphIntents(def, resolveGimmickAttack(def, state, { actorId: 'greyson', targetId: 'enemy_1' }).state);
    expect(state.telegraphedIntents![0].rawDamage).toBe(14);
  });

  it('cannot replay an enemy phase (phase already advanced)', () => {
    const def = objectiveFixture('defeat');
    const entered = endPlayer(telegraphIntents(def, createCombatState(def)));
    const after = resolveEnemyPhase(def, entered).state;
    expect(() => resolveEnemyPhase(def, after)).toThrow(/enemy phase/);
  });
});

/** Full-loop anti-grind sims with real enemy pressure: every MVP objective in 2-5 player turns. */
describe('C07/C09 full-loop objective sims', () => {
  type Turn = (def: CombatDefinition, state: CombatState, turn: number) => CombatState;

  function run(def: CombatDefinition, playerTurn: Turn) {
    let state = telegraphIntents(def, createCombatState(def));
    let turns = 0;
    while (state.phase !== 'resolved' && turns < 20) {
      turns += 1;
      state = applyObjective(def, playerTurn(def, state, turns));
      if (state.phase === 'resolved') break;
      state = resolveEnemyPhase(def, endPlayer(state)).state;
    }
    return { state, turns };
  }

  const attackTurn: Turn = (def, state) =>
    resolveGimmickAttack(def, state, { actorId: 'greyson', targetId: 'enemy_1' }).state;

  it('defeat: 3 turns', () => {
    const { state, turns } = run(objectiveFixture('defeat'), attackTurn);
    expect({ turns, outcome: state.outcome, playerHp: hp(state, 'greyson') }).toEqual({ turns: 3, outcome: 'victory', playerHp: 76 });
  });

  it('defeat vs shielded counterattacker: expose then attack in 5 turns', () => {
    const def = objectiveFixture('defeat', {
      gimmicks: ['shielded', 'counterattacking'],
      combatants: [
        objectiveFixture('defeat').combatants[0],
        { id: 'enemy_1', label: 'Synthetic Bulwark', side: 'enemy', maxHp: 40 }
      ],
      techniques: [{ id: 'pry', label: 'Pry', job: 'expose-shield', chargeCost: 1, cooldownRounds: 0 }]
    });
    const { state, turns } = run(def, (d, s, turn) =>
      turn === 1
        ? applyTechniqueEffect(d, activateTechnique(d, s, { actorId: 'greyson', techniqueId: 'pry' }), 'enemy_1').state
        : attackTurn(d, s, turn)
    );
    expect(turns).toBe(5);
    expect(state.outcome).toBe('victory');
  });

  it('survive: 3 GUARD turns, enemy HP untouched', () => {
    const def = objectiveFixture('survive');
    const { state, turns } = run(def, (_d, s) => declareGuard(s, 'greyson'));
    expect({ turns, outcome: state.outcome, enemyHp: hp(state, 'enemy_1'), playerHp: hp(state, 'greyson') })
      .toEqual({ turns: 3, outcome: 'victory', enemyHp: 54, playerHp: 82 });
  });

  it('protect: one Cover keeps the ally alive for 3 rounds; without it the ally falls (fail-forward)', () => {
    const def = objectiveFixture('protect');
    const covered = run(def, (d, s, turn) =>
      turn === 1
        ? applyTechniqueEffect(d, activateTechnique(d, s, { actorId: 'greyson', techniqueId: 'cover' }), 'ally_1').state
        : declareGuard(s, 'greyson')
    );
    expect({ turns: covered.turns, outcome: covered.state.outcome, allyHp: hp(covered.state, 'ally_1'), enemyHp: hp(covered.state, 'enemy_1') })
      .toEqual({ turns: 3, outcome: 'victory', allyHp: 2, enemyHp: 54 });
    const uncovered = run(def, (_d, s) => declareGuard(s, 'greyson'));
    expect(uncovered.state.outcome).toBe('defeat');
    expect(uncovered.turns).toBe(3);
  });

  it('interrupt: completes on turn 2 without a kill', () => {
    const def = objectiveFixture('interrupt');
    const { state, turns } = run(def, (d, s, turn) =>
      turn === 2
        ? applyTechniqueEffect(d, activateTechnique(d, s, { actorId: 'greyson', techniqueId: 'break_focus' }), 'enemy_1').state
        : declareGuard(s, 'greyson')
    );
    expect({ turns, outcome: state.outcome, enemyHp: hp(state, 'enemy_1') }).toEqual({ turns: 2, outcome: 'victory', enemyHp: 54 });
  });

  it('pacify: 2 ACT turns, enemy HP untouched', () => {
    const def = objectiveFixture('pacify');
    const { state, turns } = run(def, (d, s) =>
      applyActEffect(d, resolveAct(d, s, { actorId: 'greyson', actId: 'calm_foe' })).state
    );
    expect({ turns, outcome: state.outcome, enemyHp: hp(state, 'enemy_1') }).toEqual({ turns: 2, outcome: 'pacified', enemyHp: 54 });
  });
});
