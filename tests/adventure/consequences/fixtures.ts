import { createPureFunAdventureSeed } from '../../../src/adventure/seeds';
import { simpleScriptedPlayer } from '../../../src/combat/content/scriptedPlayer';
import { ENCOUNTER_BANK } from '../../../src/combat/content/encounters';
import { createInitialCampaign } from '../../../src/game/engine';
import type { CampaignState } from '../../../src/game/types';
import { appendJournalEntry, createJournalEntry } from '../../../src/journal/domain';
import { exploreJournalEntry, makeSliceChoice, playSliceCombatRound, startSliceAdventure } from '../../../src/slice/loop';

export const CANARY = 'CONSEQ_CANARY_journal_text';
export const ACTION_CANARY = 'CONSEQ_CANARY_typed_action';
export const T = (minute: number) => `2026-06-01T10:${String(minute).padStart(2, '0')}:00.000Z`;

export function withJournals(...ids: string[]): CampaignState {
  let entries = [] as CampaignState['journalEntries'];
  for (const id of ids) {
    entries = appendJournalEntry(entries, createJournalEntry({ id, createdAt: T(0), text: `${CANARY} ${id}`, inputMode: 'typed' }));
  }
  return { ...createInitialCampaign(), journalEntries: entries };
}

let counter = 0;
/** Drive a run to its end; choices carry a canary label (free-typed action text). */
export function playThrough(state: CampaignState, runId: string, minute = 10): CampaignState {
  let current = state;
  for (let step = 0; step < 40; step += 1) {
    const run = current.adventureRuns.find((item) => item.id === runId)!;
    if (run.status !== 'active') return current;
    counter += 1;
    if (current.activeCombat) {
      const definition = ENCOUNTER_BANK.find((item) => item.id === current.activeCombat!.definitionId)!;
      const intent = simpleScriptedPlayer(definition, current.activeCombat.state as never);
      current = playSliceCombatRound(current, { intent, now: T(minute), consequenceActionId: `cons_${runId}_${counter}` });
    } else {
      current = makeSliceChoice(current, {
        runId, label: ACTION_CANARY, now: T(minute),
        actionId: `act_${runId}_${counter}`, observationId: `obs_${runId}_${counter}`, combatId: `combat_${runId}_${counter}`
      });
    }
  }
  throw new Error('Adventure did not finish within bound.');
}

/** Journal -> explore -> seed -> run, in a territory. */
export function exploreAndStart(state: CampaignState, n: number, territoryId = 'identity', journalId = 'journal_1'): CampaignState {
  const explored = exploreJournalEntry(state, {
    journalEntryId: journalId, territoryId, gapId: `gap_${n}`, seedId: `seed_${n}`, now: T(n)
  });
  return startSliceAdventure(explored.state, { seedId: `seed_${n}`, runId: `run_${n}`, now: T(n) });
}

export function withPureFunRun(state: CampaignState, n: number, territoryId = 'identity'): CampaignState {
  const seed = createPureFunAdventureSeed({ id: `seed_${n}`, territoryId, premise: 'A goose took a hat.' });
  return startSliceAdventure({ ...state, adventureSeeds: [...state.adventureSeeds, seed] }, { seedId: seed.id, runId: `run_${n}`, now: T(n) });
}
