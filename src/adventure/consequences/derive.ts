import { z } from 'zod';
import type { CombatOutcome } from '../../combat/types';
import type { CampaignState } from '../../game/types';
import { CORE_ADVENTURE_TEMPLATES } from '../content/templates';
import type { AdventureTemplate } from '../content/templateSchema';
import { createAdventureMemory, type AdventureMemoryType } from '../memory/records';
import { ADVENTURE_EXIT_CAUSES, type AdventureExitCause } from '../outcomes';
import { adventureMemorySchema, type AdventureRun, type AdventureSeed } from '../schema';

/**
 * A07 world consequence output contract.
 *
 * `deriveAdventureConsequences(state, runId)` is a pure, deterministic
 * function of a terminal run's STRUCTURE: its seed's template memoryOutputs,
 * its resolution/exit cause, and the combat outcome recorded as a system
 * consequence action. It never reads journal text, observation text or
 * free-typed action text, and it manufactures no XP, rewards or Evidence.
 *
 * Every memory card's sourceIds are exactly [runId, seedId], so the N04
 * provenance gate (createV2ProvenanceVisibility) governs recurrence: a run
 * whose seed traces to a PRIVATE/retracted journal entry yields cards that
 * are never eligible for context.
 */

export const COMBAT_OUTCOMES = ['victory', 'pacified', 'escaped', 'defeat', 'story'] as const satisfies readonly CombatOutcome[];

/**
 * Mirror of the slice's system-authored combat consequence lines
 * (src/slice/loop.ts COMBAT_CONSEQUENCE). Only an exact match is recognised;
 * anything else (including any free-typed text) yields no combat outcome.
 */
export const COMBAT_CONSEQUENCE_LINES: Readonly<Record<CombatOutcome, string>> = Object.freeze({
  victory: 'The way ahead is clear.',
  pacified: 'The standoff eased without a fight.',
  escaped: 'You slipped away and the story moved on.',
  defeat: 'You were knocked back, and the story found another way forward.',
  story: 'The moment passed, and the story turned.'
});

const FLAG_KEY = /^[a-z0-9][a-z0-9_:.-]{0,159}$/;
const STABLE_ID = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export const worldFlagSchema = z.object({
  key: z.string().regex(FLAG_KEY),
  runId: z.string().min(1)
}).strict();
export type WorldFlag = z.infer<typeof worldFlagSchema>;

export const npcAvailabilityChangeSchema = z.object({
  npcId: z.string().regex(STABLE_ID),
  availability: z.enum(['present', 'absent']),
  runId: z.string().min(1)
}).strict();
export type NpcAvailabilityChange = z.infer<typeof npcAvailabilityChangeSchema>;

export const adventureConsequencesSchema = z.object({
  runId: z.string().min(1),
  seedId: z.string().min(1),
  territoryId: z.string().min(1),
  templateId: z.string().nullable(),
  resolution: z.enum(['completed', 'withdrawn']),
  cause: z.union([z.enum(ADVENTURE_EXIT_CAUSES), z.literal('finished')]),
  combatOutcome: z.enum(COMBAT_OUTCOMES).nullable(),
  worldFlags: z.array(worldFlagSchema),
  npcAvailability: z.array(npcAvailabilityChangeSchema),
  memoryCards: z.array(adventureMemorySchema.strict()),
  xpDelta: z.literal(0),
  rewardIds: z.array(z.never()).length(0),
  evidenceIds: z.array(z.never()).length(0),
  observationIds: z.array(z.never()).length(0)
}).strict();
export type AdventureConsequences = z.infer<typeof adventureConsequencesSchema>;

export interface DeriveConsequencesOptions {
  /** Exit cause for a withdrawn run (runs do not persist it). Default 'chose-to-leave', as the slice uses. */
  exitCause?: AdventureExitCause;
}

/** Seeds carry a kind, and core template kinds are unique; resolve by kind. */
export function templateForSeed(seed: AdventureSeed): AdventureTemplate | undefined {
  return CORE_ADVENTURE_TEMPLATES.find((template) => template.kind === seed.kind);
}

/** Last recognised combat outcome among the run's system combat actions, or null. */
export function combatOutcomeForRun(state: CampaignState, runId: string): CombatOutcome | null {
  const byLine = new Map(Object.entries(COMBAT_CONSEQUENCE_LINES).map(([outcome, line]) => [line, outcome as CombatOutcome]));
  const actions = state.adventureActions
    .filter((action) => action.runId === runId && action.kind === 'combat')
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  let outcome: CombatOutcome | null = null;
  for (const action of actions) outcome = byLine.get(action.text) ?? outcome;
  return outcome;
}

/** Which of the template's memory outputs survive a given ending. */
function memoryTypesFor(
  template: AdventureTemplate,
  resolution: 'completed' | 'withdrawn',
  cause: AdventureExitCause | 'finished'
): AdventureMemoryType[] {
  const outputs = [...new Set(template.memoryOutputs)];
  if (resolution === 'completed') return outputs;
  // Stepping away still remembers who and where; the rest of the story did not happen.
  const kept: AdventureMemoryType[] = outputs.filter((type) => type === 'character' || type === 'place');
  if (cause === 'paused-for-later' && !kept.includes('promise')) kept.push('promise');
  return kept;
}

