import { describe, expect, it } from 'vitest';
import { ENCOUNTER_BANK } from '../../src/combat/content/encounters';
import { cautiousScriptedPlayer, simpleScriptedPlayer } from '../../src/combat/content/scriptedPlayer';
import { playRound, simulateEncounter, startEncounter, type ScriptedPlayer } from '../../src/combat/runner';
import type { CombatDefinition, CombatState } from '../../src/combat/types';

/** C17 deterministic encounter metrics across the CT04 bank. */
interface Metrics { id: string; objective: string; turns: number; playerHpLost: number; allyHpLost: number; outcome?: string }

function metrics(d: CombatDefinition, script: ScriptedPlayer): Metrics {
  const sim = simulateEncounter(d, script);
  const lost = (side: 'player' | 'ally') => {
    const c = sim.state.combatants.find((x) => x.side === side);
    return c ? c.maxHp - c.hp : 0;
  };
  return { id: d.id, objective: d.objective, turns: sim.turns, playerHpLost: lost('player'), allyHpLost: lost('ally'), outcome: sim.state.outcome };
}

const simple = ENCOUNTER_BANK.map((d) => metrics(d, simpleScriptedPlayer));
const cautious = ENCOUNTER_BANK.map((d) => metrics(d, cautiousScriptedPlayer));
const winning = (m: Metrics) => m.outcome === 'victory' || m.outcome === 'pacified';

describe('C17 tuning metrics: simple scripted player', () => {
  it('resolves every encounter in 2-5 turns with a win', () => {
    for (const m of simple) {
      expect(winning(m), m.id).toBe(true);
      expect(m.turns, m.id).toBeGreaterThanOrEqual(2);
      expect(m.turns, m.id).toBeLessThanOrEqual(5);
    }
  });

  it('spreads turn counts (not a flat 2-turn bank)', () => {
    const dist = new Set(simple.map((m) => m.turns));
    expect(dist.size).toBeGreaterThanOrEqual(3);
    expect(simple.filter((m) => m.turns === 2).length).toBeLessThanOrEqual(15);
  });

  it('applies real pressure: most encounters cost HP, none is lethal-close', () => {
    const pressured = simple.filter((m) => m.playerHpLost + m.allyHpLost > 0);
    expect(pressured.length).toBeGreaterThanOrEqual(24);
    for (const m of simple) expect(m.playerHpLost, m.id).toBeLessThan(60);
  });

  it('every objective has at least one encounter that costs the player HP', () => {
    for (const objective of ['defeat', 'survive', 'interrupt', 'pacify']) {
      expect(simple.some((m) => m.objective === objective && m.playerHpLost > 0), objective).toBe(true);
    }
    expect(simple.some((m) => m.objective === 'protect' && m.allyHpLost > 0)).toBe(true);
  });

  it('interrupt encounters are not uniformly free (CT04 reviewer note)', () => {
    const interrupts = simple.filter((m) => m.objective === 'interrupt');
    expect(interrupts.some((m) => m.playerHpLost > 0)).toBe(true);
    expect(new Set(interrupts.map((m) => m.turns)).size).toBeGreaterThanOrEqual(2);
  });

  it('objective variety: all five objectives, none above 30% of the bank', () => {
    const counts = new Map<string, number>();
    for (const m of simple) counts.set(m.objective, (counts.get(m.objective) ?? 0) + 1);
    expect(counts.size).toBe(5);
    for (const n of counts.values()) expect(n / simple.length).toBeLessThanOrEqual(0.3);
  });
});

describe('C17 tuning metrics: cautious (guard-when-threatened) player', () => {
  it('never faces an unwinnable encounter', () => {
    for (const m of cautious) {
      expect(winning(m), m.id).toBe(true);
      expect(m.turns, m.id).toBeLessThanOrEqual(8);
    }
  });

  it('caution never costs more HP than the simple plan', () => {
    cautious.forEach((m, i) => expect(m.playerHpLost, m.id).toBeLessThanOrEqual(simple[i].playerHpLost));
  });
});

describe('C17 tuning metrics: LEAVE-seeking player', () => {
  function leaveRun(d: CombatDefinition, storyGateOpen: boolean): { state: CombatState; turns: number } {
    let state = startEncounter(d);
    let turns = 0;
    while (state.phase !== 'resolved' && turns < 12) {
      turns += 1;
      const canLeave = d.fleeRule === 'always'
        || (d.fleeRule === 'after-turn' && state.round > 1)
        || (d.fleeRule === 'story-gated' && storyGateOpen);
      state = canLeave
        ? playRound(d, state, { verb: 'leave' }, { storyGateOpen })
        : playRound(d, state, simpleScriptedPlayer(d, state));
    }
    return { state, turns };
  }

  it.each(ENCOUNTER_BANK.map((d) => [d.id, d] as const))('%s: LEAVE follows its flee rule', (_id, d) => {
    const run = leaveRun(d, false);
    if (d.fleeRule === 'always') {
      expect(run.state.outcome).toBe('escaped');
      expect(run.turns).toBe(1);
    } else if (d.fleeRule === 'after-turn') {
      expect(() => playRound(d, startEncounter(d), { verb: 'leave' })).toThrow(/one full combat round/);
      expect(run.state.outcome).toBe('escaped');
      expect(run.turns).toBe(2);
    } else {
      expect(() => playRound(d, startEncounter(d), { verb: 'leave' })).toThrow(/story-gated/);
      expect(winning({ ...metrics(d, simpleScriptedPlayer) })).toBe(true);
      const gated = leaveRun(d, true);
      expect(gated.state.outcome).toBe('story');
      expect(gated.turns).toBe(1);
    }
  });

  it('the bank exercises every flee rule', () => {
    expect(new Set(ENCOUNTER_BANK.map((d) => d.fleeRule))).toEqual(new Set(['always', 'after-turn', 'story-gated']));
  });
});
