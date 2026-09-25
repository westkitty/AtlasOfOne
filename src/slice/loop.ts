import { proposeReflectionHandoff } from '../adventure/reflectionHandoff';
import { recordAdventureAction, recordAdventureObservation } from '../adventure/actions';
import { nextAdventureBeat, type AdventureBeat } from '../adventure/beats';
import { CORE_ADVENTURE_TEMPLATES } from '../adventure/content/templates';
import { completeAdventureRun, withdrawAdventureRun } from '../adventure/outcomes';
import { reduceAdventureRun, startAdventureFromSeed } from '../adventure/run';
import type { AdventureRun, AdventureSeed } from '../adventure/schema';
import { admitAdventureSeed, adventureSeedIsEligible, createAdventureSeedFromRequest } from '../adventure/seeds';
import { localReflectionWording } from '../cartographer/fallbacks/reflectionWording';
import { ENCOUNTER_BANK } from '../combat/content/encounters';
import { createActiveCombatRecord, resumeActiveCombat } from '../combat/persistence';
import { playRound, startEncounter, type CombatPlayerIntent } from '../combat/runner';
import type { CombatDefinition, CombatOutcome } from '../combat/types';
import type { CampaignState } from '../game/types';
import { linkJournalEntry } from '../journal/links';
import { buildJournalCuriosityGap } from '../knowledge/curiosity';
import { buildAdventureSeedRequest } from '../knowledge/seedRequest';
import { createV2ProvenanceVisibility } from '../persistence/retirement';
import { createReflectionRecord } from '../reflection/domain';

/**
 * Vertical-slice orchestration (I00-I04).
 *
 * Every function is pure: (state, input) -> state. IDs and time are injected so
 * the loop is deterministic and testable. This module composes existing domain
 * boundaries; it adds no mechanics of its own:
 *
 * Journal -> explicit "explore this" -> curiosity gap (K02) -> seed (K07/A00)
 * -> run (A01) -> choices (A02) -> encounter (C-lane) -> consequence
 * -> optional Reflection candidate (A10) -> pending ReflectionRecord (RF00).
 *
 * Nothing here creates Evidence, XP or rewards. A fictional choice is recorded
 * as an unreflected AdventureObservation; only Greyson's Reflection decision,
 * through the existing RF flow, may change what Atlas believes.
 */

export const CURIOSITY_SUMMARY = 'Something from a journal entry worth exploring.';

function stableIndex(seed: string, size: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % size;
}

function templateForTerritory(territoryId: string) {
  return [...CORE_ADVENTURE_TEMPLATES]
    .sort((left, right) => left.id.localeCompare(right.id))
    .find((template) =>
      template.optionalKnowledgeGapTarget
      && template.kind !== 'pure-fun'
      && template.validTerritories.includes(territoryId));
}

function requireSeed(state: CampaignState, seedId: string): AdventureSeed {
  const seed = state.adventureSeeds.find((item) => item.id === seedId);
  if (!seed) throw new Error(`Unknown AdventureSeed id: ${seedId}`);
  return seed;
}

function requireRun(state: CampaignState, runId: string): AdventureRun {
  const run = state.adventureRuns.find((item) => item.id === runId);
  if (!run) throw new Error(`Unknown AdventureRun id: ${runId}`);
  return run;
}

function replace<T extends { id: string }>(items: readonly T[], next: T): T[] {
  return items.map((item) => (item.id === next.id ? next : item));
}

/** Journal entry that seeded this run through a curiosity gap, if any. */
function sourceJournalEntryId(state: CampaignState, seed: AdventureSeed): string | undefined {
  for (const gapId of seed.sourceGapIds) {
    const gap = state.knowledgeGaps.find((item) => item.id === gapId);
    const journalId = gap?.sourceJournalEntryIds[0];
    if (journalId) return journalId;
  }
  return undefined;
}

// ---------------------------------------------------------------- I00

export interface ExploreJournalEntryInput {
  journalEntryId: string;
  territoryId: string;
  gapId: string;
  seedId: string;
  now: string;
}

/**
 * I00: Greyson explicitly asks to explore a Journal entry.
 *
 * Explicit curiosity outranks automatic ranking: the seed request is built
 * from this gap only (K07 still applies K05 eligibility, so a PRIVATE or
 * retracted entry can never seed anything). Dimensions are the territory's
 * uncovered dimensions — structural, never read from the entry's text.
 */
