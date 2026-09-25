import { describe, expect, it } from 'vitest';
import { simpleScriptedPlayer } from '../../src/combat/content/scriptedPlayer';
import {
  INTERRUPT_VERTICAL,
  PACIFY_VERTICAL,
  PROTECT_VERTICAL,
  SURVIVE_VERTICAL
} from '../../src/combat/content/verticals';
import { playRound, simulateEncounter, startEncounter } from '../../src/combat/runner';
import type { CombatDefinition, CombatState } from '../../src/combat/types';

const hp = (state: CombatState, id: string) => state.combatants.find((c) => c.id === id)!.hp;

function trace(definition: CombatDefinition, intents: Parameters<typeof playRound>[2][]) {
  let state = startEncounter(definition);
  const states = [state];
  for (const intent of intents) {
    state = playRound(definition, state, intent);
    states.push(state);
  }
  return states;
}

describe('C15 pacify vertical', () => {
  it('completes via ACT/pacify with the enemy never knocked out', () => {
    const states = trace(PACIFY_VERTICAL, [
      { verb: 'act', actId: 'read_runes' },
      { verb: 'act', actId: 'offer_bread' },
      { verb: 'act', actId: 'offer_bread' }
    ]);
    const end = states.at(-1)!;
    expect(end.phase).toBe('resolved');
    expect(end.outcome).toBe('pacified');
    expect(states).toHaveLength(4);
    for (const s of states) expect(hp(s, 'bear')).toBe(60);
    expect(end.completedActIds).toEqual(['read_runes', 'offer_bread']);
  });

  it('does not resolve before the pacify path is complete', () => {
    const states = trace(PACIFY_VERTICAL, [{ verb: 'act', actId: 'offer_bread' }]);
    expect(states[1].phase).toBe('player');
    expect(states[1].objectiveProgress).toBe(1);
    expect(states[1].statuses.some((s) => s.status === 'pacifiable' && s.targetId === 'bear')).toBe(true);
  });

  it('ATTACK cannot KO the non-kill target; it floors at 1 HP and never resolves as victory', () => {
    let state = startEncounter(PACIFY_VERTICAL);
    for (let i = 0; i < 4; i++) state = playRound(PACIFY_VERTICAL, state, { verb: 'attack', targetId: 'bear' });
    expect(hp(state, 'bear')).toBe(1);
    expect(state.outcome).not.toBe('victory');
  });

  it('scripted player resolves it in 2 turns, deterministically', () => {
    const a = simulateEncounter(PACIFY_VERTICAL, simpleScriptedPlayer);
    expect(a.state.outcome).toBe('pacified');
    expect(a.turns).toBe(2);
    expect(a.intents.every((i) => i.verb === 'act')).toBe(true);
    expect(simulateEncounter(PACIFY_VERTICAL, simpleScriptedPlayer)).toEqual(a);
  });

  it('pacified state carries no reward/evidence fields beyond engine truth', () => {
    const end = simulateEncounter(PACIFY_VERTICAL, simpleScriptedPlayer).state;
    expect(Object.keys(end)).not.toContain('evidence');
  });
});

describe('C16 protect / interrupt / survive verticals', () => {
  it('protect: ally survives 3 rounds; Cover prevents the first two threats', () => {
    const sim = simulateEncounter(PROTECT_VERTICAL, simpleScriptedPlayer);
    expect(sim.state.outcome).toBe('victory');
    expect(sim.turns).toBe(3);
    expect(sim.intents.map((i) => i.verb)).toEqual(['technique', 'technique', 'guard']);
    expect(hp(sim.state, 'wren')).toBe(30 - 14);
    expect(hp(sim.state, 'eel')).toBe(60);
  });

  it('protect: ally at 0 HP fails forward as defeat (not a personality verdict)', () => {
    let state = startEncounter(PROTECT_VERTICAL);
    for (let i = 0; i < 3 && state.phase !== 'resolved'; i++) state = playRound(PROTECT_VERTICAL, state, { verb: 'guard' });
    expect(state.outcome).toBe('defeat');
    expect(hp(state, 'wren')).toBe(0);
  });

  it('interrupt: charge telegraphed, then broken on round 2 for victory', () => {
    const start = startEncounter(INTERRUPT_VERTICAL);
    expect(start.telegraphedIntents?.[0].intent).toBe('charge');
    const sim = simulateEncounter(INTERRUPT_VERTICAL, simpleScriptedPlayer);
    expect(sim.turns).toBe(2);
    expect(sim.intents.map((i) => i.verb)).toEqual(['guard', 'technique']);
    expect(sim.state.outcome).toBe('victory');
    expect(sim.state.objectiveProgress).toBe(1);
    expect(hp(sim.state, 'kite')).toBe(54);
  });

  it('interrupt: ignoring the charge lets the 22-damage release land', () => {
    const states = trace(INTERRUPT_VERTICAL, [{ verb: 'guard' }, { verb: 'attack', targetId: 'kite' }]);
    expect(hp(states[2], 'greyson')).toBe(100 - 22);
    expect(states[2].phase).toBe('player');
  });

  it('survive: guarding holds for 4 rounds with swarm damage halved', () => {
    const sim = simulateEncounter(SURVIVE_VERTICAL, simpleScriptedPlayer);
    expect(sim.turns).toBe(4);
    expect(sim.state.outcome).toBe('victory');
    expect(hp(sim.state, 'greyson')).toBe(100 - 4 * Math.ceil(18 / 2));
  });

  it('the three C16 fixtures are distinct objectives and each resolves in 2-5 turns', () => {
    const fixtures = [PROTECT_VERTICAL, INTERRUPT_VERTICAL, SURVIVE_VERTICAL];
    expect(new Set(fixtures.map((f) => f.objective)).size).toBe(3);
    for (const f of fixtures) {
      const sim = simulateEncounter(f, simpleScriptedPlayer);
      expect(sim.turns).toBeGreaterThanOrEqual(2);
      expect(sim.turns).toBeLessThanOrEqual(5);
    }
  });

  it('survive: story-gated LEAVE is refused while the gate is closed', () => {
    const state = startEncounter(SURVIVE_VERTICAL);
    expect(() => playRound(SURVIVE_VERTICAL, state, { verb: 'leave' })).toThrow(/story-gated/);
    expect(playRound(SURVIVE_VERTICAL, state, { verb: 'leave' }, { storyGateOpen: true }).outcome).toBe('story');
  });
});
