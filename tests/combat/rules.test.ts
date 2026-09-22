import { describe, expect, it } from 'vitest';
import type { CombatDefinition } from '../../src/contracts/combat';
import { COMBAT_COMMAND_KINDS } from '../../src/contracts/combat';
import { FORBIDDEN_PROVIDER_PROPOSAL_FIELDS } from '../../src/contracts/provider';
import {
  COMBAT_INITIATIVE_POLICY,
  COMBAT_INTENT_KINDS,
  COMBAT_MVP_OBJECTIVES,
  COMBAT_OBJECTIVE_RULES,
  COMBAT_RULES_VERSION,
  COMBAT_STATUS_KINDS,
  COMBAT_TIMING_GRADES,
  COMBAT_TUNING,
  resolveAttackDamage,
  resolveGuardedDamage,
  validateCombatDefinitionContract
} from '../../src/combat/rules';

function definition(overrides: Partial<CombatDefinition> = {}): CombatDefinition {
  return {
    id: 'combat-synthetic',
    encounterId: 'encounter-synthetic',
    objective: 'defeat',
    gimmicks: [],
    combatants: [
      { id: 'player', templateId: 'player-synthetic', team: 'player', maxHp: 100 },
      { id: 'enemy', templateId: 'enemy-synthetic', team: 'enemy', maxHp: 54 }
    ],
    rewards: [{ id: 'story-progress', kind: 'story' }],
    fleeRule: 'always',
    ...overrides
  };
}

