import { describe, expect, it } from 'vitest';
import { ENCOUNTER_BANK, buildEncounter } from '../../src/combat/content/encounters';
import { simpleScriptedPlayer } from '../../src/combat/content/scriptedPlayer';
import { validateGimmicks } from '../../src/combat/gimmicks';
import { MVP_COMBAT_OBJECTIVES, validateObjectiveDefinition } from '../../src/combat/objectives';
import { simulateEncounter } from '../../src/combat/runner';

describe('CT04 encounter bank', () => {
  it('has exactly 30 uniquely identified encounters', () => {
    expect(ENCOUNTER_BANK).toHaveLength(30);
    expect(new Set(ENCOUNTER_BANK.map((d) => d.id)).size).toBe(30);
    expect(new Set(ENCOUNTER_BANK.map((d) => d.encounterId)).size).toBe(30);
  });

  it('covers every MVP objective and every MVP gimmick', () => {
    for (const objective of MVP_COMBAT_OBJECTIVES) {
      expect(ENCOUNTER_BANK.filter((d) => d.objective === objective).length).toBeGreaterThanOrEqual(5);
    }
    const gimmicks = new Set(ENCOUNTER_BANK.flatMap((d) => d.gimmicks));
    for (const g of ['shielded', 'charging', 'counterattacking', 'swarm', 'non-kill-target']) {
      expect(gimmicks.has(g as never)).toBe(true);
    }
  });

  it('never combines defeat with non-kill-target', () => {
    for (const d of ENCOUNTER_BANK) {
      if (d.objective === 'defeat') expect(d.gimmicks).not.toContain('non-kill-target');
    }
  });

  it('keeps ordinary enemy envelope (1-3 enemies, 18-70 total HP)', () => {
    for (const d of ENCOUNTER_BANK) {
      const enemies = d.combatants.filter((c) => c.side === 'enemy');
      expect(enemies.length).toBeGreaterThanOrEqual(1);
      expect(enemies.length).toBeLessThanOrEqual(3);
      const total = enemies.reduce((sum, e) => sum + e.maxHp, 0);
      expect(total).toBeGreaterThanOrEqual(18);
      expect(total).toBeLessThanOrEqual(70);
    }
  });

  it.each(ENCOUNTER_BANK.map((d) => [d.id, d] as const))('%s is schema-valid', (_id, d) => {
    expect(() => validateObjectiveDefinition(d)).not.toThrow();
    expect(() => validateGimmicks(d)).not.toThrow();
  });

  it.each(ENCOUNTER_BANK.map((d) => [d.id, d] as const))(
    '%s resolves in 2-5 turns under the scripted player without dying',
    (_id, d) => {
      const sim = simulateEncounter(d, simpleScriptedPlayer);
      expect(sim.state.phase).toBe('resolved');
      expect(sim.turns).toBeGreaterThanOrEqual(2);
      expect(sim.turns).toBeLessThanOrEqual(5);
      expect(sim.state.outcome).toBe(d.objective === 'pacify' ? 'pacified' : 'victory');
      // The scripted player never supplies timing: every win is timing-free.
      expect(sim.intents.some((i) => 'timedSuccess' in i && i.timedSuccess)).toBe(false);
    }
  );

  it('is deterministic: two simulations of each encounter are identical', () => {
    for (const d of ENCOUNTER_BANK) {
      expect(simulateEncounter(d, simpleScriptedPlayer)).toEqual(simulateEncounter(d, simpleScriptedPlayer));
    }
  });

  it('builder output for defeat + non-kill-target is rejected by the validator', () => {
    const bad = buildEncounter({ id: 'bad', objective: 'defeat', gimmicks: ['non-kill-target'], enemies: [{ id: 'e', label: 'E', hp: 40 }] });
    expect(() => validateObjectiveDefinition(bad)).toThrow(/non-kill-target/);
  });
});
