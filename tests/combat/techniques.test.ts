import { describe, expect, it } from 'vitest';
import type { CombatDefinition, CombatState } from '../../src/contracts/combat';
import { initializeCombatState, reduceCombatState } from '../../src/combat/engine';
import {
  MVP_TECHNIQUES,
  checkTechniqueAvailability,
  createTechniqueLedger,
  useTechnique,
  validateTechniqueLedger,
  validateTechniqueRegistry,
  type TechniqueDefinition,
  type TechniqueLedger
} from '../../src/combat/techniques';

function definition(overrides: Partial<CombatDefinition> = {}): CombatDefinition {
  return {
    id: 'combat-technique-synthetic', encounterId: 'encounter-technique-synthetic', objective: 'defeat', gimmicks: [],
    combatants: [
      { id: 'player', templateId: 'player-synthetic', team: 'player', maxHp: 100 },
      { id: 'enemy', templateId: 'enemy-synthetic', team: 'enemy', maxHp: 54 },
      { id: 'ally', templateId: 'ally-synthetic', team: 'ally', maxHp: 30 }
    ],
    rewards: [{ id: 'story-synthetic', kind: 'story' }], fleeRule: 'always', ...overrides
  };
}

function stateFor(input = definition()): CombatState {
  const initialized = initializeCombatState(input);
  if (!initialized.ok) throw new Error('Synthetic Technique definition unexpectedly failed.');
  return initialized.state;
}

function advanceRound(input: CombatDefinition, state: CombatState): CombatState {
  const enemy = reduceCombatState(input, state, { type: 'PLAYER_PHASE_ENDED' });
  if (!enemy.accepted) throw new Error('Synthetic player phase handoff failed.');
  const next = reduceCombatState(input, enemy.state, { type: 'ROUND_ADVANCED' });
  if (!next.accepted) throw new Error('Synthetic round advance failed.');
  return next.state;
}

