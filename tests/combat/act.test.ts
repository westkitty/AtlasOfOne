import { describe, expect, it } from 'vitest';
import type { CombatDefinition, CombatState } from '../../src/contracts/combat';
import { initializeCombatState, reduceCombatState } from '../../src/combat/engine';
import {
  createActLedger,
  resolveAct,
  validateActScenario,
  type ActLedger,
  type ActOptionDefinition,
  type ActScenario
} from '../../src/combat/act';

function definition(overrides: Partial<CombatDefinition> = {}): CombatDefinition {
  return {
    id: 'combat-act-synthetic', encounterId: 'encounter-act-synthetic', objective: 'pacify', gimmicks: ['morale-fear'],
    combatants: [
      { id: 'player', templateId: 'player-synthetic', team: 'player', maxHp: 100 },
      { id: 'enemy', templateId: 'enemy-synthetic', team: 'enemy', maxHp: 48 },
      { id: 'ally', templateId: 'ally-synthetic', team: 'ally', maxHp: 30 }
    ],
    rewards: [{ id: 'story-synthetic', kind: 'story' }], fleeRule: 'always', ...overrides
  };
}

function stateFor(input = definition()): CombatState {
  const initialized = initializeCombatState(input);
  if (!initialized.ok) throw new Error('Synthetic ACT definition unexpectedly failed.');
  return initialized.state;
}

const listen: ActOptionDefinition = { id: 'listen', label: 'Listen', targetTeam: 'enemy', effect: 'reveal', repeatable: false, observationKey: 'synthetic-listened' };
const calm: ActOptionDefinition = { id: 'calm', label: 'Calm', targetTeam: 'enemy', effect: 'act-progress', repeatable: true, requiresUsed: ['listen'] };
const pacifyScenario: ActScenario = { options: [listen, calm] };

function act(state: CombatState, ledger: ActLedger, optionId: string, targetId?: string, input = definition(), scenario = pacifyScenario) {
  return resolveAct(input, state, ledger, scenario, optionId, targetId);
}

