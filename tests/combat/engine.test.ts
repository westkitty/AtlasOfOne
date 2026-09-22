import { describe, expect, it } from 'vitest';
import type { CombatDefinition, CombatState } from '../../src/contracts/combat';
import {
  initializeCombatState,
  isCombatStatusKind,
  reduceCombatState,
  validateCombatStateAgainstDefinition
} from '../../src/combat/engine';

function definition(overrides: Partial<CombatDefinition> = {}): CombatDefinition {
  return {
    id: 'combat-engine-synthetic',
    encounterId: 'encounter-engine-synthetic',
    objective: 'defeat',
    gimmicks: [],
    combatants: [
      { id: 'player', templateId: 'player-synthetic', team: 'player', maxHp: 100 },
      { id: 'enemy', templateId: 'enemy-synthetic', team: 'enemy', maxHp: 54 }
    ],
    rewards: [{ id: 'story-synthetic', kind: 'story' }],
    fleeRule: 'always',
    ...overrides
  };
}

function stateFor(input = definition()): CombatState {
  const initialized = initializeCombatState(input);
  if (!initialized.ok) throw new Error('Synthetic definition unexpectedly failed C00 validation.');
  return initialized.state;
}

describe('C01 deterministic CombatState reducer foundation', () => {
  it('initializes one canonical state without mutating the definition or applying rewards', () => {
    const input = definition();
    const before = structuredClone(input);
    const initialized = initializeCombatState(input);
    expect(initialized.ok).toBe(true);
    if (!initialized.ok) return;
    expect(initialized.state).toEqual({
      definitionId: input.id,
      round: 1,
      phase: 'player',
      combatants: [
        { id: 'player', currentHp: 100, statuses: [] },
        { id: 'enemy', currentHp: 54, statuses: [] }
      ],
      statuses: [],
      objectiveProgress: 0
    });
    expect(initialized.state).not.toHaveProperty('rewards');
    expect(input).toEqual(before);
    expect(validateCombatStateAgainstDefinition(input, initialized.state)).toEqual({ ok: true, issues: [] });
  });

  it('fails closed on an invalid C00 definition and returns no partial state', () => {
    const initialized = initializeCombatState(definition({
      combatants: [
        { id: 'player', templateId: 'player-synthetic', team: 'player', maxHp: 99 },
        { id: 'enemy', templateId: 'enemy-synthetic', team: 'enemy', maxHp: 54 }
      ]
    }));
    expect(initialized.ok).toBe(false);
    if (initialized.ok) return;
    expect(initialized).not.toHaveProperty('state');
    expect(initialized.issues).toContainEqual(expect.objectContaining({ code: 'player-max-hp-mismatch' }));
  });

  it('validates definition identity, combatant set, HP, status vocabulary, round and outcome coherence', () => {
    const input = definition();
    const base = stateFor(input);
    const malformed: CombatState = {
      ...base,
      definitionId: 'wrong-definition',
      round: 0,
      combatants: [
        { id: 'player', currentHp: 101, statuses: ['guarded', 'guarded', 'unknown-status'] },
        { id: 'player', currentHp: 5, statuses: [] }
      ],
      statuses: ['charging', 'charging', 'unknown-global'],
      objectiveProgress: -1,
      outcome: 'victory'
    };
    const result = validateCombatStateAgainstDefinition(input, malformed);
    expect(result.ok).toBe(false);
    expect(new Set(result.issues.map((issue) => issue.code))).toEqual(new Set([
      'definition-id-mismatch', 'duplicate-state-combatant-id', 'combatant-set-mismatch', 'invalid-current-hp',
      'duplicate-status', 'invalid-status', 'invalid-round', 'invalid-objective-progress', 'unexpected-outcome'
    ]));

    const resolvedWithoutOutcome = validateCombatStateAgainstDefinition(input, { ...base, phase: 'resolved' });
    expect(resolvedWithoutOutcome.issues).toContainEqual(expect.objectContaining({ code: 'missing-outcome' }));

    const malformedEnums = validateCombatStateAgainstDefinition(input, {
      ...base, phase: 'bogus' as CombatState['phase'], outcome: 'bogus' as CombatState['outcome']
    });
    expect(malformedEnums.issues).toContainEqual(expect.objectContaining({ code: 'invalid-phase' }));
    expect(malformedEnums.issues).toContainEqual(expect.objectContaining({ code: 'invalid-outcome' }));
  });

  it('applies deterministic damage and healing with HP clamped to definition bounds', () => {
    const input = definition();
    const initial = stateFor(input);
    const damaged = reduceCombatState(input, initial, { type: 'DAMAGE', targetId: 'enemy', amount: 20 });
    expect(damaged).toMatchObject({ accepted: true });
    expect(damaged.state.combatants.find((combatant) => combatant.id === 'enemy')?.currentHp).toBe(34);
    expect(initial.combatants.find((combatant) => combatant.id === 'enemy')?.currentHp).toBe(54);

    const knockedOut = reduceCombatState(input, damaged.state, { type: 'DAMAGE', targetId: 'enemy', amount: 999 });
    expect(knockedOut.state.combatants.find((combatant) => combatant.id === 'enemy')?.currentHp).toBe(0);
    const healed = reduceCombatState(input, knockedOut.state, { type: 'HEAL', targetId: 'enemy', amount: 999 });
    expect(healed.state.combatants.find((combatant) => combatant.id === 'enemy')?.currentHp).toBe(54);
  });

  it('rejects invalid amounts and unknown targets without changing state identity', () => {
    const input = definition();
    const initial = stateFor(input);
    for (const amount of [-1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = reduceCombatState(input, initial, { type: 'DAMAGE', targetId: 'enemy', amount });
      expect(result).toEqual({ state: initial, accepted: false, issue: 'invalid-amount' });
    }
    const unknown = reduceCombatState(input, initial, { type: 'HEAL', targetId: 'missing', amount: 1 });
    expect(unknown).toEqual({ state: initial, accepted: false, issue: 'unknown-combatant' });
  });

  it('moves only player -> enemy -> next player round through explicit lifecycle actions', () => {
    const input = definition();
    const initial = stateFor(input);
    const invalidAdvance = reduceCombatState(input, initial, { type: 'ROUND_ADVANCED' });
    expect(invalidAdvance).toEqual({ state: initial, accepted: false, issue: 'invalid-phase-transition' });

    const enemyPhase = reduceCombatState(input, initial, { type: 'PLAYER_PHASE_ENDED' });
    expect(enemyPhase.state).toMatchObject({ round: 1, phase: 'enemy' });
    const duplicateEnd = reduceCombatState(input, enemyPhase.state, { type: 'PLAYER_PHASE_ENDED' });
    expect(duplicateEnd).toEqual({ state: enemyPhase.state, accepted: false, issue: 'invalid-phase-transition' });

    const nextRound = reduceCombatState(input, enemyPhase.state, { type: 'ROUND_ADVANCED' });
    expect(nextRound.state).toMatchObject({ round: 2, phase: 'player' });
  });

  it('bounds objective progress when the C00 objective has a fixed target', () => {
    const input = definition({ objective: 'pacify', gimmicks: ['enraged'] });
    const initial = stateFor(input);
    const progress = reduceCombatState(input, initial, { type: 'OBJECTIVE_PROGRESS_SET', progress: 2 });
    expect(progress.state.objectiveProgress).toBe(2);
    const completeProgress = reduceCombatState(input, progress.state, { type: 'OBJECTIVE_PROGRESS_SET', progress: 3 });
    expect(completeProgress.state.objectiveProgress).toBe(3);
    const tooFar = reduceCombatState(input, progress.state, { type: 'OBJECTIVE_PROGRESS_SET', progress: 4 });
    expect(tooFar).toEqual({ state: progress.state, accepted: false, issue: 'invalid-objective-progress' });
    const fractional = reduceCombatState(input, progress.state, { type: 'OBJECTIVE_PROGRESS_SET', progress: 2.5 });
    expect(fractional).toEqual({ state: progress.state, accepted: false, issue: 'invalid-objective-progress' });
  });

  it('resolves combat terminally without applying rewards or permitting later mutation', () => {
    const input = definition();
    const initial = stateFor(input);
    const resolved = reduceCombatState(input, initial, { type: 'COMBAT_RESOLVED', outcome: 'victory' });
    expect(resolved.state).toMatchObject({ phase: 'resolved', outcome: 'victory' });
    expect(resolved.state).not.toHaveProperty('rewards');

    const afterDamage = reduceCombatState(input, resolved.state, { type: 'DAMAGE', targetId: 'enemy', amount: 10 });
    expect(afterDamage).toEqual({ state: resolved.state, accepted: false, issue: 'combat-already-resolved' });
    const afterResolve = reduceCombatState(input, resolved.state, { type: 'COMBAT_RESOLVED', outcome: 'defeat' });
    expect(afterResolve).toEqual({ state: resolved.state, accepted: false, issue: 'combat-already-resolved' });

    const invalidOutcome = reduceCombatState(input, initial, {
      type: 'COMBAT_RESOLVED', outcome: 'bogus' as never
    });
    expect(invalidOutcome).toEqual({ state: initial, accepted: false, issue: 'invalid-outcome' });
  });

  it('rejects mismatched/invalid state and invalid definitions before applying any reducer primitive', () => {
    const input = definition();
    const initial = stateFor(input);
    const mismatched = { ...initial, definitionId: 'other' };
    expect(reduceCombatState(input, mismatched, { type: 'DAMAGE', targetId: 'enemy', amount: 1 }))
      .toEqual({ state: mismatched, accepted: false, issue: 'invalid-state' });

    const badDefinition = definition({ combatants: [{ id: 'enemy', templateId: 'enemy', team: 'enemy', maxHp: 10 }] });
    expect(reduceCombatState(badDefinition, initial, { type: 'DAMAGE', targetId: 'enemy', amount: 1 }))
      .toEqual({ state: initial, accepted: false, issue: 'invalid-definition' });
  });

  it('keeps the status type guard closed to the C00 vocabulary', () => {
    expect(isCombatStatusKind('guarded')).toBe(true);
    expect(isCombatStatusKind('pacifiable')).toBe(true);
    expect(isCombatStatusKind('poisoned')).toBe(false);
    expect(isCombatStatusKind('personality-proof')).toBe(false);
  });
});
