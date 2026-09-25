import { describe, expect, it } from 'vitest';
import {
  COMBAT_CONSEQUENCE_LINES,
  adventureConsequencesSchema,
  applyAdventureConsequences,
  combatOutcomeForRun,
  deriveAdventureConsequences,
  templateForSeed
} from '../../../src/adventure/consequences/derive';
import { eligibleAdventureMemories } from '../../../src/adventure/memory/retirement';
import { markAdventureMemoryPrivate } from '../../../src/adventure/memory/records';
import { privatizeJournalEntry } from '../../../src/journal/privacy';
import { withdrawSliceAdventure } from '../../../src/slice/loop';
import { ACTION_CANARY, CANARY, T, exploreAndStart, playThrough, withJournals, withPureFunRun } from './fixtures';

function completedRun() {
  return playThrough(exploreAndStart(withJournals('journal_1'), 1), 'run_1');
}

describe('A07 deriveAdventureConsequences', () => {
  it('completed slice run: typed, schema-valid, structural and reward-free', () => {
    const state = completedRun();
    const seed = state.adventureSeeds.find((item) => item.id === 'seed_1')!;
    const template = templateForSeed(seed)!;
    const result = deriveAdventureConsequences(state, 'run_1');

    expect(adventureConsequencesSchema.parse(result)).toEqual(result);
    expect(result).toMatchObject({ runId: 'run_1', seedId: 'seed_1', territoryId: 'identity', templateId: template.id, resolution: 'completed', cause: 'finished' });
    expect(result.combatOutcome).not.toBeNull();
    expect(result.worldFlags.map((flag) => flag.key)).toEqual(expect.arrayContaining([
      'territory:identity:visited', 'run:run_1:completed', `territory:identity:template:${template.id}:completed`,
      `territory:identity:encounter:${result.combatOutcome}`
    ]));
    expect(result.memoryCards.map((card) => card.type).sort()).toEqual([...new Set(template.memoryOutputs)].sort());
    for (const card of result.memoryCards) {
      expect(card.sourceIds).toEqual(['run_1', 'seed_1']);
      expect(card.summary).toContain(template.title);
      expect(card.triggerTerms).toContain('identity');
    }
    expect(result).toMatchObject({ xpDelta: 0, rewardIds: [], evidenceIds: [], observationIds: [] });

    const text = JSON.stringify(result);
    expect(text).not.toContain(CANARY);
    expect(text).not.toContain(ACTION_CANARY);
  });

  it('is deterministic and does not mutate state', () => {
    const state = completedRun();
    const snapshot = JSON.stringify(state);
    expect(deriveAdventureConsequences(state, 'run_1')).toEqual(deriveAdventureConsequences(structuredClone(state), 'run_1'));
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it('withdrawn run keeps only who/where; paused-for-later adds an open thread', () => {
    const base = withPureFunRun(withJournals(), 2);
    const withdrawn = withdrawSliceAdventure(base, { runId: 'run_2', now: T(5) });
    const left = deriveAdventureConsequences(withdrawn, 'run_2');
    expect(left).toMatchObject({ resolution: 'withdrawn', cause: 'chose-to-leave', templateId: 'goose-hat-heist', combatOutcome: null });
    expect(left.memoryCards.map((card) => card.type)).toEqual(['character']);
    expect(left.memoryCards[0].summary).toContain('stepped away from');

    const paused = deriveAdventureConsequences(withdrawn, 'run_2', { exitCause: 'paused-for-later' });
    expect(paused.memoryCards.map((card) => card.type)).toEqual(['character', 'promise']);
    expect(paused.worldFlags.map((flag) => flag.key)).toContain('run:run_2:thread-open');
  });

  it('npc availability: present by default, absent after an escape, never departed', () => {
    const base = withPureFunRun(withJournals(), 3);
    const state = {
      ...base,
      adventureRuns: base.adventureRuns.map((run) => (run.id === 'run_3' ? { ...run, characterIds: ['npc_pell', 'Bad Id!'] } : run))
    };
    const withdrawn = withdrawSliceAdventure(state, { runId: 'run_3', now: T(5) });
    expect(deriveAdventureConsequences(withdrawn, 'run_3').npcAvailability).toEqual([{ npcId: 'npc_pell', availability: 'present', runId: 'run_3' }]);
    expect(deriveAdventureConsequences(withdrawn, 'run_3', { exitCause: 'escaped' }).npcAvailability[0].availability).toBe('absent');
  });

  it('combat outcome only from exact system lines; free-typed combat text is ignored', () => {
    const base = withdrawSliceAdventure(withPureFunRun(withJournals(), 4), { runId: 'run_4', now: T(5) });
    const action = (id: string, text: string, at: number) => ({ id, runId: 'run_4', createdAt: T(at), kind: 'combat' as const, text });
    const state = { ...base, adventureActions: [action('a1', COMBAT_CONSEQUENCE_LINES.pacified, 6), action('a2', 'I won brilliantly', 7)] };
    expect(combatOutcomeForRun(state, 'run_4')).toBe('pacified');
    expect(combatOutcomeForRun({ ...base, adventureActions: [action('a2', 'victory', 7)] }, 'run_4')).toBeNull();
  });

  it('fails closed on active, unknown or orphaned runs and bad exit causes', () => {
    const active = withPureFunRun(withJournals(), 5);
    expect(() => deriveAdventureConsequences(active, 'run_5')).toThrow(/still active/);
    expect(() => deriveAdventureConsequences(active, 'nope')).toThrow(/Unknown/);
    const withdrawn = withdrawSliceAdventure(active, { runId: 'run_5', now: T(6) });
    expect(() => deriveAdventureConsequences({ ...withdrawn, adventureSeeds: [] }, 'run_5')).toThrow(/unknown seed/);
    expect(() => deriveAdventureConsequences(withdrawn, 'run_5', { exitCause: 'lost' as never })).toThrow(/exit cause/);
  });

  it('schema rejects rewards, evidence and XP smuggled into the contract', () => {
    const result = deriveAdventureConsequences(completedRun(), 'run_1');
    expect(() => adventureConsequencesSchema.parse({ ...result, xpDelta: 10 })).toThrow();
    expect(() => adventureConsequencesSchema.parse({ ...result, evidenceIds: ['ev_1'] })).toThrow();
    expect(() => adventureConsequencesSchema.parse({ ...result, rewardIds: ['gold'] })).toThrow();
    expect(() => adventureConsequencesSchema.parse({ ...result, extra: true })).toThrow();
  });
});

describe('A07 applyAdventureConsequences', () => {
  it('appends memory cards only, idempotently, gated by N04', () => {
    const state = completedRun();
    const consequences = deriveAdventureConsequences(state, 'run_1');
    const next = applyAdventureConsequences(state, consequences);
    const { adventureMemories, ...rest } = next;
    const { adventureMemories: before, ...restBefore } = state;
    expect(rest).toEqual(restBefore);
    expect(adventureMemories).toEqual([...before, ...consequences.memoryCards]);
    expect(applyAdventureConsequences(next, consequences)).toBe(next);
    expect(eligibleAdventureMemories(next).map((m) => m.id).sort()).toEqual(consequences.memoryCards.map((c) => c.id).sort());
  });

  it('never overwrites an existing card (a privatized card stays private)', () => {
    const state = completedRun();
    const consequences = deriveAdventureConsequences(state, 'run_1');
    const applied = applyAdventureConsequences(state, consequences);
    const privatized = { ...applied, adventureMemories: applied.adventureMemories.map(markAdventureMemoryPrivate) };
    expect(applyAdventureConsequences(privatized, consequences)).toBe(privatized);
  });

  it('cards from a run seeded by a later-PRIVATE journal are never eligible', () => {
    const state = completedRun();
    const applied = applyAdventureConsequences(state, deriveAdventureConsequences(state, 'run_1'));
    const privatized = privatizeJournalEntry(applied, 'journal_1', T(30));
    expect(eligibleAdventureMemories(privatized)).toEqual([]);
    // M06 cascade retires the cards durably too; history text is preserved.
    expect(privatized.adventureMemories.every((card) => card.status === 'retired')).toBe(true);
  });

  it('rejects consequences for a missing or active run', () => {
    const state = completedRun();
    const consequences = deriveAdventureConsequences(state, 'run_1');
    expect(() => applyAdventureConsequences({ ...state, adventureRuns: [] }, consequences)).toThrow();
  });
});
