import { describe, expect, it } from 'vitest';
import type { CombatCommand, CombatDefinition } from '../../src/contracts/combat';
import type { ActScenario } from '../../src/combat/act';
import { COMBAT_ENEMY_TUNING, shieldedAttackDamage } from '../../src/combat/gimmicks';
import { enemyIntent } from '../../src/combat/intent';
import { evaluateObjective } from '../../src/combat/objectives';
import {
  COMBAT_LOG_LIMIT,
  applyCombatCommand,
  createCombatSession,
  sessionIntents,
  validateCombatSession,
  type CombatSession,
  type CommandOptions
} from '../../src/combat/session';

const PLAYER = { id: 'player', templateId: 'player-synthetic', team: 'player' as const, maxHp: 100 };

function def(overrides: Partial<CombatDefinition> = {}): CombatDefinition {
  return {
    id: 'combat-session-synthetic', encounterId: 'encounter-session-synthetic', objective: 'defeat', gimmicks: [],
    combatants: [PLAYER, { id: 'enemy', templateId: 'enemy-synthetic', team: 'enemy', maxHp: 54 }],
    rewards: [{ id: 'story-synthetic', kind: 'story' }], fleeRule: 'always', ...overrides
  };
}

function start(definition: CombatDefinition, scenario?: ActScenario): CombatSession {
  const created = createCombatSession(definition, scenario);
  if (!created.ok) throw new Error(`Synthetic session failed: ${created.issue}`);
  return created.session;
}

function run(session: CombatSession, command: CombatCommand, options?: CommandOptions): CombatSession {
  const result = applyCombatCommand(session, command, options);
  if (!result.accepted) throw new Error(`Command refused: ${result.issue} ${result.detail ?? ''}`);
  return result.session;
}

const hp = (session: CombatSession, id: string) => session.state.combatants.find((c) => c.id === id)!.currentHp;
const statuses = (session: CombatSession, id: string) => session.state.combatants.find((c) => c.id === id)!.statuses;

const pacifyScenario: ActScenario = { options: [
  { id: 'listen', label: 'Listen', targetTeam: 'enemy', effect: 'reveal', repeatable: false, observationKey: 'synthetic-listened' },
  { id: 'calm', label: 'Calm', targetTeam: 'enemy', effect: 'act-progress', repeatable: true, requiresUsed: ['listen'] }
] };

