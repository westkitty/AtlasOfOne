import { describe, expect, it } from 'vitest';
import { createAdventureMemory } from '../../src/adventure/memory/records';
import { eligibleAdventureMemories, retrieveEligibleAdventureMemories } from '../../src/adventure/memory/retirement';
import { compareAtlasSnapshots } from '../../src/atlas/compare';
import { evaluateSnapshotEligibility, selectQualifyingSnapshotProvenance } from '../../src/atlas/eligibility';
import { explainInsight } from '../../src/atlas/explain';
import { appendAtlasSnapshot } from '../../src/atlas/history';
import { synthesizeLocalSnapshot } from '../../src/atlas/synthesize';
import { compileContext, contextTextFragments } from '../../src/cartographer/context';
import { simpleScriptedPlayer } from '../../src/combat/content/scriptedPlayer';
import { ENCOUNTER_BANK } from '../../src/combat/content/encounters';
import { applyGameEvent, createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, EvidenceRecord } from '../../src/game/types';
import { appendJournalEntry, createJournalEntry } from '../../src/journal/domain';
import { privatizeJournalEntry, retractJournalEntryFromCampaign } from '../../src/journal/privacy';
import { buildAdventureSeedRequest } from '../../src/knowledge/seedRequest';
import { createV2ProvenanceVisibility, retireIneligibleV2DerivedState } from '../../src/persistence/retirement';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';
import { decideReflection } from '../../src/reflection/domain';
import { privatizeReflectionInCampaign, retractReflectionInCampaign } from '../../src/reflection/propagation';
import { applyReflectionEvidence } from '../../src/slice/evidence';
import { exploreJournalEntry, makeSliceChoice, playSliceCombatRound, startSliceAdventure } from '../../src/slice/loop';

/**
 * Q04: PRIVATE / retraction canary across every downstream consumer.
 *
 * A synthetic campaign is built through the real slice functions. Unique
 * canary strings are planted in the Journal entry, the Reflection response
 * (which becomes Reflection-sourced Evidence), an Insight, a Contradiction and
 * two AdventureMemory cards. For each withdrawal kind, the canary text AND the
 * withdrawn IDs must be absent from every consumer output, before and after an
 * export/import round-trip.
 */

const at = (day: number, minute = 0) => `2026-06-${String(day).padStart(2, '0')}T10:${String(minute).padStart(2, '0')}:00.000Z`;

const CANARY = {
  journal: 'Q4CANARY_JOURNAL_zebra_lighthouse',
  claim: 'Q4CANARY_CLAIM_I_repair_old_radios',
  insight: 'Q4CANARY_INSIGHT_tinkerer_pattern',
  contradiction: 'Q4CANARY_CONTRA_hands_vs_screens',
  memRun: 'Q4CANARY_MEMRUN_brass_compass',
  memRefl: 'Q4CANARY_MEMREFL_quiet_workshop'
} as const;

const ID = {
  journal: 'q4_journal',
  gap: 'q4_gap',
  seed: 'q4_seed',
  run: 'q4_run',
  reflection: 'reflection_q4_run',
  evidence: 'q4_ev_refl',
  insight: 'q4_insight',
  contradiction: 'q4_contra',
  memRun: 'q4_mem_run',
  memRefl: 'q4_mem_refl',
  snap1: 'q4_snap_1',
  snap2: 'q4_snap_2',
  newEvidence: 'q4_ev_new'
} as const;

function legacyEvidence(id: string, dimension: string, territory: string): EvidenceRecord {
  return {
    id, dimension, claim: `Synthetic statement ${id}.`, sourceTurnIds: [], basis: 'explicit', strength: 2,
    territories: [territory], counterEvidenceIds: [], status: 'active', origin: 'player-stated'
  };
}