describe('C00 deterministic combat contract', () => {
  it('freezes the Appendix-I numeric baseline and keeps HP encounter-local by contract', () => {
    expect(COMBAT_RULES_VERSION).toBe(1);
    expect(COMBAT_TUNING).toEqual({
      playerStartingHp: 100,
      attackBaseDamage: 18,
      attackTimedBonus: 6,
      guardReduction: 0.5,
      timedGuardReduction: 0.75,
      techniqueChargesAtStart: 2,
      statusDurationRounds: { min: 1, max: 2 },
      enemyEffectiveHp: {
        ordinary: { min: 35, max: 70 }, elite: { min: 80, max: 130 }, bossPhase: { min: 110, max: 180 }
      },
      ordinaryEnemyActionDamage: { min: 10, max: 22 },
      ordinaryEnemyCount: { min: 1, max: 3 },
      turnTargets: {
        ordinary: { min: 2, max: 5 }, elite: { min: 4, max: 7 }, bossPhase: { min: 5, max: 9 }, survival: { min: 3, max: 5 }
      },
      actProgressRequired: 3
    });
  });

  it('keeps the permanent command wall and deterministic vocabularies small and exact', () => {
    expect(COMBAT_COMMAND_KINDS).toEqual(['ATTACK', 'TECHNIQUE', 'GUARD', 'ACT', 'LEAVE']);
    expect(COMBAT_TIMING_GRADES).toEqual(['base', 'timed']);
    expect(COMBAT_STATUS_KINDS).toEqual(['guarded', 'exposed', 'charging', 'staggered', 'pacifiable', 'protected-target']);
    expect(COMBAT_INTENT_KINDS).toEqual(['attack', 'defend', 'charge', 'recover', 'hazard', 'objective-action', 'special-act-reactive']);
    expect(COMBAT_INITIATIVE_POLICY).toEqual({ defaultFirstPhase: 'player', ambushMayOverride: true, ambushRequiresStoryTelegraph: true });
  });

  it('freezes integer ATTACK and GUARD formulas without making timed input mandatory', () => {
    expect(resolveAttackDamage('base')).toBe(18);
    expect(resolveAttackDamage('timed')).toBe(24);
    expect(resolveGuardedDamage(20, 'base')).toBe(10);
    expect(resolveGuardedDamage(20, 'timed')).toBe(5);
    expect(resolveGuardedDamage(11, 'base')).toBe(6);
    expect(resolveGuardedDamage(11, 'timed')).toBe(3);
    expect(() => resolveGuardedDamage(-1, 'base')).toThrow(RangeError);
    expect(() => resolveGuardedDamage(3.5, 'timed')).toThrow(RangeError);
  });

  it('selects the five objective contracts required by the planned MVP fixtures', () => {
    expect(COMBAT_MVP_OBJECTIVES).toEqual(['defeat', 'survive-turns', 'protect-target', 'interrupt-charged-action', 'pacify']);
    expect(COMBAT_OBJECTIVE_RULES['survive-turns']).toMatchObject({ resolution: 'turn-limit', mvp: true, requiresTurnLimit: true });
    expect(COMBAT_OBJECTIVE_RULES['protect-target']).toMatchObject({ resolution: 'protect-ally', mvp: true, requiresAlly: true });
    expect(COMBAT_OBJECTIVE_RULES['interrupt-charged-action']).toMatchObject({ resolution: 'interrupt-charge', mvp: true, requiredGimmick: 'charging' });
    expect(COMBAT_OBJECTIVE_RULES.pacify).toMatchObject({ resolution: 'act-progress', mvp: true, progressTarget: 3 });
    expect(COMBAT_OBJECTIVE_RULES.escape).toMatchObject({ resolution: 'leave', mvp: false });
  });

  it('accepts a minimal valid definition and never mutates it while validating', () => {
    const input = definition();
    const before = structuredClone(input);
    expect(validateCombatDefinitionContract(input)).toEqual({ ok: true, issues: [] });
    expect(input).toEqual(before);
  });

  it('fails closed on malformed identity, combatants, rewards and numeric fields', () => {
    const result = validateCombatDefinitionContract(definition({
      id: ' ', encounterId: '', gimmicks: ['shielded', 'shielded'], turnLimit: 0,
      combatants: [
        { id: 'same', templateId: '', team: 'player', maxHp: 0 },
        { id: 'same', templateId: 'enemy', team: 'player', maxHp: 4.5 }
      ],
      rewards: [{ id: 'dup', kind: 'xp', amount: -1 }, { id: 'dup', kind: 'story' }]
    }));
    expect(result.ok).toBe(false);
    expect(new Set(result.issues.map((issue) => issue.code))).toEqual(new Set([
      'blank-id', 'duplicate-gimmick', 'multiple-players', 'missing-enemy', 'invalid-max-hp',
      'duplicate-combatant-id', 'invalid-turn-limit', 'invalid-reward-amount', 'duplicate-reward-id'
    ]));
  });

  it('enforces objective prerequisites instead of guessing hidden targets or state', () => {
    const survive = validateCombatDefinitionContract(definition({ objective: 'survive-turns' }));
    expect(survive.issues).toContainEqual(expect.objectContaining({ code: 'missing-turn-limit' }));
    expect(validateCombatDefinitionContract(definition({ objective: 'survive-turns', turnLimit: 4 })).ok).toBe(true);

    const protect = validateCombatDefinitionContract(definition({ objective: 'protect-target' }));
    expect(protect.issues).toContainEqual(expect.objectContaining({ code: 'missing-ally' }));
    expect(validateCombatDefinitionContract(definition({
      objective: 'protect-target',
      combatants: [...definition().combatants, { id: 'ally', templateId: 'ally-synthetic', team: 'ally', maxHp: 30 }]
    })).ok).toBe(true);

    const interrupt = validateCombatDefinitionContract(definition({ objective: 'interrupt-charged-action' }));
    expect(interrupt.issues).toContainEqual(expect.objectContaining({ code: 'missing-required-gimmick' }));
    expect(validateCombatDefinitionContract(definition({ objective: 'interrupt-charged-action', gimmicks: ['charging'] })).ok).toBe(true);
    expect(validateCombatDefinitionContract(definition({ objective: 'pacify', gimmicks: ['enraged'] })).ok).toBe(true);
  });

  it('keeps provider proposal authority outside every deterministic mechanics field', () => {
    expect(FORBIDDEN_PROVIDER_PROPOSAL_FIELDS).toEqual(expect.arrayContaining(['combatState', 'hp', 'reward', 'outcome']));
  });
});
