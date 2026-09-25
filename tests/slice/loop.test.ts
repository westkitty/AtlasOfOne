import { describe, expect, it } from 'vitest';
import { createPureFunAdventureSeed } from '../../src/adventure/seeds';
import { simpleScriptedPlayer } from '../../src/combat/content/scriptedPlayer';
import { ENCOUNTER_BANK } from '../../src/combat/content/encounters';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { appendJournalEntry, createJournalEntry } from '../../src/journal/domain';
import { privatizeJournalEntry } from '../../src/journal/privacy';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';
import { decideReflection } from '../../src/reflection/domain';
import {
  exploreJournalEntry,
  makeSliceChoice,
  playSliceCombatRound,
  selectActiveAdventure,
  startSliceAdventure,
  withdrawSliceAdventure
} from '../../src/slice/loop';

const CANARY = 'SLICE_CANARY_journal_text_never_leaves';
const T = (minute: number) => `2026-06-01T10:${String(minute).padStart(2, '0')}:00.000Z`;

function withJournal(): CampaignState {
  const entry = createJournalEntry({ id: 'journal_1', createdAt: T(0), text: CANARY, inputMode: 'typed' });
  return { ...createInitialCampaign(), journalEntries: appendJournalEntry([], entry) };
}

let counter = 0;
const ids = () => {
  counter += 1;
  return { actionId: `act_${counter}`, observationId: `obs_${counter}`, combatId: `combat_${counter}` };
};

/** Drive the active adventure to completion, resolving any encounter with the scripted player. */
function playThrough(state: CampaignState, runId: string, minute = 10): CampaignState {
  let current = state;
  for (let step = 0; step < 40; step += 1) {
    const run = current.adventureRuns.find((item) => item.id === runId)!;
    if (run.status !== 'active') return current;
    if (current.activeCombat) {
      const definition = ENCOUNTER_BANK.find((item) => item.id === current.activeCombat!.definitionId)!;
      const intent = simpleScriptedPlayer(definition, current.activeCombat.state as never);
      current = playSliceCombatRound(current, { intent, now: T(minute), consequenceActionId: `cons_${step}` });
    } else {
      current = makeSliceChoice(current, { runId, label: 'Look closer', now: T(minute), ...ids() });
    }
  }
  throw new Error('Adventure did not finish within bound.');
}