/** Build the campaign with every canary in place and one Snapshot that cites the Reflection evidence. */
function buildCampaign(): CampaignState {
  const entry = createJournalEntry({ id: ID.journal, createdAt: at(1), text: CANARY.journal, inputMode: 'typed' });
  let state: CampaignState = { ...createInitialCampaign(), journalEntries: appendJournalEntry([], entry) };
  state = exploreJournalEntry(state, { journalEntryId: ID.journal, territoryId: 'identity', gapId: ID.gap, seedId: ID.seed, now: at(1, 1) }).state;
  state = startSliceAdventure(state, { seedId: ID.seed, runId: ID.run, now: at(1, 2) });
  for (let i = 0; i < 40 && state.adventureRuns[0].status === 'active'; i += 1) {
    if (state.activeCombat) {
      const def = ENCOUNTER_BANK.find((d) => d.id === state.activeCombat!.definitionId)!;
      state = playSliceCombatRound(state, { intent: simpleScriptedPlayer(def, state.activeCombat.state as never), now: at(1, 3), consequenceActionId: `q4_cons_${i}` });
    } else {
      state = makeSliceChoice(state, { runId: ID.run, label: 'Go on', now: at(1, 3), actionId: `q4_act_${i}`, observationId: `q4_obs_${i}`, combatId: `q4_combat_${i}` });
    }
  }
  expect(state.reflections.map((r) => r.id)).toEqual([ID.reflection]);
  state = { ...state, reflections: state.reflections.map((r) => decideReflection(r, 'confirm', CANARY.claim)) };
  state = applyReflectionEvidence(state, { reflectionId: ID.reflection, evidenceId: ID.evidence });
  const reflEvidence = state.evidence.find((e) => e.id === ID.evidence)!;
  expect(reflEvidence.claim).toBe(CANARY.claim);

  // Three independent player-stated statements on other dimensions (never withdrawn).
  const others = state.territories
    .flatMap((t) => t.requiredDimensions.map((d) => ({ d, t: t.id })))
    .filter((x) => x.d !== reflEvidence.dimension);
  const legacy = [0, 1, 2].map((i) => legacyEvidence(`q4_ev_legacy_${i}`, others[i * 3].d, others[i * 3].t));

  state = {
    ...state,
    evidence: [...state.evidence, ...legacy],
    insights: [{ id: ID.insight, title: CANARY.insight, summary: CANARY.insight, evidenceIds: [ID.evidence, legacy[0].id], confidence: 'moderate', status: 'confirmed', createdAt: at(1, 5) }],
    contradictions: [{ id: ID.contradiction, claim: CANARY.contradiction, evidenceIds: [ID.evidence, legacy[1].id], status: 'open' }],
    adventureMemories: [
      createAdventureMemory({ id: ID.memRun, type: 'object', summary: CANARY.memRun, triggerTerms: ['compass'], sourceIds: [ID.run] }),
      createAdventureMemory({ id: ID.memRefl, type: 'object', summary: CANARY.memRefl, triggerTerms: ['workshop'], sourceIds: [ID.reflection] })
    ]
  };

  const eligibility = evaluateSnapshotEligibility(state, { trigger: 'explicit-request', requestedAt: at(2) });
  if (!eligibility.eligible) throw new Error(`fixture snapshot ineligible: ${eligibility.reasons.join(',')}`);
  expect(eligibility.request.evidenceIds).toContain(ID.evidence);
  const snap = synthesizeLocalSnapshot(state, { id: ID.snap1, request: eligibility.request });
  return { ...state, atlasSnapshots: appendAtlasSnapshot(state.atlasSnapshots, snap) };
}

interface ConsumerOutputs {
  /** Serialized consumer outputs that must never carry canaries or withdrawn IDs. */
  text: string;
  snapshot2Evidence: string[];
}

/** Run every downstream consumer. A fresh unrelated statement is added so a new Snapshot is possible. */
function runConsumers(state: CampaignState, dimension: string): ConsumerOutputs {
  const extraDim = state.territories[state.territories.length - 1].requiredDimensions.at(-1)!;
  const withNew: CampaignState = {
    ...state,
    evidence: [...state.evidence, legacyEvidence(ID.newEvidence, extraDim, state.territories[state.territories.length - 1].id)]
  };

  const context = compileContext(withNew, { territoryId: 'identity', dimension, question: 'Synthetic question?' }, 'Synthetic answer.');
  const provenance = selectQualifyingSnapshotProvenance(withNew);
  const eligibility = evaluateSnapshotEligibility(withNew, { trigger: 'explicit-request', requestedAt: at(5) });
  if (!eligibility.eligible) throw new Error(`post-withdrawal snapshot ineligible: ${eligibility.reasons.join(',')}`);
  const snap2 = synthesizeLocalSnapshot(withNew, { id: ID.snap2, request: eligibility.request });
  const withSnap2: CampaignState = { ...withNew, atlasSnapshots: appendAtlasSnapshot(withNew.atlasSnapshots, snap2) };
  const comparison = compareAtlasSnapshots(withSnap2, ID.snap1, ID.snap2);
  const { fromSnapshotId: _from, toSnapshotId: _to, ...comparisonBody } = comparison;
  const explanation = explainInsight(withNew, ID.insight);
  const explanationBody = explanation.kind === 'withheld' ? { kind: 'withheld' } : explanation;
  const memories = eligibleAdventureMemories(withNew);
  const retrieved = retrieveEligibleAdventureMemories(withNew, {
    entityIds: [ID.run, ID.reflection], terms: ['compass', 'workshop'], text: 'compass workshop'
  });
  const seedRequest = buildAdventureSeedRequest(withNew, {
    now: at(5), lastExploredAtByTerritory: {}, confirmedChangeSourceIds: [], history: []
  });

  return {
    text: JSON.stringify({
      context, fragments: contextTextFragments(context), provenance, request: eligibility.request,
      snap2, comparisonBody, explanationBody, memories, retrieved, seedRequest
    }),
    snapshot2Evidence: snap2.evidenceIds
  };
}

