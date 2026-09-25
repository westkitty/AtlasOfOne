import { describe, expect, it } from 'vitest';
import { activateTechnique, createCombatState, resolveAct } from '../../src/combat/engine';
import {
  applyActEffect,
  applyTechniqueEffect,
  COUNTER_DAMAGE,
  MVP_COMBAT_GIMMICKS,
  resolveGimmickAttack,
  swarmDamage,
  swarmMembersAlive,
  validateGimmicks
} from '../../src/combat/gimmicks';
import { applyStatus, hasStatus } from '../../src/combat/statuses';
import type { CombatAttackCommand, CombatDefinition, CombatGimmick } from '../../src/combat/types';
import { objectiveFixture } from './fixtures';

const withGimmicks = (gimmicks: CombatGimmick[], extra: Partial<CombatDefinition> = {}) =>
  objectiveFixture('defeat', { gimmicks, ...extra });

const attack: CombatAttackCommand = { actorId: 'greyson', targetId: 'enemy_1' };
const hpOf = (def: CombatDefinition, id: string, state = createCombatState(def)) =>
  state.combatants.find((c) => c.id === id)!.hp;

describe('C08 gimmick matrix', () => {
  it('implements exactly five MVP gimmicks and refuses others', () => {
    expect([...MVP_COMBAT_GIMMICKS]).toEqual(['shielded', 'charging', 'counterattacking', 'swarm', 'non-kill-target']);
    expect(() => validateGimmicks(withGimmicks(['enraged']))).toThrow(/not implemented/);
    expect(() => validateGimmicks(withGimmicks(['shielded', 'shielded']))).toThrow(/Duplicate/);
  });

  it.each([
    [[] as CombatGimmick[], 18, 0],
    [['shielded'] as CombatGimmick[], 9, 0],
    [['counterattacking'] as CombatGimmick[], 18, COUNTER_DAMAGE],
    [['swarm'] as CombatGimmick[], 18, 0],
    [['charging'] as CombatGimmick[], 18, 0]
  ])('ATTACK with gimmicks %j deals %i and counters for %i', (gimmicks, damage, counter) => {
    const def = withGimmicks(gimmicks);
    const result = resolveGimmickAttack(def, createCombatState(def), attack);
    expect(result.damage).toBe(damage);
    expect(result.counterDamage).toBe(counter);
    expect(hpOf(def, 'enemy_1', result.state)).toBe(54 - damage);
    expect(hpOf(def, 'greyson', result.state)).toBe(100 - counter);
  });

  it('shielded uses ceil(half) of the timed total and is bypassed by exposed', () => {
    const def = withGimmicks(['shielded']);
    const start = createCombatState(def);
    expect(resolveGimmickAttack(def, start, { ...attack, timedSuccess: true }).damage).toBe(12);
    const exposed = applyStatus(start, 'exposed', 'enemy_1');
    const result = resolveGimmickAttack(def, exposed, attack);
    expect(result).toMatchObject({ damage: 18, shieldApplied: false });
  });

  it('counterattacking is suppressed by staggered or exposed targets', () => {
    const def = withGimmicks(['counterattacking']);
    const start = createCombatState(def);
    expect(resolveGimmickAttack(def, applyStatus(start, 'staggered', 'enemy_1'), attack).counterDamage).toBe(0);
    expect(resolveGimmickAttack(def, applyStatus(start, 'exposed', 'enemy_1'), attack).counterDamage).toBe(0);
  });

  it('non-kill-target clamps enemy HP at 1 so ATTACK cannot kill it', () => {
    const def = withGimmicks(['non-kill-target'], {
      combatants: [
        objectiveFixture('defeat').combatants[0],
        { id: 'enemy_1', label: 'Synthetic Foe', side: 'enemy', maxHp: 20 }
      ]
    });
    const result = resolveGimmickAttack(def, createCombatState(def), attack);
    const again = resolveGimmickAttack(def, result.state, attack);
    expect(result.nonKillClamped).toBe(false);
    expect(again).toMatchObject({ nonKillClamped: true, targetDefeated: false });
    expect(hpOf(def, 'enemy_1', again.state)).toBe(1);
  });

  it('swarm damage scales down deterministically with living members', () => {
    expect([54, 37, 36, 18, 1, 0].map((hp) => swarmMembersAlive(hp, 54))).toEqual([3, 3, 2, 1, 1, 0]);
    expect(swarmDamage(54, 54)).toBe(18);
    expect(swarmDamage(36, 54)).toBe(14);
    expect(swarmDamage(18, 54)).toBe(10);
    expect(swarmDamage(0, 54)).toBe(0);
  });

  it('charging is interrupted by the interrupt-charge Technique, staggering and recording progress', () => {
    const def = objectiveFixture('interrupt');
    const charging = applyStatus(createCombatState(def), 'charging', 'enemy_1');
    const activation = activateTechnique(def, charging, { actorId: 'greyson', techniqueId: 'break_focus' });
    const result = applyTechniqueEffect(def, activation, 'enemy_1');
    expect(result.effect).toBe('interrupted');
    expect(hasStatus(result.state, 'charging', 'enemy_1')).toBe(false);
    expect(hasStatus(result.state, 'staggered', 'enemy_1')).toBe(true);
    expect(result.state.objectiveProgress).toBe(1);
  });

  it('interrupting a non-charging enemy has no effect (charge is still spent)', () => {
    const def = objectiveFixture('interrupt');
    const activation = activateTechnique(def, createCombatState(def), { actorId: 'greyson', techniqueId: 'break_focus' });
    const result = applyTechniqueEffect(def, activation, 'enemy_1');
    expect(result.effect).toBe('none');
    expect(result.state.objectiveProgress).toBe(0);
    expect(result.state.combatants[0].techniqueCharges).toBe(1);
  });

  it('interrupt ACT also interrupts a charging enemy', () => {
    const def = objectiveFixture('interrupt', {
      techniques: [],
      actOptions: [{ id: 'shout', label: 'Shout', job: 'interrupt', targetKind: 'enemy', targetId: 'enemy_1', requiredSteps: 1 }]
    });
    const charging = applyStatus(createCombatState(def), 'charging', 'enemy_1');
    const result = applyActEffect(def, resolveAct(def, charging, { actorId: 'greyson', actId: 'shout' }));
    expect(result.effect).toBe('interrupted');
    expect(result.state.objectiveProgress).toBe(1);
  });

  it('pacify ACT on a non-kill target marks it pacifiable without touching HP', () => {
    const def = objectiveFixture('pacify');
    const result = applyActEffect(def, resolveAct(def, createCombatState(def), { actorId: 'greyson', actId: 'calm_foe' }));
    expect(result.effect).toBe('pacifiable');
    expect(hasStatus(result.state, 'pacifiable', 'enemy_1')).toBe(true);
    expect(hpOf(def, 'enemy_1', result.state)).toBe(54);
  });

  it('expose-shield and protect-ally Techniques apply their statuses to valid targets only', () => {
    const def = withGimmicks(['shielded'], {
      combatants: objectiveFixture('protect').combatants,
      techniques: [
        { id: 'pry', label: 'Pry', job: 'expose-shield', chargeCost: 1, cooldownRounds: 0 },
        { id: 'cover', label: 'Cover', job: 'protect-ally', chargeCost: 1, cooldownRounds: 0 }
      ]
    });
    const start = createCombatState(def);
    const pry = activateTechnique(def, start, { actorId: 'greyson', techniqueId: 'pry' });
    expect(hasStatus(applyTechniqueEffect(def, pry, 'enemy_1').state, 'exposed', 'enemy_1')).toBe(true);
    expect(() => applyTechniqueEffect(def, pry, 'ally_1')).toThrow(/not an enemy/);
    const cover = activateTechnique(def, start, { actorId: 'greyson', techniqueId: 'cover' });
    expect(hasStatus(applyTechniqueEffect(def, cover, 'ally_1').state, 'protected-target', 'ally_1')).toBe(true);
    expect(() => applyTechniqueEffect(def, cover, 'enemy_1')).toThrow(/not an ally/);
  });

  it('ignores extra authority-shaped fields on the ATTACK command', () => {
    const def = withGimmicks([]);
    const forged = { ...attack, damage: 999, hp: 0, outcome: 'victory' } as CombatAttackCommand;
    const result = resolveGimmickAttack(def, createCombatState(def), forged);
    expect(result.damage).toBe(18);
    expect(result.state.outcome).toBeUndefined();
  });

  it('does not mutate frozen input state', () => {
    const def = withGimmicks(['counterattacking', 'shielded']);
    const start = Object.freeze(createCombatState(def));
    const snapshot = JSON.stringify(start);
    resolveGimmickAttack(def, start, attack);
    expect(JSON.stringify(start)).toBe(snapshot);
  });
});