describe('C05 scenario-owned ACT resolver', () => {
  it('accepts a well-formed pacify scenario', () => {
    expect(validateActScenario(definition(), pacifyScenario)).toEqual({ ok: true, issues: [] });
  });

  it('advances pacify progress one deterministic step per ACT and never resolves combat itself', () => {
    let state = stateFor();
    let ledger = createActLedger();
    const revealed = act(state, ledger, 'listen', 'enemy');
    expect(revealed.accepted).toBe(true);
    expect(revealed.state).toBe(state);
    expect(revealed.observation).toEqual({ kind: 'act', optionId: 'listen', effect: 'reveal', targetId: 'enemy', observationKey: 'synthetic-listened' });
    ledger = revealed.ledger;

    for (const expected of [1, 2, 3]) {
      const step = act(state, ledger, 'calm', 'enemy');
      expect(step.accepted).toBe(true);
      expect(step.state.objectiveProgress).toBe(expected);
      expect(step.state.phase).toBe('player');
      expect(step.state.outcome).toBeUndefined();
      state = step.state;
      ledger = step.ledger;
    }

    const beyond = act(state, ledger, 'calm', 'enemy');
    expect(beyond).toMatchObject({ accepted: false, issue: 'progress-complete' });
    expect(beyond.state).toBe(state);
  });

  it('is deterministic for identical input and leaves source state/ledger untouched', () => {
    const state = stateFor();
    const ledger: ActLedger = { usedOptionIds: ['listen'] };
    const before = structuredClone({ state, ledger });
    const first = act(state, ledger, 'calm', 'enemy');
    const second = act(state, ledger, 'calm', 'enemy');
    expect(first).toEqual(second);
    expect({ state, ledger }).toEqual(before);
  });

  it('enforces discovery prerequisites and single-use options', () => {
    const state = stateFor();
    expect(act(state, createActLedger(), 'calm', 'enemy')).toMatchObject({ accepted: false, issue: 'missing-prerequisite' });
    const used: ActLedger = { usedOptionIds: ['listen'] };
    expect(act(state, used, 'listen', 'enemy')).toMatchObject({ accepted: false, issue: 'already-used' });
  });

  it('rejects options the scenario does not own, including provider-shaped forgeries', () => {
    const state = stateFor();
    const forged = act(state, createActLedger(), 'instant-pacify', 'enemy');
    expect(forged).toMatchObject({ accepted: false, issue: 'unknown-act' });
    expect(forged.state).toBe(state);
  });

  it('fails closed on phase, defeated player, and target rules', () => {
    const input = definition();
    const state = stateFor(input);
    const enemyPhase = reduceCombatState(input, state, { type: 'PLAYER_PHASE_ENDED' }).state;
    expect(act(enemyPhase, createActLedger(), 'listen', 'enemy')).toMatchObject({ accepted: false, issue: 'invalid-phase' });

    const downed = reduceCombatState(input, state, { type: 'DAMAGE', targetId: 'player', amount: 100 }).state;
    expect(act(downed, createActLedger(), 'listen', 'enemy')).toMatchObject({ accepted: false, issue: 'player-defeated' });

    expect(act(state, createActLedger(), 'listen')).toMatchObject({ accepted: false, issue: 'target-required' });
    expect(act(state, createActLedger(), 'listen', 'ghost')).toMatchObject({ accepted: false, issue: 'unknown-target' });
    expect(act(state, createActLedger(), 'listen', 'ally')).toMatchObject({ accepted: false, issue: 'wrong-target-team' });
    const deadEnemy = reduceCombatState(input, state, { type: 'DAMAGE', targetId: 'enemy', amount: 48 }).state;
    expect(act(deadEnemy, createActLedger(), 'listen', 'enemy')).toMatchObject({ accepted: false, issue: 'target-defeated' });

    const untargeted: ActScenario = { options: [{ id: 'look', label: 'Look around', targetTeam: 'none', effect: 'reveal', repeatable: true }, calm, listen] };
    expect(act(state, createActLedger(), 'look', 'enemy', input, untargeted)).toMatchObject({ accepted: false, issue: 'unexpected-target' });
    expect(act(state, createActLedger(), 'look', undefined, input, untargeted)).toMatchObject({ accepted: true });
  });

  it('checks gimmick and status predicates against typed mechanics state only', () => {
    const input = definition({ gimmicks: [] });
    const state = stateFor(input);
    const scenario: ActScenario = { options: [
      { id: 'soothe', label: 'Soothe', targetTeam: 'enemy', effect: 'act-progress', repeatable: true, requiredGimmicks: ['morale-fear'], requiredTargetStatuses: ['pacifiable'] }
    ] };
    expect(resolveAct(input, state, createActLedger(), scenario, 'soothe', 'enemy')).toMatchObject({ accepted: false, issue: 'missing-required-status' });
    const pacifiable: CombatState = { ...state, combatants: state.combatants.map((c) => c.id === 'enemy' ? { ...c, statuses: ['pacifiable'] } : c) };
    expect(resolveAct(input, pacifiable, createActLedger(), scenario, 'soothe', 'enemy')).toMatchObject({ accepted: false, issue: 'missing-required-gimmick' });
    const withGimmick = definition();
    expect(resolveAct(withGimmick, pacifiable, createActLedger(), scenario, 'soothe', 'enemy')).toMatchObject({ accepted: true });
  });

  it('rejects scenarios that would trap the player or smuggle mechanics', () => {
    const input = definition();
    const codes = (scenario: ActScenario, def = input) => validateActScenario(def, scenario).issues.map((issue) => issue.code);

    expect(codes({ options: [{ ...calm, repeatable: false, requiresUsed: [] }] })).toContain('unreachable-progress-target');
    expect(codes({ options: [{ ...listen, requiresUsed: ['calm'] }, { ...calm, requiresUsed: ['listen'] }] })).toContain('prerequisite-cycle');
    expect(codes({ options: [{ ...listen, requiresUsed: ['listen'] }, calm] })).toContain('self-prerequisite');
    expect(codes({ options: [{ ...listen, requiresUsed: ['nope'] }, calm] })).toContain('unknown-prerequisite');
    expect(codes({ options: [listen, { ...listen }, calm] })).toContain('duplicate-id');
    expect(codes({ options: [{ ...listen, id: ' ' }, calm] })).toContain('blank-id');
    expect(codes({ options: [{ ...listen, label: '' }, calm] })).toContain('blank-label');
    expect(codes({ options: [{ ...listen, effect: 'win' as never }, calm] })).toContain('invalid-effect');
    expect(codes({ options: [{ ...listen, targetTeam: 'self' as never }, calm] })).toContain('invalid-target-team');
    expect(codes({ options: [{ ...listen, repeatable: 'yes' as never }, calm] })).toContain('invalid-repeatable');
    expect(codes({ options: [{ ...listen, requiredTargetStatuses: ['burning' as never] }, calm] })).toContain('invalid-status');
    expect(codes({ options: [{ ...listen, requiredTargetStatuses: ['exposed'], forbiddenTargetStatuses: ['exposed'] }, calm] })).toContain('contradictory-status-rule');
    expect(codes({ options: [{ id: 'look', label: 'Look', targetTeam: 'none', effect: 'reveal', repeatable: true, requiredTargetStatuses: ['exposed'] }, calm, listen] })).toContain('status-rule-without-target');
    expect(codes({ options: [calm, listen] }, definition({ objective: 'defeat' }))).toContain('progress-effect-without-progress-objective');

    const invalid: ActScenario = { options: [{ ...calm, repeatable: false, requiresUsed: [] }] };
    expect(resolveAct(input, stateFor(input), createActLedger(), invalid, 'calm', 'enemy')).toMatchObject({ accepted: false, issue: 'invalid-scenario' });
  });

  it('rejects a malformed ledger rather than trusting it', () => {
    const state = stateFor();
    expect(act(state, { usedOptionIds: ['listen', 'listen'] }, 'calm', 'enemy')).toMatchObject({ accepted: false, issue: 'invalid-ledger' });
    expect(act(state, { usedOptionIds: ['forged'] }, 'calm', 'enemy')).toMatchObject({ accepted: false, issue: 'invalid-ledger' });
  });

  it('reveal ACTs work in any objective and never touch HP, statuses, rewards or phase', () => {
    const input = definition({ objective: 'defeat' });
    const state = stateFor(input);
    const result = resolveAct(input, state, createActLedger(), { options: [listen] }, 'listen', 'enemy');
    expect(result.accepted).toBe(true);
    expect(result.state).toBe(state);
    expect(Object.keys(result).sort()).toEqual(['accepted', 'ledger', 'observation', 'optionId', 'state', 'targetId']);
  });
});