export function exploreJournalEntry(
  state: CampaignState,
  input: ExploreJournalEntryInput
): { state: CampaignState; seed: AdventureSeed } {
  const territory = state.territories.find((item) => item.id === input.territoryId);
  if (!territory) throw new Error(`Unknown territory id: ${input.territoryId}`);
  const uncovered = territory.requiredDimensions.filter((dim) => !territory.coveredDimensions.includes(dim));
  const dimensionIds = uncovered.length > 0 ? uncovered : territory.requiredDimensions;

  const gap = buildJournalCuriosityGap(state, {
    id: input.gapId,
    journalEntryId: input.journalEntryId,
    territoryIds: [input.territoryId],
    dimensionIds,
    summary: CURIOSITY_SUMMARY
  });
  const knowledgeGaps = state.knowledgeGaps.some((item) => item.id === gap.id)
    ? state.knowledgeGaps
    : [...state.knowledgeGaps, gap];

  const template = templateForTerritory(input.territoryId);
  const request = buildAdventureSeedRequest(
    { ...state, knowledgeGaps: knowledgeGaps.filter((item) => item.id === gap.id) },
    {
      now: input.now,
      lastExploredAtByTerritory: {},
      confirmedChangeSourceIds: [],
      history: [],
      ...(template ? { kind: template.kind } : {})
    }
  );
  if (!request) throw new Error('This Journal entry is not eligible to seed an adventure.');

  const premise = template?.beats.find((beat) => beat.beat === 'hook')?.intent ?? 'A path opens nearby.';
  const candidate = createAdventureSeedFromRequest(request, { id: input.seedId, premise });
  const admitted = admitAdventureSeed(state.adventureSeeds, candidate);

  return {
    state: {
      ...state,
      knowledgeGaps: knowledgeGaps.map((item) =>
        item.id === gap.id && item.status === 'open' ? { ...item, status: 'seeded' as const } : item),
      adventureSeeds: admitted.seeds,
      updatedAt: input.now
    },
    seed: admitted.seed
  };
}

// ---------------------------------------------------------------- I01

/** I01: start an adventure from an eligible available seed (atomic seed flip). */
export function startSliceAdventure(
  state: CampaignState,
  input: { seedId: string; runId: string; now: string }
): CampaignState {
  const seed = requireSeed(state, input.seedId);
  if (!adventureSeedIsEligible(state, seed)) throw new Error(`AdventureSeed ${seed.id} is not eligible to start.`);
  if (state.adventureRuns.some((run) => run.status === 'active')) {
    throw new Error('Another adventure is already in progress.');
  }
  const started = startAdventureFromSeed(seed, { id: input.runId, startedAt: input.now });
  let next: CampaignState = {
    ...state,
    adventureSeeds: replace(state.adventureSeeds, started.seed),
    adventureRuns: [...state.adventureRuns, started.run],
    updatedAt: input.now
  };
  const journalId = sourceJournalEntryId(next, started.seed);
  if (journalId) next = linkJournalEntry(next, journalId, { kind: 'adventure', id: started.run.id });
  return next;
}

/** Deterministic encounter choice: prefer the seed template's MVP objectives. */
export function encounterForRun(run: AdventureRun, seed: AdventureSeed): CombatDefinition {
  const template = templateForTerritory(seed.territoryId);
  const wanted = new Set(template?.encounterObjectives ?? []);
  const preferred = ENCOUNTER_BANK.filter((definition) => wanted.has(definition.objective));
  const pool = preferred.length > 0 ? preferred : ENCOUNTER_BANK;
  return pool[stableIndex(run.id, pool.length)];
}

// ---------------------------------------------------------------- I02 / I03

export interface SliceChoiceInput {
  runId: string;
  actionId: string;
  observationId: string;
  label: string;
  now: string;
  combatId: string;
}

function advanceOrFinish(
  state: CampaignState,
  run: AdventureRun,
  seed: AdventureSeed,
  now: string,
  reflectionId: string
): CampaignState {
  const upcoming = nextAdventureBeat(seed, run.currentBeat);
  const lastPlayable: AdventureBeat = seed.learningTarget === 'none' ? 'choice-consequence' : 'optional-reflection';

  if (upcoming === null || run.currentBeat === lastPlayable || upcoming === 'optional-reflection') {
    // Finish: optional-reflection is an offer made after the story, not a beat to grind.
    const ready = upcoming === 'optional-reflection'
      ? reduceAdventureRun(run, seed, { type: 'advance', at: now })
      : run;
    const done = completeAdventureRun(ready, seed, { at: now });
    let next: CampaignState = { ...state, adventureRuns: replace(state.adventureRuns, done.run), updatedAt: now };
    next = offerReflection(next, done.run, seed, reflectionId, now);
    return next;
  }

  const advanced = reduceAdventureRun(run, seed, { type: 'advance', at: now });
  return { ...state, adventureRuns: replace(state.adventureRuns, advanced), updatedAt: now };
}

/**
 * I02: a story choice at the current beat. At the encounter beat the choice
 * opens the deterministic encounter instead of advancing.
 */
export function makeSliceChoice(state: CampaignState, input: SliceChoiceInput): CampaignState {
  const run = requireRun(state, input.runId);
  if (run.status !== 'active') throw new Error(`AdventureRun ${run.id} is not active.`);
  if (state.activeCombat) throw new Error('Resolve the current encounter first.');
  const seed = requireSeed(state, run.seedId);

  const action = recordAdventureAction(run, {
    id: input.actionId,
    createdAt: input.now,
    kind: run.currentBeat === 'encounter' ? 'combat' : 'do',
    text: input.label
  });
  const observation = recordAdventureObservation(run, [action], {
    id: input.observationId,
    sourceActionIds: [action.id],
    observation: `In the story, chose: ${input.label}`
  });
  let next: CampaignState = {
    ...state,
    adventureActions: [...state.adventureActions, action],
    adventureObservations: [...state.adventureObservations, observation],
    updatedAt: input.now
  };

  if (run.currentBeat === 'encounter') {
    const definition = encounterForRun(run, seed);
    const combatState = startEncounter(definition);
    return {
      ...next,
      activeCombat: createActiveCombatRecord({
        id: input.combatId,
        definition,
        state: combatState,
        startedAt: input.now,
        adventureRunId: run.id
      })
    };
  }
  return advanceOrFinish(next, run, seed, input.now, `reflection_${run.id}`);
}

