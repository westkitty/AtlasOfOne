import { describe, expect, it } from 'vitest';
import { activateTechnique, createCombatState, reduceCombatLifecycle, resolveAct } from '../../src/combat/engine';
import { applyCombatNarration, validateCombatProposal } from '../../src/combat/firewall';
import { resolveGimmickAttack } from '../../src/combat/gimmicks';
import { resolveEnemyPhase, telegraphIntents } from '../../src/combat/intent';
import { applyObjective } from '../../src/combat/objectives';
import type {
  CombatActCommand,
  CombatAttackCommand,
  CombatState,
  CombatTechniqueCommand
} from '../../src/combat/types';
import { objectiveFixture } from './fixtures';

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}

const def = objectiveFixture('pacify', {
  techniques: [{ id: 'pry', label: 'Pry', job: 'expose-shield', chargeCost: 1, cooldownRounds: 1 }]
});
const frozenState = (): CombatState => deepFreeze(telegraphIntents(def, createCombatState(def)));

const narration = { kind: 'combat-narration', narration: 'The synthetic foe hesitates.' };

const adversarial: Array<[string, Record<string, unknown>]> = [
  ['HP', { ...narration, hp: 0 }],
  ['max HP', { ...narration, maxHp: 999 }],
  ['damage', { ...narration, damage: 999 }],
  ['raw damage', { ...narration, rawDamage: 0 }],
  ['outcome', { ...narration, outcome: 'victory' }],
  ['victory flag', { ...narration, victory: true }],
  ['pacified flag', { ...narration, pacified: true }],
  ['reward', { ...narration, reward: { kind: 'xp', amount: 500 } }],
  ['rewards', { ...narration, rewards: [] }],
  ['XP', { ...narration, xp: 500 }],
  ['objective progress', { ...narration, objectiveProgress: 3 }],
  ['ACT progress', { ...narration, actProgressById: { calm_foe: 2 } }],
  ['completed', { ...narration, completed: true }],
  ['status', { ...narration, status: 'staggered' }],
  ['statuses', { ...narration, statuses: [{ status: 'exposed', targetId: 'enemy_1' }] }],
  ['turn order', { ...narration, turnOrder: ['enemy_1', 'greyson'] }],
  ['phase', { ...narration, phase: 'resolved' }],
  ['round', { ...narration, round: 99 }],
  ['intent', { ...narration, intent: 'recover' }],
  ['telegraph override', { ...narration, telegraphedIntents: [] }],
  ['charges', { ...narration, techniqueCharges: 9 }],
  ['nested authority', { ...narration, meta: { deep: [{ hp: 1 }] } }],
  ['combatants', { ...narration, combatants: [] }],
  ['wrong kind', { kind: 'combat-outcome', narration: 'x' }],
  ['unknown field', { ...narration, mood: 'grim' }],
  ['non-string text', { kind: 'combat-narration', narration: 42 }],
  ['oversized text', { kind: 'combat-narration', narration: 'x'.repeat(601) }]
];

describe('C12 combat authority firewall: proposal validation', () => {
  it('accepts a strict narration envelope with only allowed string fields', () => {
    const verdict = validateCombatProposal({
      ...narration,
      enemyName: 'Hollow Sentry',
      actWording: 'You lower your voice.',
      telegraphWording: 'It gathers itself.',
      consequenceProse: 'The path clears.'
    });
    expect(verdict.accepted).toBe(true);
  });

  it.each(adversarial)('rejects model-authored %s', (_label, proposal) => {
    const verdict = validateCombatProposal(proposal);
    expect(verdict.accepted).toBe(false);
  });

  it.each([null, undefined, 'victory', 42, [narration], new Date()])('rejects non-object proposal %p', (value) => {
    expect(validateCombatProposal(value).accepted).toBe(false);
  });

  it('rejects prototype-pollution shaped JSON', () => {
    const polluted = JSON.parse('{"kind":"combat-narration","__proto__":{"hp":0}}');
    expect(validateCombatProposal(polluted).accepted).toBe(false);
    expect(({} as Record<string, unknown>).hp).toBeUndefined();
  });
});

describe('C12 mutation proof: proposals cannot change CombatState', () => {
  it.each([['valid narration', narration] as [string, unknown], ...adversarial])(
    '%s leaves state identical by reference and value',
    (_label, proposal) => {
      const state = frozenState();
      const snapshot = JSON.stringify(state);
      const result = applyCombatNarration(state, proposal);
      expect(result.state).toBe(state);
      expect(JSON.stringify(result.state)).toBe(snapshot);
    }
  );

  it('merging a forged proposal into a command does not change engine results', () => {
    const state = frozenState();
    const forgedAttack = { actorId: 'greyson', targetId: 'enemy_1', damage: 999, hp: 0, outcome: 'victory' } as CombatAttackCommand;
    expect(resolveGimmickAttack(def, state, forgedAttack).damage).toBe(18);

    const forgedAct = { actorId: 'greyson', actId: 'calm_foe', completed: true, progress: 2, objectiveProgress: 9 } as CombatActCommand;
    const act = resolveAct(def, state, forgedAct);
    expect(act).toMatchObject({ progress: 1, completed: false });
    expect(applyObjective(def, act.state).phase).toBe('player');

    const forgedTechnique = { actorId: 'greyson', techniqueId: 'pry', chargeCost: 0, techniqueCharges: 9 } as CombatTechniqueCommand;
    expect(activateTechnique(def, state, forgedTechnique).state.combatants[0].techniqueCharges).toBe(1);
  });

  it('enemy phase input ignores injected damage / outcome / turn order', () => {
    const state = reduceCombatLifecycle(frozenState(), { type: 'END_PLAYER_PHASE' });
    const clean = resolveEnemyPhase(def, state);
    const forged = resolveEnemyPhase(def, state, { rawDamage: 0, outcome: 'victory', turnOrder: [] } as never);
    expect(forged).toEqual(clean);
  });

  it('engine functions never mutate a deep-frozen input state', () => {
    const state = frozenState();
    const snapshot = JSON.stringify(state);
    resolveGimmickAttack(def, state, { actorId: 'greyson', targetId: 'enemy_1' });
    resolveAct(def, state, { actorId: 'greyson', actId: 'calm_foe' });
    activateTechnique(def, state, { actorId: 'greyson', techniqueId: 'pry' });
    applyObjective(def, state);
    resolveEnemyPhase(def, reduceCombatLifecycle(state, { type: 'END_PLAYER_PHASE' }));
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});