describe('C07-C10 combat session: objectives, gimmicks, intent, resolution order', () => {
  it('defeat: ordinary fight resolves in the 2-5 player-turn target with base timing only', () => {
    let session = start(def());
    let turns = 0;
    while (session.state.phase !== 'resolved') { session = run(session, { kind: 'ATTACK', targetId: 'enemy' }); turns += 1; }
    expect(session.state.outcome).toBe('victory');
    expect(turns).toBeGreaterThanOrEqual(2);
    expect(turns).toBeLessThanOrEqual(5);
    expect(hp(session, 'player')).toBe(100 - 2 * COMBAT_ENEMY_TUNING.attackDamage);
  });

  it('follows the fixed order: player action, enemy action, round advance', () => {
    const session = run(start(def()), { kind: 'ATTACK', targetId: 'enemy' });
    expect(session.log.map((entry) => entry.kind)).toEqual(['attack', 'enemy']);
    expect(session.state).toMatchObject({ round: 2, phase: 'player' });
    expect(hp(session, 'enemy')).toBe(54 - 18);
    expect(hp(session, 'player')).toBe(100 - 12);
    expect(session.turn).toBe(1);
  });

  it('survive-turns: explicit limit wins after the last round with the player standing', () => {
    let session = start(def({ objective: 'survive-turns', turnLimit: 3, gimmicks: ['swarm'],
      combatants: [PLAYER, { id: 'a', templateId: 'swarm-a', team: 'enemy', maxHp: 40 }, { id: 'b', templateId: 'swarm-b', team: 'enemy', maxHp: 40 }] }));
    for (let round = 1; round <= 3; round += 1) {
      expect(session.state.phase).toBe('player');
      session = run(session, { kind: 'GUARD' });
    }
    expect(session.state.outcome).toBe('victory');
    // Swarm hits for 10; guard halves exactly one hit per round.
    expect(hp(session, 'player')).toBe(100 - 3 * (5 + 10));
  });

  it('protect-target: enemies telegraph the ally; Cover negates the hit; ally loss is a fail-forward defeat', () => {
    const definition = def({ objective: 'protect-target', turnLimit: 3,
      combatants: [PLAYER, { id: 'enemy', templateId: 'e', team: 'enemy', maxHp: 70 }, { id: 'ally', templateId: 'npc', team: 'ally', maxHp: 20 }] });
    let session = start(definition);
    expect(sessionIntents(session)).toEqual([{ enemyId: 'enemy', kind: 'objective-action', targetId: 'ally', damage: 12 }]);
    session = run(session, { kind: 'TECHNIQUE', techniqueId: 'cover-ally', targetId: 'ally' });
    expect(hp(session, 'ally')).toBe(20);
    expect(statuses(session, 'ally')).toEqual([]);
    session = run(session, { kind: 'ATTACK', targetId: 'enemy' });
    expect(hp(session, 'ally')).toBe(8);
    session = run(session, { kind: 'ATTACK', targetId: 'enemy' });
    expect(session.state.outcome).toBe('defeat');
    expect(session.failForward).toEqual({ kind: 'retreat-to-sanctuary', retryAvailable: true });
  });

  it('interrupt: charge is telegraphed, Interrupt staggers it and wins; an ignored charge releases heavy', () => {
    const definition = def({ objective: 'interrupt-charged-action', gimmicks: ['charging'],
      combatants: [PLAYER, { id: 'enemy', templateId: 'engine', team: 'enemy', maxHp: 110 }] });
    let session = start(definition);
    expect(sessionIntents(session)[0]).toMatchObject({ kind: 'charge', damage: 0 });
    session = run(session, { kind: 'ATTACK', targetId: 'enemy' });
    expect(statuses(session, 'enemy')).toContain('charging');
    expect(sessionIntents(session)[0]).toMatchObject({ kind: 'attack', damage: 22, release: true });

    const ignored = run(session, { kind: 'ATTACK', targetId: 'enemy' });
    expect(hp(ignored, 'player')).toBe(100 - 22);
    expect(statuses(ignored, 'enemy')).not.toContain('charging');

    const interrupted = run(session, { kind: 'TECHNIQUE', techniqueId: 'interrupt-charge', targetId: 'enemy' });
    expect(interrupted.state.outcome).toBe('victory');
    expect(hp(interrupted, 'player')).toBe(100);
  });

  it('interrupting before a charge exists staggers but does not satisfy the interrupt objective', () => {
    const definition = def({ objective: 'interrupt-charged-action', gimmicks: ['charging'],
      combatants: [PLAYER, { id: 'enemy', templateId: 'engine', team: 'enemy', maxHp: 110 }] });
    const early = run(start(definition), { kind: 'TECHNIQUE', techniqueId: 'interrupt-charge', targetId: 'enemy' });
    expect(early.state.phase).toBe('player');
    expect(early.state.objectiveProgress).toBe(0);
    expect(early.log.at(-1)).toMatchObject({ kind: 'enemy', intent: 'recover', damage: 0 });
  });

  it('an unused GUARD expires at round end instead of lingering forever', () => {
    const definition = def({ gimmicks: ['charging'], combatants: [PLAYER, { id: 'enemy', templateId: 'engine', team: 'enemy', maxHp: 110 }] });
    const guarded = run(start(definition), { kind: 'GUARD' });
    expect(hp(guarded, 'player')).toBe(100);
    expect(statuses(guarded, 'player')).toEqual([]);
    expect(guarded.pendingGuard).toBeUndefined();
    expect(applyCombatCommand(guarded, { kind: 'GUARD' }).accepted).toBe(true);
  });

  it('pacify: ACT progress calms the enemy, intent softens near the end, outcome is pacified without HP loss to the enemy', () => {
    const definition = def({ objective: 'pacify', gimmicks: ['morale-fear'] });
    let session = start(definition, pacifyScenario);
    expect(statuses(session, 'enemy')).toEqual(['pacifiable']);
    session = run(session, { kind: 'ACT', actId: 'listen', targetId: 'enemy' });
    session = run(session, { kind: 'ACT', actId: 'calm', targetId: 'enemy' });
    session = run(session, { kind: 'ACT', actId: 'calm', targetId: 'enemy' });
    expect(sessionIntents(session)[0]).toMatchObject({ kind: 'defend', damage: 0 });
    session = run(session, { kind: 'ACT', actId: 'calm', targetId: 'enemy' });
    expect(session.state.outcome).toBe('pacified');
    expect(hp(session, 'enemy')).toBe(54);
    expect(session.log.filter((entry) => entry.kind === 'act')).toContainEqual({ kind: 'act', optionId: 'listen', observationKey: 'synthetic-listened' });
  });

  it('shielded halves ATTACK until Expose; exposed is consumed by the next hit', () => {
    const definition = def({ gimmicks: ['shielded'], combatants: [PLAYER, { id: 'enemy', templateId: 'e', team: 'enemy', maxHp: 70 }] });
    let session = run(start(definition), { kind: 'ATTACK', targetId: 'enemy' });
    expect(hp(session, 'enemy')).toBe(70 - 9);
    session = run(session, { kind: 'TECHNIQUE', techniqueId: 'expose-shield', targetId: 'enemy' });
    expect(statuses(session, 'enemy')).toContain('exposed');
    session = run(session, { kind: 'ATTACK', targetId: 'enemy' });
    expect(hp(session, 'enemy')).toBe(70 - 9 - 18);
    expect(statuses(session, 'enemy')).not.toContain('exposed');
    expect(shieldedAttackDamage(definition, [], 24)).toBe(12);
  });

  it('counterattacking strikes back only when the enemy survives and is not staggered', () => {
    const definition = def({ gimmicks: ['counterattacking'] });
    const session = run(start(definition), { kind: 'ATTACK', targetId: 'enemy' });
    expect(session.log.map((entry) => entry.kind)).toEqual(['attack', 'counter', 'enemy']);
    expect(hp(session, 'player')).toBe(100 - 6 - 12);
  });

  it('player defeat routes through C06 fail-forward instead of a game over', () => {
    const definition = def({ combatants: [PLAYER, { id: 'enemy', templateId: 'wall', team: 'enemy', maxHp: 1000 }] });
    const created = createCombatSession(definition);
    expect(created.ok).toBe(true);
    let session = (created as { ok: true; session: CombatSession }).session;
    session = { ...session, state: { ...session.state, combatants: session.state.combatants.map((c) => c.id === 'player' ? { ...c, currentHp: 5 } : c) } };
    session = run(session, { kind: 'ATTACK', targetId: 'enemy' });
    expect(session.state).toMatchObject({ phase: 'resolved', outcome: 'defeat' });
    expect(session.failForward).toEqual({ kind: 'retreat-to-sanctuary', retryAvailable: true });
  });

  it('LEAVE resolves immediately with no enemy action and no reward', () => {
    const session = run(start(def()), { kind: 'LEAVE' });
    expect(session.state.outcome).toBe('escaped');
    expect(session.log).toEqual([{ kind: 'resolved', outcome: 'escaped' }]);
    expect(hp(session, 'player')).toBe(100);
  });

  it('refuses stale/duplicate submissions and commands after resolution without changing the session', () => {
    const first = start(def());
    const after = run(first, { kind: 'ATTACK', targetId: 'enemy' }, { expectedTurn: 0 });
    const duplicate = applyCombatCommand(after, { kind: 'ATTACK', targetId: 'enemy' }, { expectedTurn: 0 });
    expect(duplicate).toMatchObject({ accepted: false, issue: 'stale-command' });
    expect(duplicate.session).toBe(after);
    const left = run(after, { kind: 'LEAVE' });
    expect(applyCombatCommand(left, { kind: 'ATTACK', targetId: 'enemy' })).toMatchObject({ accepted: false, issue: 'combat-resolved' });
  });

  it('is pure and deterministic, and round-trips through JSON', () => {
    const session = start(def({ gimmicks: ['charging'], objective: 'interrupt-charged-action' }));
    const snapshot = structuredClone(session);
    const a = applyCombatCommand(session, { kind: 'ATTACK', targetId: 'enemy' });
    const b = applyCombatCommand(session, { kind: 'ATTACK', targetId: 'enemy' });
    expect(a).toEqual(b);
    expect(session).toEqual(snapshot);
    const revived = JSON.parse(JSON.stringify(a.session)) as CombatSession;
    expect(validateCombatSession(revived)).toBe(true);
    expect(applyCombatCommand(revived, { kind: 'GUARD' })).toEqual(applyCombatCommand(a.session, { kind: 'GUARD' }));
  });

  it('ignores provider-shaped authority fields and rejects unknown commands or corrupted sessions', () => {
    const session = start(def());
    const forged = { kind: 'ATTACK', targetId: 'enemy', outcome: 'victory', damage: 999, hp: 0, reward: 'xp' } as unknown as CombatCommand;
    const honest = applyCombatCommand(session, { kind: 'ATTACK', targetId: 'enemy' });
    expect(applyCombatCommand(session, forged)).toEqual(honest);
    expect(applyCombatCommand(session, { kind: 'WIN' } as unknown as CombatCommand)).toMatchObject({ accepted: false, issue: 'invalid-command' });
    const corrupted = { ...session, state: { ...session.state, combatants: session.state.combatants.map((c) => ({ ...c, currentHp: -5 })) } };
    expect(applyCombatCommand(corrupted, { kind: 'GUARD' })).toMatchObject({ accepted: false, issue: 'invalid-session' });
    expect(applyCombatCommand(session, { kind: 'ATTACK', targetId: 'enemy' }, { timing: 'perfect' as never })).toMatchObject({ accepted: false, issue: 'invalid-timing-grade' });
    expect(createCombatSession(def({ objective: 'defeat' }), pacifyScenario)).toEqual({ ok: false, issue: 'invalid-scenario' });
  });

  it('keeps the fictional log bounded', () => {
    let session = start(def({ combatants: [PLAYER, { id: 'enemy', templateId: 'wall', team: 'enemy', maxHp: 1000 }] }));
    for (let index = 0; index < 8; index += 1) session = run(session, { kind: 'GUARD' });
    expect(session.log.length).toBeLessThanOrEqual(COMBAT_LOG_LIMIT);
  });

  it('objective evaluation order: player down outranks simultaneous enemy defeat', () => {
    const definition = def();
    const session = start(definition);
    const bothDown = { ...session.state, combatants: session.state.combatants.map((c) => ({ ...c, currentHp: 0 })) };
    expect(evaluateObjective(definition, bothDown, 'after-action')).toBe('defeat');
    expect(enemyIntent(definition, bothDown, 'enemy')).toBeUndefined();
  });
});
