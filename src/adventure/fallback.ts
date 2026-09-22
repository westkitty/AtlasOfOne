import type { AdventureBeatRole, AdventureLearningTarget, AdventureSeed, AdventureTemplate } from '../contracts/adventure';
import { TERRITORY_DEFINITIONS } from '../game/data';
import type { CampaignState } from '../game/types';
import { validateAdventureTemplate } from './runtime';
import { selectActiveAdventureRun } from './runs';

export interface LocalAdventureScene {
  templateId: string;
  runId: string;
  beatId: string;
  role: AdventureBeatRole;
  kicker: string;
  title: string;
  body: string;
  suggestions: string[];
  terminal: boolean;
}

const beat = (role: AdventureBeatRole, nextRole?: AdventureBeatRole) => ({
  id: `local-fallback-investigation:${role}`,
  role,
  required: true,
  allowedEncounterKinds: role === 'encounter' ? ['social', 'puzzle', 'mixed'] as const : ['none'] as const,
  exits: nextRole ? [`local-fallback-investigation:${nextRole}`] : []
});

/**
 * One deliberately generic no-provider template. It proves the local path can
 * run without pretending to be the future CT content bank.
 */
export const LOCAL_FALLBACK_ADVENTURE_TEMPLATE: AdventureTemplate = {
  id: 'local-fallback-investigation',
  kind: 'investigation',
  validTerritories: TERRITORY_DEFINITIONS.map((territory) => territory.id),
  learningTarget: 'reflection-eligible',
  requiredInputs: [],
  beats: [
    beat('hook', 'approach'),
    beat('approach', 'complication'),
    beat('complication', 'encounter'),
    beat('encounter', 'choice'),
    beat('choice', 'consequence'),
    beat('consequence')
  ].map((entry) => ({ ...entry, allowedEncounterKinds: [...entry.allowedEncounterKinds] })),
  withdrawalAllowed: true,
  memoryOutputs: [],
  cooldownClass: 'local-fallback'
};

/**
 * I01 compatibility adapter: keep the fixed local six-beat structure/copy while
 * matching the already-authoritative seed kind. This deliberately changes no
 * seed identity, premise, source gaps or learning target.
 */
export function localFallbackTemplateForSeed(
  seed: Pick<AdventureSeed, 'kind' | 'learningTarget'>
): AdventureTemplate | null {
  if (seed.learningTarget !== 'reflection-eligible') return null;
  if (seed.kind === LOCAL_FALLBACK_ADVENTURE_TEMPLATE.kind) return LOCAL_FALLBACK_ADVENTURE_TEMPLATE;
  return {
    ...LOCAL_FALLBACK_ADVENTURE_TEMPLATE,
    id: `local-fallback-${seed.kind}`,
    kind: seed.kind,
    learningTarget: seed.learningTarget as AdventureLearningTarget,
    beats: LOCAL_FALLBACK_ADVENTURE_TEMPLATE.beats.map((entry) => ({
      ...entry,
      allowedEncounterKinds: [...entry.allowedEncounterKinds],
      exits: [...entry.exits]
    }))
  };
}

const COPY: Record<AdventureBeatRole, Omit<LocalAdventureScene, 'templateId' | 'runId' | 'beatId' | 'role' | 'terminal'>> = {
  hook: {
    kicker: 'Something is off',
    title: 'A small mystery refuses to stay small.',
    body: 'There is enough here to investigate, but not enough to tell you what it means yet. Start with what is actually in front of you.',
    suggestions: ['Look for the odd detail', 'Check what changed', 'Take the long way around']
  },
  approach: {
    kicker: 'Pick an angle',
    title: 'You can get closer without committing to one explanation.',
    body: 'The direct route is not the only route. Circle the problem, test the edges, or inspect the part everyone else would ignore.',
    suggestions: ['Inspect quietly', 'Ask one concrete question', 'Change vantage point']
  },
  complication: {
    kicker: 'Of course it got weird',
    title: 'The simple explanation just broke.',
    body: 'A new detail makes the first version incomplete. Nothing is lost; the investigation just has one more moving part now.',
    suggestions: ['Keep both possibilities alive', 'Test the new detail', 'Protect an exit route']
  },
  encounter: {
    kicker: 'Something answers back',
    title: 'The mystery now has resistance.',
    body: 'An obstacle, person, puzzle, or strange condition blocks the easy route. It can be handled without turning this into a grind.',
    suggestions: ['Observe before acting', 'Try a nonviolent opening', 'Use the environment']
  },
  choice: {
    kicker: 'Your move',
    title: 'There is more than one clean way through.',
    body: 'Choose what you want to do next. The game can remember the consequence without treating the choice as proof about who you are.',
    suggestions: ['Commit to a route', 'Try an unexpected solution', 'Leave the problem partially unsolved']
  },
  consequence: {
    kicker: 'The world keeps the receipt',
    title: 'Something changed because you were here.',
    body: 'The immediate situation settles. What happened can remain part of the world and its history without becoming a personality verdict.',
    suggestions: ['Notice what changed', 'Keep the unresolved piece', 'Return to the world']
  }
};

/**
 * Read-only deterministic local scene rendering. Source premise, Journal text,
 * evidence claims and Knowledge summaries are intentionally never read.
 */
export function renderLocalAdventureScene(
  state: CampaignState,
  runId: string,
  template?: AdventureTemplate
): LocalAdventureScene | null {
  const run = selectActiveAdventureRun(state);
  if (!run || run.id !== runId) return null;
  const seed = state.adventureSeeds.find((candidate) => candidate.id === run.seedId);
  if (!seed || seed.status !== 'started') return null;
  const resolvedTemplate = template ?? localFallbackTemplateForSeed(seed);
  if (!resolvedTemplate || !validateAdventureTemplate(resolvedTemplate)) return null;
  if (seed.kind !== resolvedTemplate.kind || seed.learningTarget !== resolvedTemplate.learningTarget) return null;
  if (!resolvedTemplate.validTerritories.includes(run.territoryId)) return null;
  if (seed.territoryId !== run.territoryId || seed.locationId !== run.locationId) return null;

  const current = resolvedTemplate.beats.find((candidate) => candidate.id === run.currentBeatId);
  if (!current) return null;
  const copy = COPY[current.role];
  return {
    templateId: resolvedTemplate.id,
    runId: run.id,
    beatId: current.id,
    role: current.role,
    ...copy,
    suggestions: [...copy.suggestions],
    terminal: current.role === 'consequence' && current.exits.length === 0
  };
}
