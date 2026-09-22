import type {
  AdventureBeatRole,
  AdventureEncounterKind,
  AdventureKind,
  AdventureTemplate,
  AdventureTemplateBeat
} from '../contracts/adventure';
import type { CampaignState } from '../game/types';
import { A01_INITIAL_BEAT_ID, selectActiveAdventureRun } from './runs';

export interface AdventureRuntimeOptions {
  now?: () => string;
}

export const A03_BEAT_ROLES: readonly AdventureBeatRole[] = [
  'hook',
  'approach',
  'complication',
  'encounter',
  'choice',
  'consequence'
] as const;

const ADVENTURE_KINDS = new Set<AdventureKind>([
  'social-dilemma',
  'investigation',
  'rescue-support',
  'exploration-expedition',
  'negotiation',
  'absurd-comedy-problem',
  'ethical-conflict',
  'creative-building-challenge',
  'memory-echo',
  'relationship-companion-scene',
  'mystery-puzzle',
  'survival-escape',
  'combat-forward-story',
  'pure-fun-wildcard'
]);

const ENCOUNTER_KINDS = new Set<AdventureEncounterKind>(['none', 'social', 'puzzle', 'combat', 'mixed']);

const isNonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;
const stringsAreUnique = (values: readonly string[]) => new Set(values).size === values.length;

function beatIsValid(beat: AdventureTemplateBeat, role: AdventureBeatRole): boolean {
  return isNonEmpty(beat.id)
    && beat.role === role
    && typeof beat.required === 'boolean'
    && Array.isArray(beat.allowedEncounterKinds)
    && beat.allowedEncounterKinds.length > 0
    && beat.allowedEncounterKinds.every((kind) => ENCOUNTER_KINDS.has(kind))
    && stringsAreUnique(beat.allowedEncounterKinds)
    && Array.isArray(beat.exits)
    && beat.exits.every(isNonEmpty)
    && stringsAreUnique(beat.exits);
}

/**
 * A03 mechanical template gate. CT00 may later add content-bank/schema policy,
 * but A03 requires one exact six-role linear skeleton with deterministic exits.
 */
export function validateAdventureTemplate(template: AdventureTemplate): boolean {
  if (!isNonEmpty(template.id)) return false;
  if (!ADVENTURE_KINDS.has(template.kind)) return false;
  if (!Array.isArray(template.validTerritories) || template.validTerritories.length === 0) return false;
  if (!template.validTerritories.every(isNonEmpty) || !stringsAreUnique(template.validTerritories)) return false;
  if (template.learningTarget !== 'none' && template.learningTarget !== 'reflection-eligible') return false;
  if (!Array.isArray(template.requiredInputs) || !template.requiredInputs.every(isNonEmpty) || !stringsAreUnique(template.requiredInputs)) return false;
  if (!Array.isArray(template.memoryOutputs) || !template.memoryOutputs.every(isNonEmpty) || !stringsAreUnique(template.memoryOutputs)) return false;
  if (typeof template.withdrawalAllowed !== 'boolean') return false;
  if (template.reflectionFormId !== undefined && !isNonEmpty(template.reflectionFormId)) return false;
  if (!isNonEmpty(template.cooldownClass)) return false;
  if (!Array.isArray(template.beats) || template.beats.length !== A03_BEAT_ROLES.length) return false;
  if (!template.beats.every((beat, index) => beatIsValid(beat, A03_BEAT_ROLES[index]))) return false;

  const ids = template.beats.map((beat) => beat.id);
  if (!stringsAreUnique(ids)) return false;
  for (let index = 0; index < template.beats.length - 1; index += 1) {
    if (template.beats[index].exits.length !== 1 || template.beats[index].exits[0] !== template.beats[index + 1].id) return false;
  }
  return template.beats[template.beats.length - 1].exits.length === 0;
}

function compatibleActiveRun(state: CampaignState, runId: string, template: AdventureTemplate) {
  if (!validateAdventureTemplate(template)) return null;
  const run = selectActiveAdventureRun(state);
  if (!run || run.id !== runId) return null;
  const seed = state.adventureSeeds.find((candidate) => candidate.id === run.seedId);
  if (!seed || seed.status !== 'started') return null;
  if (seed.kind !== template.kind) return null;
  if (seed.learningTarget !== template.learningTarget) return null;
  if (!template.validTerritories.includes(run.territoryId)) return null;
  if (seed.territoryId !== run.territoryId || seed.locationId !== run.locationId) return null;
  return { run, seed };
}

/** Enter one A01 `pending` run at the validated template hook. */
export function enterAdventureTemplate(
  state: CampaignState,
  runId: string,
  template: AdventureTemplate,
  options: AdventureRuntimeOptions = {}
): CampaignState {
  const compatible = compatibleActiveRun(state, runId, template);
  if (!compatible) return state;
  const hookId = template.beats[0].id;
  if (compatible.run.currentBeatId === hookId) return state;
  if (compatible.run.currentBeatId !== A01_INITIAL_BEAT_ID) return state;

  const at = options.now?.() ?? new Date().toISOString();
  const adventureRuns = state.adventureRuns.map((run) => run.id === runId ? { ...run, currentBeatId: hookId } : run);
  return { ...state, adventureRuns, updatedAt: at };
}

/** Advance exactly one declared deterministic exit. Skip/backward/terminal moves fail closed. */
export function advanceAdventureBeat(
  state: CampaignState,
  runId: string,
  template: AdventureTemplate,
  nextBeatId: string,
  options: AdventureRuntimeOptions = {}
): CampaignState {
  const compatible = compatibleActiveRun(state, runId, template);
  if (!compatible) return state;
  if (compatible.run.currentBeatId === nextBeatId) return state;

  const current = template.beats.find((beat) => beat.id === compatible.run.currentBeatId);
  if (!current || current.role === 'consequence') return state;
  if (current.exits.length !== 1 || current.exits[0] !== nextBeatId) return state;
  if (!template.beats.some((beat) => beat.id === nextBeatId)) return state;

  const at = options.now?.() ?? new Date().toISOString();
  const adventureRuns = state.adventureRuns.map((run) => run.id === runId ? { ...run, currentBeatId: nextBeatId } : run);
  return { ...state, adventureRuns, updatedAt: at };
}

/** Read-only handoff gate for later orchestration; A03 never completes or withdraws a run. */
export function adventureRunReadyForCompletion(state: CampaignState, runId: string, template: AdventureTemplate): boolean {
  const compatible = compatibleActiveRun(state, runId, template);
  if (!compatible) return false;
  const current = template.beats.find((beat) => beat.id === compatible.run.currentBeatId);
  return current?.role === 'consequence' && current.exits.length === 0;
}