type Withdrawal = (state: CampaignState, dimension: string) => CampaignState;

interface Case {
  name: string;
  withdraw: Withdrawal;
  canaries: string[];
  withdrawnIds: string[];
  /** IDs whose durable retirement/retraction must survive import. */
  durable: { evidenceRetracted: boolean; gapSeedRetired: boolean; retiredMemories: string[] };
}

const REFLECTION_CHAIN = [ID.reflection, ID.evidence, ID.insight, ID.contradiction, ID.memRefl];
const REFLECTION_CANARIES = [CANARY.claim, CANARY.insight, CANARY.contradiction, CANARY.memRefl];

const CASES: Case[] = [
  {
    name: 'journal PRIVATE',
    withdraw: (s) => privatizeJournalEntry(s, ID.journal, at(3)),
    canaries: [CANARY.journal, CANARY.memRun, ...REFLECTION_CANARIES],
    withdrawnIds: [ID.journal, ID.gap, ID.seed, ID.run, ID.memRun, ...REFLECTION_CHAIN],
    durable: { evidenceRetracted: true, gapSeedRetired: true, retiredMemories: [ID.memRun, ID.memRefl] }
  },
  {
    name: 'journal retract',
    withdraw: (s) => retractJournalEntryFromCampaign(s, ID.journal, at(3)),
    canaries: [CANARY.journal, CANARY.memRun, ...REFLECTION_CANARIES],
    withdrawnIds: [ID.journal, ID.gap, ID.seed, ID.run, ID.memRun, ...REFLECTION_CHAIN],
    durable: { evidenceRetracted: true, gapSeedRetired: true, retiredMemories: [ID.memRun, ID.memRefl] }
  },
  {
    name: 'reflection PRIVATE',
    withdraw: (s) => privatizeReflectionInCampaign(s, ID.reflection, at(3)).state,
    canaries: REFLECTION_CANARIES,
    withdrawnIds: REFLECTION_CHAIN,
    durable: { evidenceRetracted: true, gapSeedRetired: false, retiredMemories: [ID.memRefl] }
  },
  {
    name: 'reflection retract',
    withdraw: (s) => retractReflectionInCampaign(s, ID.reflection, at(3)).state,
    canaries: REFLECTION_CANARIES,
    withdrawnIds: REFLECTION_CHAIN,
    durable: { evidenceRetracted: true, gapSeedRetired: false, retiredMemories: [ID.memRefl] }
  },
  {
    name: 'private topic (dimension)',
    withdraw: (s, dimension) => retireIneligibleV2DerivedState(applyGameEvent(s, { type: 'PRIVATE_TOPIC_ADDED', topic: dimension } as never)),
    canaries: [CANARY.claim, CANARY.insight, CANARY.contradiction],
    withdrawnIds: [ID.evidence, ID.insight, ID.contradiction],
    durable: { evidenceRetracted: false, gapSeedRetired: false, retiredMemories: [] }
  }
];

