import type { AdventureRun, AdventureTemplate } from '../contracts/adventure';
import type { CombatCommand, CombatOutcome } from '../contracts/combat';
import {
  applyCombatCommand,
  createCombatSession,
  dehydrateCombatSession,
  hydrateCombatSession,
  type CombatSession,
  type CommandOptions,
  type SessionIssueCode
} from '../combat/session';
import type { CampaignState } from '../game/types';
import { localEncounterForDefinition, localEncounterForRun, type LocalEncounter } from './encounters';
import { localFallbackTemplateForSeed, renderLocalAdventureScene, type LocalAdventureScene } from './fallback';
import { completeAdventureRun, selectActiveAdventureRun } from './runs';
import { advanceAdventureBeat } from './runtime';

/**
 * I02/I03 local play loop: beat -> encounter -> deterministic combat ->
 * fictional observation -> next beat -> completion.
 *
 * Authority: every transition here is deterministic TypeScript. Nothing reads
 * Journal text, evidence, reflections or provider output. Combat results
 * become an AdventureAction + an `unreflected` AdventureObservation — fiction,
 * never evidence; only a later explicit Reflection can mean anything more.
 */
export interface PlayOptions {
  now?: () => string;
  /** The beat the player saw when pressing Continue; a mismatch (double tap, stale render) is a no-op. */
  expectedBeatId?: string;
}

export interface AdventurePlayView {
  run: AdventureRun;
  template: AdventureTemplate;
  scene: LocalAdventureScene;
  encounter: LocalEncounter;
  combat: CombatSession | null;
  encounterResolved: boolean;
  outcomeCopy?: string;
}

export const encounterActionId = (runId: string) => `${runId}:encounter-action`;
export const encounterObservationId = (runId: string) => `${runId}:encounter-observation`;

function templateFor(state: CampaignState, run: AdventureRun): AdventureTemplate | null {
  const seed = state.adventureSeeds.find((candidate) => candidate.id === run.seedId);
  return seed ? localFallbackTemplateForSeed(seed) : null;
}

export function activeCombatSession(state: CampaignState): CombatSession | null {
  return hydrateCombatSession(state.combatDefinitions, state.activeCombat, state.activeCombatRuntime);
}

export function adventurePlayView(state: CampaignState): AdventurePlayView | null {
  const run = selectActiveAdventureRun(state);
  if (!run) return null;
  const template = templateFor(state, run);
  if (!template) return null;
  const scene = renderLocalAdventureScene(state, run.id, template);
  if (!scene) return null;
  const combat = activeCombatSession(state);
  const runCombat = combat && combat.definition.encounterId === run.id ? combat : null;
  const observation = state.adventureObservations.find((entry) => entry.id === encounterObservationId(run.id));
  return {
    run, template, scene,
    encounter: localEncounterForRun(run.id),
    combat: runCombat,
    encounterResolved: Boolean(observation),
    ...(observation ? { outcomeCopy: observation.observation } : {})
  };
}

function nextBeatId(template: AdventureTemplate, beatId: string): string | undefined {
  return template.beats.find((beat) => beat.id === beatId)?.exits[0];
}

/**
 * Advance one beat. The encounter beat cannot be skipped until its encounter
 * resolved (win, calm, step away or fail-forward). At the terminal beat this
 * completes the run. Anything else is a no-op returning the same state.
 */
export function continueAdventure(state: CampaignState, runId: string, options: PlayOptions = {}): CampaignState {
  const view = adventurePlayView(state);
  if (!view || view.run.id !== runId || view.combat) return state;
  if (options.expectedBeatId !== undefined && options.expectedBeatId !== view.run.currentBeatId) return state;
  if (view.scene.terminal) return completeAdventureRun(state, runId, options);
  if (view.scene.role === 'encounter' && !view.encounterResolved) return state;
  const next = nextBeatId(view.template, view.run.currentBeatId);
  return next ? advanceAdventureBeat(state, runId, view.template, next, options) : state;
}

/** Start the run's one deterministic encounter. Idempotent; refuses outside the encounter beat. */
export function beginAdventureEncounter(state: CampaignState, runId: string): CampaignState {
  const view = adventurePlayView(state);
  if (!view || view.run.id !== runId || view.scene.role !== 'encounter' || view.encounterResolved) return state;
  if (view.combat || state.activeCombat) return state;
  const beat = view.template.beats.find((entry) => entry.id === view.run.currentBeatId);
  if (!beat?.allowedEncounterKinds.includes('combat')) return state;
  const { definition, scenario } = view.encounter.build(runId);
  const created = createCombatSession(definition, scenario);
  if (!created.ok) return state;
  return {
    ...state,
    combatDefinitions: [...state.combatDefinitions.filter((entry) => entry.id !== definition.id), definition],
    activeCombat: created.session.state,
    activeCombatRuntime: dehydrateCombatSession(created.session)
  };
}

export interface AdventureCombatResult {
  state: CampaignState;
  accepted: boolean;
  issue?: SessionIssueCode;
  detail?: string;
}

function outcomeText(encounter: LocalEncounter | undefined, outcome: CombatOutcome): string {
  return encounter?.outcomeCopy[outcome] ?? 'The encounter ended.';
}

/**
 * Apply one combat command to the persisted active combat. On resolution the
 * combat is cleared, one fictional action/observation pair is recorded, and
 * the run moves past the encounter beat. Stale/duplicate submissions are
 * refused by the session's expectedTurn guard.
 */
export function commandAdventureCombat(
  state: CampaignState,
  command: CombatCommand,
  commandOptions: CommandOptions = {},
  options: PlayOptions = {}
): AdventureCombatResult {
  const session = activeCombatSession(state);
  if (!session) return { state, accepted: false, issue: 'invalid-session' };
  const result = applyCombatCommand(session, command, commandOptions);
  if (!result.accepted) return { state, accepted: false, issue: result.issue, ...(result.detail ? { detail: result.detail } : {}) };

  const next = result.session;
  if (next.state.phase !== 'resolved') {
    return { state: { ...state, activeCombat: next.state, activeCombatRuntime: dehydrateCombatSession(next) }, accepted: true };
  }

  const runId = next.definition.encounterId;
  const at = options.now?.() ?? new Date().toISOString();
  const encounter = localEncounterForDefinition(next.definition);
  const outcome = next.state.outcome!;
  const actionId = encounterActionId(runId);
  const observationId = encounterObservationId(runId);
  let resolved: CampaignState = {
    ...state,
    combatDefinitions: state.combatDefinitions.filter((entry) => entry.id !== next.definition.id),
    activeCombat: null,
    activeCombatRuntime: null,
    adventureActions: state.adventureActions.some((entry) => entry.id === actionId) ? state.adventureActions : [
      ...state.adventureActions,
      { id: actionId, runId, createdAt: at, kind: outcome === 'escaped' ? 'leave' : 'combat', text: `Faced ${encounter?.name ?? 'an encounter'}.` }
    ],
    adventureObservations: state.adventureObservations.some((entry) => entry.id === observationId) ? state.adventureObservations : [
      ...state.adventureObservations,
      { id: observationId, runId, sourceActionIds: [actionId], observation: outcomeText(encounter, outcome), status: 'unreflected' }
    ],
    updatedAt: at
  };

  const view = adventurePlayView(resolved);
  if (view && view.run.id === runId && view.scene.role === 'encounter') {
    const after = nextBeatId(view.template, view.run.currentBeatId);
    if (after) resolved = advanceAdventureBeat(resolved, runId, view.template, after, options);
  }
  return { state: resolved, accepted: true };
}
