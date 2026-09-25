import { describe, expect, it } from 'vitest';
import { simpleScriptedPlayer } from '../../src/combat/content/scriptedPlayer';
import { ENCOUNTER_BANK } from '../../src/combat/content/encounters';
import { compileContext, contextTextFragments } from '../../src/cartographer/context';
import { createInitialCampaign } from '../../src/game/engine';
import { generateLocalAssessment } from '../../src/cartographer/finalize';
import type { CampaignState } from '../../src/game/types';
import { appendJournalEntry, createJournalEntry } from '../../src/journal/domain';
import { privatizeJournalEntry } from '../../src/journal/privacy';
import { createV2ProvenanceVisibility } from '../../src/persistence/retirement';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';
import { decideReflection } from '../../src/reflection/domain';
import { privatizeReflectionInCampaign, retractReflectionInCampaign } from '../../src/reflection/propagation';
import { applyReflectionEvidence } from '../../src/slice/evidence';
import { exploreJournalEntry, makeSliceChoice, playSliceCombatRound, startSliceAdventure } from '../../src/slice/loop';

const T = (m: number) => `2026-06-02T10:${String(m).padStart(2, '0')}:00.000Z`;
const CLAIM = 'I_CONFIRMED_CLAIM_CANARY I like fixing things with my hands.';

function completedWithReflection(): CampaignState {
  const entry = createJournalEntry({ id: 'journal_1', createdAt: T(0), text: 'Synthetic.', inputMode: 'typed' });
  let state: CampaignState = { ...createInitialCampaign(), journalEntries: appendJournalEntry([], entry) };
  state = exploreJournalEntry(state, { journalEntryId: 'journal_1', territoryId: 'identity', gapId: 'gap_1', seedId: 'seed_1', now: T(1) }).state;
  state = startSliceAdventure(state, { seedId: 'seed_1', runId: 'run_1', now: T(2) });
  for (let i = 0; i < 40 && state.adventureRuns[0].status === 'active'; i += 1) {
    if (state.activeCombat) {
      const def = ENCOUNTER_BANK.find((d) => d.id === state.activeCombat!.definitionId)!;
      state = playSliceCombatRound(state, { intent: simpleScriptedPlayer(def, state.activeCombat.state as never), now: T(3), consequenceActionId: `c${i}` });
    } else {
      state = makeSliceChoice(state, { runId: 'run_1', label: 'Go on', now: T(3), actionId: `a${i}`, observationId: `o${i}`, combatId: `k${i}` });
    }
  }
  expect(state.reflections).toHaveLength(1);
  return state;
}

function decide(state: CampaignState, decision: 'confirm' | 'partial' | 'reject' | 'uncertain' | 'private', response: string) {
  const reflections = state.reflections.map((r) => decideReflection(r, decision, response));
  return applyReflectionEvidence({ ...state, reflections }, { reflectionId: reflections[0].id, evidenceId: 'evidence_1' });
}

