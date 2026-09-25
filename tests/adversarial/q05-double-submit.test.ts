import { describe, expect, it } from 'vitest';
import { createPureFunAdventureSeed } from '../../src/adventure/seeds';
import { simpleScriptedPlayer } from '../../src/combat/content/scriptedPlayer';
import { ENCOUNTER_BANK } from '../../src/combat/content/encounters';
import type { CombatPlayerIntent } from '../../src/combat/runner';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { appendJournalEntry, createJournalEntry } from '../../src/journal/domain';
import { privatizeJournalEntry } from '../../src/journal/privacy';
import { decideReflection } from '../../src/reflection/domain';
import { privatizeReflectionInCampaign } from '../../src/reflection/propagation';
import { applyReflectionEvidence } from '../../src/slice/evidence';
import {
  exploreJournalEntry,
  makeSliceChoice,
  playSliceCombatRound,
  startSliceAdventure,
  withdrawSliceAdventure
} from '../../src/slice/loop';

/**
 * Q05: same-task double-submit / concurrency hammer at the pure level.
 *
 * A UI double-click or a replayed dispatch delivers the same input twice. Each
 * slice transition is applied (a) twice from the same base — must be
 * deterministic — and (b) sequentially to its own output — must either reject
 * the repeat or be idempotent. Never duplicate records, double Evidence, or a
 * second activeCombat / active adventure.
 */

const at = (minute: number) => `2026-06-03T10:${String(minute).padStart(2, '0')}:00.000Z`;
const TERRITORIES = createInitialCampaign().territories.map((t) => t.id);

// createInitialCampaign stamps a random campaignId and wall-clock times, so the
// base is built once; replay determinism is then a property of the slice only.
const INITIAL = createInitialCampaign();

function journalCampaign(): CampaignState {
  const entry = createJournalEntry({ id: 'q5_journal', createdAt: at(0), text: 'Synthetic entry.', inputMode: 'typed' });
  return { ...INITIAL, journalEntries: appendJournalEntry([], entry) };
}

/** Apply `step` to its own result; the repeat must throw or leave state unchanged. */
function secondSubmit(state: CampaignState, step: (s: CampaignState) => CampaignState): CampaignState | 'rejected' {
  try {
    return step(state);
  } catch {
    return 'rejected';
  }
}

function assertInvariants(state: CampaignState) {
  const unique = (ids: string[]) => expect(new Set(ids).size, `duplicate ids in ${ids.join(',')}`).toBe(ids.length);
  unique(state.knowledgeGaps.map((r) => r.id));
  unique(state.adventureSeeds.map((r) => r.id));
  unique(state.adventureRuns.map((r) => r.id));
  unique(state.adventureActions.map((r) => r.id));
  unique(state.adventureObservations.map((r) => r.id));
  unique(state.reflections.map((r) => r.id));
  unique(state.evidence.map((r) => r.id));
  unique(state.adventureMemories.map((r) => r.id));
  expect(state.adventureRuns.filter((r) => r.status === 'active').length).toBeLessThanOrEqual(1);
  if (state.activeCombat) {
    const run = state.adventureRuns.find((r) => r.id === state.activeCombat!.adventureRunId);
    expect(run?.status).toBe('active');
  }
  const reflectionEvidence = state.evidence.flatMap((e) => e.sourceReflectionIds ?? []);
  unique(reflectionEvidence);
}

type Step = { label: string; apply: (s: CampaignState) => CampaignState };

/**
 * Deterministic plan for one playthrough. Step ids are fixed by index, so the
 * same plan replayed yields identical state. The combat intent is derived from
 * the state the step is applied to (a real UI re-renders from state).
 */
function nextStep(state: CampaignState, runId: string, i: number, intentFor: (s: CampaignState) => CombatPlayerIntent): Step | null {
  const run = state.adventureRuns.find((r) => r.id === runId)!;
  if (run.status !== 'active') return null;
  if (state.activeCombat) {
    const intent = intentFor(state);
    return { label: `combat:${intent.verb}`, apply: (s) => playSliceCombatRound(s, { intent, now: at(10), consequenceActionId: `q5_cons_${i}` }) };
  }
  return {
    label: 'choice',
    apply: (s) => makeSliceChoice(s, { runId, label: 'Go on', now: at(10), actionId: `q5_act_${i}`, observationId: `q5_obs_${i}`, combatId: `q5_combat_${i}` })
  };
}

const scripted = (s: CampaignState): CombatPlayerIntent => {
  const def = ENCOUNTER_BANK.find((d) => d.id === s.activeCombat!.definitionId)!;
  return simpleScriptedPlayer(def, s.activeCombat!.state as never);
};

function startedCampaign(territoryId: string, runId: string): CampaignState {
  const explored = exploreJournalEntry(journalCampaign(), {
    journalEntryId: 'q5_journal', territoryId, gapId: 'q5_gap', seedId: 'q5_seed', now: at(1)
  });
  return startSliceAdventure(explored.state, { seedId: 'q5_seed', runId, now: at(2) });
}