const COMBAT_CONSEQUENCE: Record<CombatOutcome, string> = {
  victory: 'The way ahead is clear.',
  pacified: 'The standoff eased without a fight.',
  escaped: 'You slipped away and the story moved on.',
  defeat: 'You were knocked back, and the story found another way forward.',
  story: 'The moment passed, and the story turned.'
};

/**
 * I02/I03: one Combat round. When the encounter resolves, its deterministic
 * outcome becomes a consequence action in the run (fail-forward: every
 * outcome, including defeat or LEAVE, continues the story) and the adventure
 * advances. No XP, rewards or Evidence are created.
 */
export function playSliceCombatRound(
  state: CampaignState,
  input: { intent: CombatPlayerIntent; now: string; consequenceActionId: string }
): CampaignState {
  const record = state.activeCombat;
  if (!record) throw new Error('No encounter in progress.');
  const resumed = resumeActiveCombat(record, ENCOUNTER_BANK);
  if (!resumed.ok) {
    // Content changed under a saved encounter: fail forward instead of guessing HP.
    return { ...state, activeCombat: null, updatedAt: input.now };
  }
  const nextCombat = playRound(resumed.definition, resumed.state, input.intent);
  if (nextCombat.phase !== 'resolved' || !nextCombat.outcome) {
    return { ...state, activeCombat: { ...record, state: nextCombat }, updatedAt: input.now };
  }

  let next: CampaignState = { ...state, activeCombat: null, updatedAt: input.now };
  const runId = record.adventureRunId;
  if (!runId) return next;
  const run = requireRun(next, runId);
  if (run.status !== 'active') return next;
  const seed = requireSeed(next, run.seedId);
  const consequence = recordAdventureAction(run, {
    id: input.consequenceActionId,
    createdAt: input.now,
    kind: 'combat',
    text: COMBAT_CONSEQUENCE[nextCombat.outcome]
  });
  next = { ...next, adventureActions: [...next.adventureActions, consequence] };
  return advanceOrFinish(next, run, seed, input.now, `reflection_${run.id}`);
}

// ---------------------------------------------------------------- I04

/**
 * I04: after a completed, reflection-eligible run, offer ONE pending
 * Reflection over the run's unreflected observations. It is only a question;
 * Greyson decides (confirm/partial/reject/uncertain/revise/private) in the
 * existing RF01 UI. Pure-fun or observation-less runs offer nothing.
 */
function offerReflection(
  state: CampaignState,
  run: AdventureRun,
  seed: AdventureSeed,
  reflectionId: string,
  now: string
): CampaignState {
  const visibility = createV2ProvenanceVisibility(state);
  const candidate = proposeReflectionHandoff(run, seed, state.adventureObservations, {
    observationIsEligible: visibility.adventureObservationIsEligible
  });
  if (!candidate) return state;
  if (state.reflections.some((record) => record.id === reflectionId)) return state;

  const reflection = createReflectionRecord({
    id: reflectionId,
    sourceKind: 'adventure',
    sourceIds: [...candidate.observationIds],
    question: localReflectionWording(run.id).question,
    createdAt: now
  });
  let next: CampaignState = { ...state, reflections: [...state.reflections, reflection] };
  const journalId = sourceJournalEntryId(next, seed);
  if (journalId) {
    const entry = next.journalEntries.find((item) => item.id === journalId);
    if (entry && entry.status === 'active') {
      next = linkJournalEntry(next, journalId, { kind: 'reflection', id: reflection.id });
    }
  }
  return next;
}

/** A05 via the slice: step away at any beat; the story carries on, nothing is lost or judged. */
export function withdrawSliceAdventure(
  state: CampaignState,
  input: { runId: string; now: string }
): CampaignState {
  const run = requireRun(state, input.runId);
  const seed = requireSeed(state, run.seedId);
  const done = withdrawAdventureRun(run, seed, { at: input.now, cause: 'chose-to-leave' });
  return {
    ...state,
    adventureRuns: replace(state.adventureRuns, done.run),
    activeCombat: state.activeCombat?.adventureRunId === run.id ? null : state.activeCombat,
    updatedAt: input.now
  };
}

export function selectActiveAdventure(state: CampaignState): { run: AdventureRun; seed: AdventureSeed } | undefined {
  const run = state.adventureRuns.find((item) => item.status === 'active');
  if (!run) return undefined;
  const seed = state.adventureSeeds.find((item) => item.id === run.seedId);
  return seed ? { run, seed } : undefined;
}