const ENDING_PHRASE: Record<AdventureExitCause | 'finished', string> = {
  finished: 'seen through to the end',
  'chose-to-leave': 'stepped away from',
  escaped: 'escaped from',
  overpowered: 'carried on after',
  'paused-for-later': 'left open for later'
};

const TYPE_PHRASE: Record<AdventureMemoryType, string> = {
  character: 'A character met',
  place: 'A place visited',
  event: 'Something that happened',
  relationship: 'A bond formed',
  promise: 'A thread still open',
  object: 'An object found'
};

/** Structural summary: template title + territory + ending; never journal/action/observation text. */
function structuralSummary(type: AdventureMemoryType, template: AdventureTemplate, territoryId: string, cause: AdventureExitCause | 'finished'): string {
  return `${TYPE_PHRASE[type]} in "${template.title}" (${territoryId}), ${ENDING_PHRASE[cause]}.`;
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'x';
}

export function adventureMemoryCardId(runId: string, type: AdventureMemoryType): string {
  return `mem_${runId}_${type}`;
}

function requireTerminalRun(state: CampaignState, runId: string): { run: AdventureRun; seed: AdventureSeed } {
  const run = state.adventureRuns.find((item) => item.id === runId);
  if (!run) throw new Error(`Unknown AdventureRun id: ${runId}`);
  if (run.status === 'active') throw new Error(`AdventureRun ${runId} is still active; consequences need a completed or withdrawn run.`);
  const seed = state.adventureSeeds.find((item) => item.id === run.seedId);
  if (!seed) throw new Error(`AdventureRun ${runId} references unknown seed ${run.seedId}.`);
  return { run, seed };
}

export function deriveAdventureConsequences(
  state: CampaignState,
  runId: string,
  options: DeriveConsequencesOptions = {}
): AdventureConsequences {
  const { run, seed } = requireTerminalRun(state, runId);
  const resolution = run.status === 'complete' ? 'completed' : 'withdrawn';
  if (options.exitCause !== undefined && !(ADVENTURE_EXIT_CAUSES as readonly string[]).includes(options.exitCause)) {
    throw new Error(`Unknown adventure exit cause: ${String(options.exitCause)}`);
  }
  const cause: AdventureExitCause | 'finished' = resolution === 'completed' ? 'finished' : (options.exitCause ?? 'chose-to-leave');
  const combatOutcome = combatOutcomeForRun(state, run.id);
  const template = templateForSeed(seed);
  const territory = slug(run.territoryId);

  const flagKeys = [
    `territory:${territory}:visited`,
    `run:${slug(run.id)}:${resolution}`,
    ...(template ? [`territory:${territory}:template:${template.id}:${resolution}`] : []),
    ...(combatOutcome ? [`territory:${territory}:encounter:${combatOutcome}`] : []),
    ...(cause === 'paused-for-later' ? [`run:${slug(run.id)}:thread-open`] : [])
  ];
  const worldFlags = [...new Set(flagKeys)].sort().map((key) => ({ key, runId: run.id }));

  // Characters stay in the world (fail-forward: nobody is lost permanently).
  // After an escape they are simply not around right now.
  const availability = combatOutcome === 'escaped' || cause === 'escaped' ? 'absent' : 'present';
  const npcAvailability = run.characterIds
    .filter((id) => STABLE_ID.test(id))
    .sort()
    .map((npcId) => ({ npcId, availability, runId: run.id } as const));

  const memoryCards = template
    ? memoryTypesFor(template, resolution, cause).sort().map((type) => createAdventureMemory({
      id: adventureMemoryCardId(run.id, type),
      type,
      summary: structuralSummary(type, template, run.territoryId, cause),
      triggerTerms: [run.territoryId, template.id, template.kind, type],
      sourceIds: [run.id, seed.id]
    }))
    : [];

  return adventureConsequencesSchema.parse({
    runId: run.id,
    seedId: seed.id,
    territoryId: run.territoryId,
    templateId: template?.id ?? null,
    resolution,
    cause,
    combatOutcome,
    worldFlags,
    npcAvailability,
    memoryCards,
    xpDelta: 0,
    rewardIds: [],
    evidenceIds: [],
    observationIds: []
  });
}

/**
 * Apply consequences to state. Only `adventureMemories` changes (the one
 * consequence collection that already persists). Idempotent: an existing card
 * with the same id is never overwritten, so a retired/private card stays so.
 * World flags and NPC availability await W05 persistence.
 */
export function applyAdventureConsequences(state: CampaignState, consequences: AdventureConsequences): CampaignState {
  const parsed = adventureConsequencesSchema.parse(consequences);
  const run = state.adventureRuns.find((item) => item.id === parsed.runId);
  if (!run || run.status === 'active') throw new Error(`Consequences for ${parsed.runId} do not match a terminal run.`);
  const existing = new Set(state.adventureMemories.map((memory) => memory.id));
  const fresh = parsed.memoryCards.filter((card) => !existing.has(card.id));
  if (fresh.length === 0) return state;
  return { ...state, adventureMemories: [...state.adventureMemories, ...fresh] };
}