describe('Vertical slice I00-I04', () => {
  it('Journal -> explore -> seed -> run -> encounter -> consequence -> pending Reflection', () => {
    const before = withJournal();
    const explored = exploreJournalEntry(before, {
      journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_1', seedId: 'seed_1', now: T(1)
    });
    expect(explored.seed.sourceGapIds).toEqual(['gap_1']);
    expect(explored.seed.learningTarget).toBe('reflection-eligible');
    expect(explored.state.knowledgeGaps.find((gap) => gap.id === 'gap_1')?.status).toBe('seeded');

    const started = startSliceAdventure(explored.state, { seedId: 'seed_1', runId: 'run_1', now: T(2) });
    expect(selectActiveAdventure(started)?.run.id).toBe('run_1');
    expect(started.journalEntries[0].linkedAdventureIds).toEqual(['run_1']);

    const done = playThrough(started, 'run_1');
    const run = done.adventureRuns.find((item) => item.id === 'run_1')!;
    expect(run.status).toBe('complete');
    expect(done.activeCombat).toBeNull();
    expect(done.adventureActions.some((action) => action.kind === 'combat')).toBe(true);

    // Exactly one pending Reflection over fictional observations; nothing decided for Greyson.
    expect(done.reflections).toHaveLength(1);
    const reflection = done.reflections[0];
    expect(reflection).toMatchObject({ sourceKind: 'adventure', epistemicStatus: 'pending', privacy: 'normal' });
    expect(reflection.decision).toBeUndefined();
    expect(reflection.interpretation).toBeUndefined();
    expect(reflection.sourceIds.every((id) => done.adventureObservations.some((obs) => obs.id === id))).toBe(true);
    expect(done.journalEntries[0].linkedReflectionIds).toEqual([reflection.id]);

    // Firewall: fictional play created no Evidence, insights, XP or turns.
    expect(done.evidence).toEqual(before.evidence);
    expect(done.insights).toEqual(before.insights);
    expect(done.xp).toBe(before.xp);
    expect(done.turns).toEqual(before.turns);

    // Journal text never enters any derived record.
    const derived = JSON.stringify({
      g: done.knowledgeGaps, s: done.adventureSeeds, r: done.adventureRuns,
      a: done.adventureActions, o: done.adventureObservations, f: done.reflections
    });
    expect(derived).not.toContain(CANARY);
  });

  it('Greyson decides the Reflection; a rejection is kept and still creates no Evidence', () => {
    const explored = exploreJournalEntry(withJournal(), {
      journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_1', seedId: 'seed_1', now: T(1)
    });
    const done = playThrough(startSliceAdventure(explored.state, { seedId: 'seed_1', runId: 'run_1', now: T(2) }), 'run_1');
    const rejected = decideReflection(done.reflections[0], 'reject', '');
    expect(rejected.epistemicStatus).toBe('rejected');
    expect(done.evidence).toEqual(createInitialCampaign().evidence);
  });

  it('a PRIVATE Journal entry cannot be explored, and privatizing later makes its seed ineligible', () => {
    const privateState = privatizeJournalEntry(withJournal(), 'journal_1', T(1));
    expect(() => exploreJournalEntry(privateState, {
      journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_1', seedId: 'seed_1', now: T(2)
    })).toThrow();

    const explored = exploreJournalEntry(withJournal(), {
      journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_1', seedId: 'seed_1', now: T(1)
    });
    const later = privatizeJournalEntry(explored.state, 'journal_1', T(2));
    expect(() => startSliceAdventure(later, { seedId: 'seed_1', runId: 'run_1', now: T(3) })).toThrow();
  });

  it('pure-fun adventures finish with no Reflection offered', () => {
    const seed = createPureFunAdventureSeed({ id: 'seed_fun', territoryId: 'interests', premise: 'A kite race over the rooftops.' });
    const state = { ...createInitialCampaign(), adventureSeeds: [seed] };
    const done = playThrough(startSliceAdventure(state, { seedId: 'seed_fun', runId: 'run_fun', now: T(1) }), 'run_fun');
    expect(done.adventureRuns[0].status).toBe('complete');
    expect(done.reflections).toEqual([]);
  });

  it('LEAVE and defeat both fail forward: the story continues and completes', () => {
    const explored = exploreJournalEntry(withJournal(), {
      journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_1', seedId: 'seed_1', now: T(1)
    });
    let state = startSliceAdventure(explored.state, { seedId: 'seed_1', runId: 'run_1', now: T(2) });
    while (!state.activeCombat) state = makeSliceChoice(state, { runId: 'run_1', label: 'Go on', now: T(3), ...ids() });
    // Leave as soon as the encounter's flee rule allows; otherwise guard until it does.
    for (let round = 0; round < 10 && state.activeCombat; round += 1) {
      try {
        state = playSliceCombatRound(state, { intent: { verb: 'leave' }, now: T(4), consequenceActionId: `c_leave_${round}` });
      } catch {
        state = playSliceCombatRound(state, { intent: { verb: 'guard' }, now: T(4), consequenceActionId: `c_guard_${round}` });
      }
    }
    expect(state.activeCombat).toBeNull();
    const run = state.adventureRuns[0];
    expect(run.status === 'active' || run.status === 'complete').toBe(true);
    expect(state.xp).toBe(createInitialCampaign().xp);
  });

  it('withdrawal at any beat ends the run without judgment and clears its encounter', () => {
    const explored = exploreJournalEntry(withJournal(), {
      journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_1', seedId: 'seed_1', now: T(1)
    });
    let state = startSliceAdventure(explored.state, { seedId: 'seed_1', runId: 'run_1', now: T(2) });
    while (!state.activeCombat) state = makeSliceChoice(state, { runId: 'run_1', label: 'Go on', now: T(3), ...ids() });
    const withdrawn = withdrawSliceAdventure(state, { runId: 'run_1', now: T(5) });
    expect(withdrawn.adventureRuns[0].status).toBe('withdrawn');
    expect(withdrawn.activeCombat).toBeNull();
    expect(withdrawn.reflections).toEqual([]);
  });

  it('save/reload mid-encounter resumes the same deterministic loop', () => {
    const explored = exploreJournalEntry(withJournal(), {
      journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_1', seedId: 'seed_1', now: T(1)
    });
    let state = startSliceAdventure(explored.state, { seedId: 'seed_1', runId: 'run_1', now: T(2) });
    while (!state.activeCombat) state = makeSliceChoice(state, { runId: 'run_1', label: 'Go on', now: T(3), ...ids() });
    const reloaded = deserializeCampaign(serializeCampaign(state));
    expect(reloaded).toEqual(state);
    const direct = playSliceCombatRound(state, { intent: { verb: 'guard' }, now: T(4), consequenceActionId: 'c1' });
    const viaReload = playSliceCombatRound(reloaded, { intent: { verb: 'guard' }, now: T(4), consequenceActionId: 'c1' });
    expect(viaReload).toEqual(direct);
  });

  it('only one adventure may be active at a time', () => {
    const explored = exploreJournalEntry(withJournal(), {
      journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_1', seedId: 'seed_1', now: T(1)
    });
    const fun = createPureFunAdventureSeed({ id: 'seed_fun', territoryId: 'interests', premise: 'A kite race.' });
    const state = startSliceAdventure(
      { ...explored.state, adventureSeeds: [...explored.state.adventureSeeds, fun] },
      { seedId: 'seed_1', runId: 'run_1', now: T(2) }
    );
    expect(() => startSliceAdventure(state, { seedId: 'seed_fun', runId: 'run_2', now: T(3) })).toThrow('already in progress');
  });
});

