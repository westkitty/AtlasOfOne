import { describe, expect, it } from 'vitest';
import { attackDamage, guardedIncomingDamage } from '../../src/combat/engine';
import { ENCOUNTER_BANK } from '../../src/combat/content/encounters';
import { simpleScriptedPlayer } from '../../src/combat/content/scriptedPlayer';
import { playRound, simulateEncounter, startEncounter, type CombatPlayerIntent } from '../../src/combat/runner';
import {
  TIMING_WINDOW_MS,
  resolveTimedSuccess,
  timingPromptOffered,
  type TimingSample
} from '../../src/combat/timing';
import { objectiveFixture } from './fixtures';

describe('C14 timing resolution is strictly optional', () => {
  it.each<TimingSample | undefined>([
    undefined,
    { mode: 'keyboard' },
    { mode: 'keyboard', offsetMs: 0 },
    { mode: 'touch' },
    { mode: 'touch', offsetMs: 5 },
    { mode: 'declined' },
    { mode: 'reduced-motion', offsetMs: 0 },
    { mode: 'timed-pointer', offsetMs: 0, reducedMotion: true },
    { mode: 'timed-pointer' },
    { mode: 'timed-pointer', offsetMs: Number.NaN },
    { mode: 'timed-pointer', offsetMs: Number.POSITIVE_INFINITY },
    { mode: 'timed-pointer', offsetMs: TIMING_WINDOW_MS + 1 },
    { mode: 'timed-pointer', offsetMs: -(TIMING_WINDOW_MS + 1) }
  ])('non-timed or missed sample %o yields the base action', (sample) => {
    expect(resolveTimedSuccess(sample)).toBe(false);
  });

  it('opted-in timed pointer inside a generous window earns the bonus', () => {
    expect(TIMING_WINDOW_MS).toBeGreaterThanOrEqual(200);
    expect(resolveTimedSuccess({ mode: 'timed-pointer', offsetMs: 0 })).toBe(true);
    expect(resolveTimedSuccess({ mode: 'timed-pointer', offsetMs: TIMING_WINDOW_MS })).toBe(true);
    expect(resolveTimedSuccess({ mode: 'timed-pointer', offsetMs: -TIMING_WINDOW_MS })).toBe(true);
  });

  it('reduced motion never offers a timing prompt', () => {
    expect(timingPromptOffered(true)).toBe(false);
    expect(timingPromptOffered(false)).toBe(true);
  });

  it('no-timing ATTACK/GUARD results equal the base formula; timing only improves them', () => {
    expect(attackDamage(resolveTimedSuccess(undefined))).toBe(18);
    expect(attackDamage(resolveTimedSuccess({ mode: 'timed-pointer', offsetMs: 999 }))).toBe(18);
    expect(attackDamage(true)).toBeGreaterThan(attackDamage(false));
    for (let raw = 0; raw <= 22; raw++) {
      expect(guardedIncomingDamage(raw, false)).toBe(Math.ceil(raw * 0.5));
      expect(guardedIncomingDamage(raw, true)).toBeLessThanOrEqual(guardedIncomingDamage(raw, false));
      expect(guardedIncomingDamage(raw, false)).toBeLessThanOrEqual(raw);
    }
  });
});

describe('C14 end-to-end: missed timing is never a penalty', () => {
  const defeat = objectiveFixture('defeat');
  const enemyHp = (state: ReturnType<typeof startEncounter>) => state.combatants.find((c) => c.id === 'enemy_1')!.hp;
  const playerHp = (state: ReturnType<typeof startEncounter>) => state.combatants.find((c) => c.id === 'greyson')!.hp;

  it('ATTACK with missing, false, or keyboard-resolved timing produces identical state', () => {
    const start = startEncounter(defeat);
    const intents: CombatPlayerIntent[] = [
      { verb: 'attack', targetId: 'enemy_1' },
      { verb: 'attack', targetId: 'enemy_1', timedSuccess: false },
      { verb: 'attack', targetId: 'enemy_1', timedSuccess: resolveTimedSuccess({ mode: 'keyboard' }) }
    ];
    const results = intents.map((i) => playRound(defeat, start, i));
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
    expect(enemyHp(results[0])).toBe(54 - 18);
  });

  it('timed ATTACK is at least as good as untimed', () => {
    const start = startEncounter(defeat);
    const timed = playRound(defeat, start, { verb: 'attack', targetId: 'enemy_1', timedSuccess: true });
    const base = playRound(defeat, start, { verb: 'attack', targetId: 'enemy_1' });
    expect(enemyHp(timed)).toBeLessThanOrEqual(enemyHp(base));
    expect(playerHp(timed)).toBe(playerHp(base));
  });

  it('GUARD without timing takes the ordinary 50% reduction, never full damage', () => {
    const start = startEncounter(defeat);
    const base = playRound(defeat, start, { verb: 'guard' });
    const timed = playRound(defeat, start, { verb: 'guard', timedSuccess: true });
    expect(playerHp(base)).toBe(100 - 6);
    expect(playerHp(timed)).toBeGreaterThanOrEqual(playerHp(base));
  });

  it('every CT04 encounter is winnable with zero timed inputs (keyboard/touch/reduced-motion path)', () => {
    for (const d of ENCOUNTER_BANK) {
      const sim = simulateEncounter(d, simpleScriptedPlayer);
      expect(['victory', 'pacified']).toContain(sim.state.outcome);
    }
  });

  it('adding perfect timing to the same script never lengthens or worsens an encounter', () => {
    const timedScript: typeof simpleScriptedPlayer = (d, s) => {
      const intent = simpleScriptedPlayer(d, s);
      return intent.verb === 'attack' || intent.verb === 'guard' ? { ...intent, timedSuccess: true } : intent;
    };
    for (const d of ENCOUNTER_BANK) {
      const base = simulateEncounter(d, simpleScriptedPlayer);
      const timed = simulateEncounter(d, timedScript);
      expect(timed.state.outcome).toBe(base.state.outcome);
      expect(timed.turns).toBeLessThanOrEqual(base.turns);
      expect(playerHp(timed.state)).toBeGreaterThanOrEqual(playerHp(base.state));
    }
  });
});