describe('C04 deterministic TECHNIQUE registry/resource contract', () => {
  it('freezes a three-Technique tactical registry with one-cost, one-skipped-round cooldown entries', () => {
    expect(MVP_TECHNIQUES).toEqual([
      { id: 'interrupt-charge', label: 'Interrupt', cost: 1, cooldownRounds: 1, context: { targetTeam: 'enemy', requiredGimmicks: ['charging'] }, effect: 'interrupt-charge' },
      { id: 'cover-ally', label: 'Cover', cost: 1, cooldownRounds: 1, context: { targetTeam: 'ally' }, effect: 'protect-ally' },
      { id: 'expose-shield', label: 'Expose', cost: 1, cooldownRounds: 1, context: { targetTeam: 'enemy', requiredGimmicks: ['shielded'] }, effect: 'expose-target' }
    ]);
    expect(validateTechniqueRegistry(MVP_TECHNIQUES)).toEqual({ ok: true, issues: [] });
  });

  it('initializes exactly two encounter-local charges and no cooldown history', () => {
    expect(createTechniqueLedger()).toEqual({ chargesRemaining: 2, cooldowns: [] });
    expect(validateTechniqueLedger(createTechniqueLedger())).toEqual({ ok: true, issues: [] });
  });

  it('requires contextual gimmicks and emits an inert interrupt descriptor without mutating CombatState', () => {
    const noCharge = definition();
    const noChargeState = stateFor(noCharge);
    expect(checkTechniqueAvailability(noCharge, noChargeState, createTechniqueLedger(), 'interrupt-charge', 'enemy'))
      .toMatchObject({ available: false, issue: 'missing-required-gimmick' });

    const input = definition({ gimmicks: ['charging'] });
    const state = stateFor(input);
    const stateBefore = structuredClone(state);
    const ledger = createTechniqueLedger();
    const result = useTechnique(input, state, ledger, 'interrupt-charge', 'enemy');
    expect(result).toMatchObject({
      available: true,
      effect: { kind: 'interrupt-charge', targetId: 'enemy' },
      nextReadyRound: 3,
      ledger: { chargesRemaining: 1, cooldowns: [{ techniqueId: 'interrupt-charge', nextReadyRound: 3 }] }
    });
    expect(result.state).toBe(state);
    expect(state).toEqual(stateBefore);
    expect(ledger).toEqual({ chargesRemaining: 2, cooldowns: [] });
  });

  it('defines cooldown as skipped future player rounds and permits reuse only when the ready round arrives', () => {
    const input = definition({ gimmicks: ['charging'] });
    const round1 = stateFor(input);
    const first = useTechnique(input, round1, createTechniqueLedger(), 'interrupt-charge', 'enemy');
    expect(first.available).toBe(true);

    const round2 = advanceRound(input, round1);
    expect(round2.round).toBe(2);
    expect(checkTechniqueAvailability(input, round2, first.ledger, 'interrupt-charge', 'enemy'))
      .toMatchObject({ available: false, issue: 'cooldown-active', nextReadyRound: 3 });

    const round3 = advanceRound(input, round2);
    expect(round3.round).toBe(3);
    const second = useTechnique(input, round3, first.ledger, 'interrupt-charge', 'enemy');
    expect(second).toMatchObject({ available: true, ledger: { chargesRemaining: 0 }, nextReadyRound: 5 });
  });

  it('supports ally protection and shield exposure only against the correct living target/context', () => {
    const input = definition({ gimmicks: ['shielded'] });
    const state = stateFor(input);
    const ledger = createTechniqueLedger();

    expect(useTechnique(input, state, ledger, 'cover-ally', 'ally')).toMatchObject({
      available: true, effect: { kind: 'protect-ally', targetId: 'ally' }
    });
    expect(checkTechniqueAvailability(input, state, ledger, 'cover-ally', 'enemy'))
      .toMatchObject({ available: false, issue: 'wrong-target-team' });
    expect(useTechnique(input, state, ledger, 'expose-shield', 'enemy')).toMatchObject({
      available: true, effect: { kind: 'expose-target', targetId: 'enemy' }
    });

    const deadEnemy = reduceCombatState(input, state, { type: 'DAMAGE', targetId: 'enemy', amount: 999 });
    expect(deadEnemy.accepted).toBe(true);
    expect(checkTechniqueAvailability(input, deadEnemy.state, ledger, 'expose-shield', 'enemy'))
      .toMatchObject({ available: false, issue: 'target-defeated' });
  });

  it('supports finite typed target-status predicates without prose evaluation', () => {
    const contextual: TechniqueDefinition = {
      id: 'status-window', label: 'Window', cost: 1, cooldownRounds: 0,
      context: { targetTeam: 'enemy', requiredTargetStatuses: ['exposed'], forbiddenTargetStatuses: ['staggered'] },
      effect: 'interrupt-charge'
    };
    const registry = [contextual];
    const input = definition();
    const state = stateFor(input);
    const ledger = createTechniqueLedger();

    expect(checkTechniqueAvailability(input, state, ledger, contextual.id, 'enemy', registry))
      .toMatchObject({ available: false, issue: 'missing-required-status' });

    const exposed = {
      ...state,
      combatants: state.combatants.map((combatant) => combatant.id === 'enemy'
        ? { ...combatant, statuses: ['exposed'] }
        : combatant)
    };
    expect(checkTechniqueAvailability(input, exposed, ledger, contextual.id, 'enemy', registry)).toMatchObject({ available: true });

    const forbidden = {
      ...exposed,
      combatants: exposed.combatants.map((combatant) => combatant.id === 'enemy'
        ? { ...combatant, statuses: ['exposed', 'staggered'] }
        : combatant)
    };
    expect(checkTechniqueAvailability(input, forbidden, ledger, contextual.id, 'enemy', registry))
      .toMatchObject({ available: false, issue: 'forbidden-target-status' });
  });

  it('fails closed for unknown Technique, insufficient charges, wrong phase and defeated player', () => {
    const input = definition();
    const state = stateFor(input);
    const empty: TechniqueLedger = { chargesRemaining: 0, cooldowns: [] };
    expect(checkTechniqueAvailability(input, state, empty, 'cover-ally', 'ally'))
      .toMatchObject({ available: false, issue: 'insufficient-charges' });
    expect(checkTechniqueAvailability(input, state, createTechniqueLedger(), 'missing', 'enemy'))
      .toMatchObject({ available: false, issue: 'unknown-technique' });

    const enemyPhase = reduceCombatState(input, state, { type: 'PLAYER_PHASE_ENDED' });
    expect(checkTechniqueAvailability(input, enemyPhase.state, createTechniqueLedger(), 'cover-ally', 'ally'))
      .toMatchObject({ available: false, issue: 'invalid-phase' });

    const playerDown = reduceCombatState(input, state, { type: 'DAMAGE', targetId: 'player', amount: 999 });
    expect(checkTechniqueAvailability(input, playerDown.state, createTechniqueLedger(), 'cover-ally', 'ally'))
      .toMatchObject({ available: false, issue: 'player-defeated' });
  });

  it('rejects malformed registries rather than normalizing invented mechanics', () => {
    const invalid = [
      { id: '', label: '', cost: 0, cooldownRounds: -1, context: { targetTeam: 'bogus' as never, requiredGimmicks: ['charging', 'charging'] as const, requiredTargetStatuses: ['exposed', 'exposed'] as const, forbiddenTargetStatuses: ['exposed', 'bogus' as never] as const }, effect: 'bogus-effect' as never },
      { id: '', label: 'Duplicate', cost: 3, cooldownRounds: 0, context: { targetTeam: 'enemy' as const }, effect: 'expose-target' as const }
    ];
    const validation = validateTechniqueRegistry(invalid);
    expect(validation.ok).toBe(false);
    expect(new Set(validation.issues.map((issue) => issue.code))).toEqual(new Set([
      'blank-id', 'blank-label', 'duplicate-id', 'invalid-cost', 'invalid-cooldown', 'invalid-target-team', 'invalid-effect', 'duplicate-gimmick',
      'duplicate-required-status', 'invalid-status', 'contradictory-status-rule'
    ]));

    const input = definition();
    const state = stateFor(input);
    expect(checkTechniqueAvailability(input, state, createTechniqueLedger(), '', 'enemy', invalid))
      .toMatchObject({ available: false, issue: 'invalid-registry' });
  });

  it('rejects malformed ledgers without spending or repairing them', () => {
    const input = definition();
    const state = stateFor(input);
    const malformed: TechniqueLedger = {
      chargesRemaining: 3,
      cooldowns: [
        { techniqueId: 'cover-ally', nextReadyRound: 0 },
        { techniqueId: 'cover-ally', nextReadyRound: 2 },
        { techniqueId: 'unknown-technique', nextReadyRound: 2 }
      ]
    };
    const validation = validateTechniqueLedger(malformed);
    expect(validation.ok).toBe(false);
    expect(new Set(validation.issues.map((issue) => issue.code))).toEqual(new Set([
      'invalid-charges', 'duplicate-cooldown', 'invalid-ready-round', 'unknown-cooldown-technique'
    ]));
    expect(useTechnique(input, state, malformed, 'cover-ally', 'ally')).toEqual({
      available: false, techniqueId: 'cover-ally', targetId: 'ally', issue: 'invalid-ledger', state, ledger: malformed
    });
  });

  it('fails closed through C00/C01 validation and remains deterministic/pure', () => {
    const input = definition({ gimmicks: ['charging'] });
    const state = stateFor(input);
    const ledger = createTechniqueLedger();
    const badDefinition = definition({ combatants: [{ id: 'enemy', templateId: 'enemy', team: 'enemy', maxHp: 10 }] });
    expect(checkTechniqueAvailability(badDefinition, state, ledger, 'interrupt-charge', 'enemy'))
      .toMatchObject({ available: false, issue: 'invalid-definition' });
    const badState = { ...state, definitionId: 'wrong' };
    expect(checkTechniqueAvailability(input, badState, ledger, 'interrupt-charge', 'enemy'))
      .toMatchObject({ available: false, issue: 'invalid-state' });

    const stateBefore = structuredClone(state);
    const ledgerBefore = structuredClone(ledger);
    const first = useTechnique(input, state, ledger, 'interrupt-charge', 'enemy');
    const second = useTechnique(input, state, ledger, 'interrupt-charge', 'enemy');
    expect(second).toEqual(first);
    expect(state).toEqual(stateBefore);
    expect(ledger).toEqual(ledgerBefore);
  });
});