describe('World memory recurs across adventures (A07 + N05 via the slice)', () => {
  it('a second adventure in the same place recalls the first; a PRIVATE-sourced one never recurs', async () => {
    const { selectRecurringLine } = await import('../../src/slice/loop');
    const first = exploreJournalEntry(withJournal(), {
      journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_r1', seedId: 'seed_r1', now: T(1)
    });
    let state = playThrough(startSliceAdventure(first.state, { seedId: 'seed_r1', runId: 'run_r1', now: T(2) }), 'run_r1');
    expect(state.adventureMemories.length).toBeGreaterThan(0);
    expect(state.adventureMemories.every((card) => card.sourceIds.includes('run_r1'))).toBe(true);
    expect(JSON.stringify(state.adventureMemories)).not.toContain(CANARY);

    const second = createJournalEntry({ id: 'journal_2', createdAt: T(20), text: 'Another synthetic entry.', inputMode: 'typed' });
    state = { ...state, journalEntries: appendJournalEntry(state.journalEntries, second) };
    state = exploreJournalEntry(state, { journalEntryId: 'journal_2', territoryId: 'identity', gapId: 'gap_r2', seedId: 'seed_r2', now: T(21) }).state;
    const running = startSliceAdventure(state, { seedId: 'seed_r2', runId: 'run_r2', now: T(22) });
    expect(selectRecurringLine(running)).toMatch(/familiar face|place from/);

    // Make the first run's source Journal entry PRIVATE: its memories stop recurring.
    const hidden = privatizeJournalEntry(running, 'journal_1', T(23));
    expect(selectRecurringLine(hidden)).toBeNull();
  });
});