describe('I06 explicit Reflection -> supported Evidence', () => {
  it('confirm with Greyson\'s own words creates player-stated Evidence with Reflection provenance and no XP', () => {
    const before = completedWithReflection();
    const after = decide(before, 'confirm', CLAIM);
    expect(after.evidence).toHaveLength(before.evidence.length + 1);
    const evidence = after.evidence.at(-1)!;
    expect(evidence).toMatchObject({
      id: 'evidence_1', claim: CLAIM, origin: 'player-stated', basis: 'explicit', strength: 2,
      territories: ['identity'], sourceTurnIds: [], status: 'active', sourceReflectionIds: [before.reflections[0].id]
    });
    expect(before.territories.find((t) => t.id === 'identity')!.requiredDimensions).toContain(evidence.dimension);
    expect(after.xp).toBe(before.xp);
    expect(createV2ProvenanceVisibility(after).evidenceIsEligible('evidence_1')).toBe(true);
  });

  it('partial uses strength 1; reject, uncertain, private and empty responses create nothing', () => {
    const base = completedWithReflection();
    expect(decide(base, 'partial', CLAIM).evidence.at(-1)!.strength).toBe(1);
    for (const decision of ['reject', 'uncertain', 'private'] as const) {
      expect(decide(base, decision, CLAIM).evidence).toEqual(base.evidence);
    }
    expect(decide(base, 'confirm', '   ').evidence).toEqual(base.evidence);
  });

  it('is idempotent per Reflection', () => {
    const once = decide(completedWithReflection(), 'confirm', CLAIM);
    const twice = applyReflectionEvidence(once, { reflectionId: once.reflections[0].id, evidenceId: 'evidence_2' });
    expect(twice.evidence.filter((e) => e.sourceReflectionIds?.length)).toHaveLength(1);
  });

  it('round-trips through export/import; malformed Reflection provenance is rejected', () => {
    const state = decide(completedWithReflection(), 'confirm', CLAIM);
    expect(deserializeCampaign(serializeCampaign(state))).toEqual(state);
    const bad = { ...state, evidence: state.evidence.map((e) => (e.sourceReflectionIds ? { ...e, sourceReflectionIds: [] } : e)) };
    expect(() => deserializeCampaign(JSON.stringify(bad))).toThrow();
  });

  for (const [label, change] of [
    ['PRIVATE Reflection', (s: CampaignState) => privatizeReflectionInCampaign(s, s.reflections[0].id, T(9)).state],
    ['retracted Reflection', (s: CampaignState) => retractReflectionInCampaign(s, s.reflections[0].id, T(9)).state],
    ['PRIVATE source Journal entry', (s: CampaignState) => privatizeJournalEntry(s, 'journal_1', T(9))]
  ] as const) {
    it(`${label} durably retracts the derived Evidence and removes it from provider context`, () => {
      const confirmed = decide(completedWithReflection(), 'confirm', CLAIM);
      const task = { territoryId: 'identity', dimension: confirmed.evidence.at(-1)!.dimension, question: 'Synthetic?' };
      expect(contextTextFragments(compileContext(confirmed, task, '')).join(' ')).toContain('I_CONFIRMED_CLAIM_CANARY');

      const changed = change(confirmed);
      expect(changed.evidence.find((e) => e.id === 'evidence_1')!.status).toBe('retracted');
      expect(createV2ProvenanceVisibility(changed).evidenceIsEligible('evidence_1')).toBe(false);
      expect(contextTextFragments(compileContext(changed, task, '')).join(' ')).not.toContain('I_CONFIRMED_CLAIM_CANARY');
    });
  }

  it('base visibility withholds Reflection-sourced Evidence even before durable retirement runs', () => {
    const confirmed = decide(completedWithReflection(), 'confirm', CLAIM);
    const flipped = { ...confirmed, reflections: confirmed.reflections.map((r) => ({ ...r, privacy: 'private' as const })) };
    expect(createV2ProvenanceVisibility(flipped).evidenceIsEligible('evidence_1')).toBe(false);
  });

  it('a crafted provenance cycle fails closed instead of recursing', () => {
    const confirmed = decide(completedWithReflection(), 'confirm', CLAIM);
    const cyclic: CampaignState = {
      ...confirmed,
      atlasSnapshots: [{ id: 'snap_c', createdAt: T(8), evidenceIds: ['evidence_1'], insightIds: [], contradictionIds: [], synthesis: generateLocalAssessment(createInitialCampaign()) }],
      reflections: confirmed.reflections.map((r) => ({ ...r, sourceKind: 'snapshot' as const, sourceIds: ['snap_c'] }))
    };
    expect(cyclic.atlasSnapshots).toHaveLength(1);
    const visibility = createV2ProvenanceVisibility(cyclic);
    expect(() => visibility.evidenceIsEligible('evidence_1')).not.toThrow();
    expect(visibility.evidenceIsEligible('evidence_1')).toBe(false);
  });
});