function assertWithdrawn(state: CampaignState, dimension: string, c: Case) {
  const out = runConsumers(state, dimension);
  for (const canary of c.canaries) expect(out.text, `canary ${canary}`).not.toContain(canary);
  for (const id of c.withdrawnIds) expect(out.text, `withdrawn id ${id}`).not.toContain(`"${id}"`);
  expect(out.snapshot2Evidence).not.toContain(ID.evidence);

  const v = createV2ProvenanceVisibility(state);
  expect(v.evidenceIsEligible(ID.evidence)).toBe(false);
  expect(v.insightIsEligible(ID.insight)).toBe(false);
  expect(v.contradictionIsEligible(ID.contradiction)).toBe(false);
  expect(v.atlasSnapshotIsEligible(ID.snap1)).toBe(false);
  if (c.withdrawnIds.includes(ID.reflection)) expect(v.reflectionIsEligible(ID.reflection)).toBe(false);
  if (c.withdrawnIds.includes(ID.gap)) {
    expect(v.knowledgeGapIsStructurallyVisible(ID.gap)).toBe(false);
    expect(v.adventureSeedIsStructurallyVisible(ID.seed)).toBe(false);
  }
  for (const memoryId of [ID.memRun, ID.memRefl]) {
    if (c.withdrawnIds.includes(memoryId)) expect(v.adventureMemoryIsEligible(memoryId)).toBe(false);
  }

  const evidence = state.evidence.find((e) => e.id === ID.evidence)!;
  if (c.durable.evidenceRetracted) expect(evidence.status).toBe('retracted');
  if (c.durable.gapSeedRetired) {
    expect(state.knowledgeGaps.find((g) => g.id === ID.gap)!.status).toBe('retired');
    expect(state.adventureSeeds.find((s) => s.id === ID.seed)!.status).toBe('retired');
  }
  for (const memoryId of c.durable.retiredMemories) {
    expect(state.adventureMemories.find((m) => m.id === memoryId)!.status).toBe('retired');
  }
}

describe('Q04 PRIVATE/retraction canary across downstream consumers', () => {
  const base = buildCampaign();
  const dimension = base.evidence.find((e) => e.id === ID.evidence)!.dimension;

  it('control: before withdrawal the canaries and IDs DO reach consumers (test is not vacuous)', () => {
    const v = createV2ProvenanceVisibility(base);
    expect(v.evidenceIsEligible(ID.evidence)).toBe(true);
    expect(v.atlasSnapshotIsEligible(ID.snap1)).toBe(true);
    expect(v.adventureMemoryIsEligible(ID.memRun)).toBe(true);
    expect(v.adventureMemoryIsEligible(ID.memRefl)).toBe(true);
    const context = JSON.stringify(compileContext(base, { territoryId: 'identity', dimension, question: 'q?' }, 'a'));
    expect(context).toContain(CANARY.claim);
    expect(context).toContain(CANARY.insight);
    expect(context).toContain(CANARY.contradiction);
    expect(JSON.stringify(eligibleAdventureMemories(base))).toContain(CANARY.memRun);
    expect(explainInsight(base, ID.insight).kind).toBe('explained');
    // The journal canary never enters derived records even while eligible.
    const { journalEntries: _j, ...derived } = base;
    expect(JSON.stringify(derived)).not.toContain(CANARY.journal);
  });

  describe.each(CASES)('$name', (c) => {
    const withdrawn = c.withdraw(base, dimension);

    it('canaries and withdrawn IDs are absent from every consumer output', () => {
      assertWithdrawn(withdrawn, dimension, c);
    });

    it('nothing withdrawn regains authority after export/import round-trip', () => {
      const imported = deserializeCampaign(serializeCampaign(withdrawn));
      assertWithdrawn(imported, dimension, c);
      // Re-running retirement on the imported state changes nothing.
      expect(retireIneligibleV2DerivedState(imported)).toEqual(imported);
    });

    it('a withdrawn journal or seed cannot be re-explored or restarted', () => {
      if (!c.withdrawnIds.includes(ID.journal)) return;
      expect(() => exploreJournalEntry(withdrawn, {
        journalEntryId: ID.journal, territoryId: 'identity', gapId: 'q4_gap_again', seedId: 'q4_seed_again', now: at(4)
      })).toThrow();
      expect(() => startSliceAdventure(withdrawn, { seedId: ID.seed, runId: 'q4_run_again', now: at(4) })).toThrow();
    });

    it('re-applying Reflection evidence after withdrawal creates nothing new', () => {
      const again = applyReflectionEvidence(withdrawn, { reflectionId: ID.reflection, evidenceId: 'q4_ev_again' });
      expect(again.evidence.some((e) => e.id === 'q4_ev_again')).toBe(false);
    });
  });
});