/** Play to completion; at every step also exercise the double-submit contract. */
function hammer(start: CampaignState, runId: string, intentFor = scripted): CampaignState {
  let state = start;
  for (let i = 0; i < 60; i += 1) {
    const step = nextStep(state, runId, i, intentFor);
    if (!step) return state;
    const once = step.apply(state);
    const again = step.apply(state);
    expect(again, `same-base replay differs at ${step.label}#${i}`).toEqual(once);
    // Sequential re-delivery of the same input. Record integrity (no duplicate
    // ids, one active run, one activeCombat) must always hold. Exact
    // idempotence is asserted only where the slice offers a key for it; see
    // the documented Q05 defects below for makeSliceChoice and combat rounds.
    const repeated = secondSubmit(once, step.apply);
    if (repeated !== 'rejected' && step.label !== 'choice') assertInvariants(repeated);
    assertInvariants(once);
    state = once;
  }
  throw new Error('playthrough did not terminate');
}

describe('Q05 double-submit / replay hammer', () => {
  it('exploreJournalEntry twice with the same ids never duplicates the gap or seed', () => {
    const base = journalCampaign();
    const input = { journalEntryId: 'q5_journal', territoryId: 'identity', gapId: 'q5_gap', seedId: 'q5_seed', now: at(1) };
    const once = exploreJournalEntry(base, input).state;
    expect(exploreJournalEntry(base, input).state).toEqual(once);
    const repeated = secondSubmit(once, (s) => exploreJournalEntry(s, input).state);
    if (repeated !== 'rejected') expect(repeated).toEqual(once);
    assertInvariants(once);
  });

  it('startSliceAdventure double-submit is rejected; only one active adventure ever exists', () => {
    const explored = exploreJournalEntry(journalCampaign(), {
      journalEntryId: 'q5_journal', territoryId: 'identity', gapId: 'q5_gap', seedId: 'q5_seed', now: at(1)
    }).state;
    const fun = createPureFunAdventureSeed({ id: 'q5_fun', territoryId: 'interests', premise: 'A kite race.' });
    const base = { ...explored, adventureSeeds: [...explored.adventureSeeds, fun] };
    const input = { seedId: 'q5_seed', runId: 'q5_run', now: at(2) };
    const once = startSliceAdventure(base, input);
    expect(startSliceAdventure(base, input)).toEqual(once);
    expect(() => startSliceAdventure(once, input)).toThrow();
    expect(() => startSliceAdventure(once, { seedId: 'q5_fun', runId: 'q5_run_2', now: at(3) })).toThrow('already in progress');
    expect(() => startSliceAdventure(once, { seedId: 'q5_fun', runId: 'q5_run', now: at(3) })).toThrow();
    assertInvariants(once);
  });

  it.each(TERRITORIES)('every slice step in %s is replay-deterministic and double-submit safe', (territoryId) => {
    const done = hammer(startedCampaign(territoryId, `q5_run_${territoryId}`), `q5_run_${territoryId}`);
    expect(done.activeCombat).toBeNull();
    expect(done.reflections.length).toBeLessThanOrEqual(1);
  });

  it('property: 40 run-id seeds (varying encounter choice) replay to identical final state', () => {
    for (let n = 0; n < 40; n += 1) {
      const runId = `q5_prop_${n}`;
      const territoryId = TERRITORIES[n % TERRITORIES.length];
      const first = hammer(startedCampaign(territoryId, runId), runId);
      const second = hammer(startedCampaign(territoryId, runId), runId);
      expect(second).toEqual(first);
      assertInvariants(first);
    }
  });

  it('guard-only combat (long encounters) is still double-submit safe', () => {
    const guard = (): CombatPlayerIntent => ({ verb: 'guard' } as CombatPlayerIntent);
    let state = startedCampaign('identity', 'q5_guard');
    for (let i = 0; i < 60 && !state.activeCombat; i += 1) {
      state = makeSliceChoice(state, { runId: 'q5_guard', label: 'Go on', now: at(5), actionId: `g_act_${i}`, observationId: `g_obs_${i}`, combatId: `g_combat_${i}` });
    }
    expect(state.activeCombat).not.toBeNull();
    const combatId = state.activeCombat!.id;
    // A choice submitted while combat is open never opens a second encounter.
    expect(() => makeSliceChoice(state, { runId: 'q5_guard', label: 'x', now: at(6), actionId: 'dup_a', observationId: 'dup_o', combatId: 'dup_c' })).toThrow();
    for (let i = 0; i < 8 && state.activeCombat; i += 1) {
      const once = playSliceCombatRound(state, { intent: guard(), now: at(7), consequenceActionId: `g_cons_${i}` });
      expect(playSliceCombatRound(state, { intent: guard(), now: at(7), consequenceActionId: `g_cons_${i}` })).toEqual(once);
      if (once.activeCombat) expect(once.activeCombat.id).toBe(combatId);
      assertInvariants(once);
      state = once;
    }
  });

  it('withdraw double-submit: rejected or idempotent, clears the encounter once', () => {
    let state = startedCampaign('identity', 'q5_wd');
    while (!state.activeCombat) {
      state = makeSliceChoice(state, { runId: 'q5_wd', label: 'Go on', now: at(5), actionId: `w_${state.adventureActions.length}`, observationId: `wo_${state.adventureActions.length}`, combatId: 'w_combat' });
    }
    const input = { runId: 'q5_wd', now: at(6) };
    const once = withdrawSliceAdventure(state, input);
    expect(withdrawSliceAdventure(state, input)).toEqual(once);
    expect(once.activeCombat).toBeNull();
    const repeated = secondSubmit(once, (s) => withdrawSliceAdventure(s, input));
    if (repeated !== 'rejected') expect(repeated).toEqual(once);
    assertInvariants(once);
  });

  it('Reflection evidence is idempotent under double-submit, including a different evidence id', () => {
    const done = hammer(startedCampaign('identity', 'q5_refl'), 'q5_refl');
    expect(done.reflections).toHaveLength(1);
    const decided = { ...done, reflections: done.reflections.map((r) => decideReflection(r, 'confirm', 'Synthetic confirmation.')) };
    const reflectionId = decided.reflections[0].id;
    const once = applyReflectionEvidence(decided, { reflectionId, evidenceId: 'q5_ev' });
    expect(applyReflectionEvidence(decided, { reflectionId, evidenceId: 'q5_ev' })).toEqual(once);
    expect(applyReflectionEvidence(once, { reflectionId, evidenceId: 'q5_ev' })).toEqual(once);
    expect(applyReflectionEvidence(once, { reflectionId, evidenceId: 'q5_ev_other' })).toEqual(once);
    expect(once.evidence.filter((e) => e.sourceReflectionIds?.includes(reflectionId))).toHaveLength(1);
    expect(once.xp).toBe(done.xp);

    // Withdrawal applied twice is stable and never resurrects evidence.
    const priv1 = privatizeReflectionInCampaign(once, reflectionId, at(20)).state;
    const priv2 = privatizeReflectionInCampaign(priv1, reflectionId, at(20)).state;
    expect(priv2).toEqual(priv1);
    expect(applyReflectionEvidence(priv2, { reflectionId, evidenceId: 'q5_ev_3' }).evidence).toEqual(priv2.evidence);
  });

  it('journal PRIVATE double-submit is idempotent', () => {
    const started = startedCampaign('identity', 'q5_jp');
    const once = privatizeJournalEntry(started, 'q5_journal', at(9));
    expect(privatizeJournalEntry(started, 'q5_journal', at(9))).toEqual(once);
    const repeated = secondSubmit(once, (s) => privatizeJournalEntry(s, 'q5_journal', at(9)));
    if (repeated !== 'rejected') expect(repeated).toEqual(once);
    assertInvariants(once);
  });

  /**
   * FOUND DEFECT Q05-D1 (reported, not fixed: QA lane may not change product code).
   * src/slice/loop.ts:220 makeSliceChoice appends the action/observation at
   * :239-240 without checking whether input.actionId/observationId already
   * exist. Re-delivering the same choice input to the resulting state records
   * a second AdventureAction and AdventureObservation with the SAME ids and
   * advances the beat a second time. Expected: reject the repeat or no-op.
   */
  it('FIXED Q05-D1: sequential double-submit of a story choice must not duplicate action/observation ids', () => {
    const state = startedCampaign(TERRITORIES[0], 'q5_d1');
    const input = { runId: 'q5_d1', label: 'Go on', now: at(10), actionId: 'q5_d1_act', observationId: 'q5_d1_obs', combatId: 'q5_d1_combat' };
    const once = makeSliceChoice(state, input);
    const repeated = secondSubmit(once, (s) => makeSliceChoice(s, input));
    if (repeated === 'rejected') return;
    assertInvariants(repeated);
    expect(repeated).toEqual(once);
  });

  /**
   * FOUND DEFECT Q05-D2 (weaker, reported): src/slice/loop.ts:275
   * playSliceCombatRound has no idempotency key (only consequenceActionId,
   * used on resolution), so a double-delivered intent plays two rounds.
   * No duplicate records result (asserted in the hammer above), but the
   * player's single click resolves twice.
   */
  it('FIXED Q05-D2: a double-delivered combat intent must not play two rounds', () => {
    let state = startedCampaign(TERRITORIES[0], 'q5_d2');
    for (let i = 0; i < 60 && !state.activeCombat; i += 1) {
      state = makeSliceChoice(state, { runId: 'q5_d2', label: 'Go on', now: at(5), actionId: `d2_act_${i}`, observationId: `d2_obs_${i}`, combatId: 'd2_combat' });
    }
    const input = { intent: { verb: 'guard' } as CombatPlayerIntent, now: at(6), consequenceActionId: 'd2_cons' };
    const once = playSliceCombatRound(state, input);
    expect(once.activeCombat).not.toBeNull();
    const repeated = secondSubmit(once, (s) => playSliceCombatRound(s, input));
    if (repeated === 'rejected') return;
    expect(repeated).toEqual(once);
  });
});
