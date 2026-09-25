import { selectMemoriesWithinBudget, DEFAULT_ADVENTURE_MEMORY_BUDGET, type AdventureMemoryBudget } from '../../adventure/memory/budget';
import { eligibleAdventureMemories } from '../../adventure/memory/retirement';
import { retrieveAdventureMemories } from '../../adventure/memory/retrieval';
import type { CampaignState } from '../../game/types';
import { createV2ProvenanceVisibility } from '../../persistence/retirement';
import type { AdventureSceneAllowedIds } from '../adventureSceneProposal';
import { MODE_CONTEXT_BUDGET, clipText, takeWithinBudget } from './budget';

export interface AdventureSceneModeTask {
  runId: string;
  /** Optional free text from the current scene/action used only for memory retrieval. */
  queryText?: string;
  memoryBudget?: AdventureMemoryBudget;
}

export interface AdventureSceneModeContext {
  mode: 'adventure' | 'pure-fun';
  adventure: {
    runId: string;
    seedId: string;
    territoryId: string;
    kind: string;
    premise: string;
    currentBeat: string;
  };
  recentActions: Array<{ id: string; kind: string; text: string }>;
  memories: Array<{ id: string; type: string; summary: string }>;
  npcIds: string[];
  /** Pass directly to parseAdventureSceneProposalForContext. */
  allowedIds: AdventureSceneAllowedIds;
}

/**
 * P05 Adventure-scene bounded context.
 *
 * Never contains Journal text: the only authored prose is the seed premise,
 * recorded fictional action labels, and N04-gated memory summaries
 * (`eligibleAdventureMemories` -> N02 retrieval -> N03 budget). The run's seed
 * must be structurally visible; a run whose provenance became PRIVATE/retracted
 * throws so the caller uses the P10 local continuation.
 */
export function compileAdventureSceneModeContext(
  state: CampaignState,
  task: AdventureSceneModeTask
): AdventureSceneModeContext {
  const budget = MODE_CONTEXT_BUDGET.adventure;
  const run = state.adventureRuns.find((item) => item.id === task.runId);
  if (!run) throw new Error(`Unknown AdventureRun id: ${task.runId}`);
  const seed = state.adventureSeeds.find((item) => item.id === run.seedId);
  const visibility = createV2ProvenanceVisibility(state);
  if (!seed || !visibility.adventureSeedIsStructurallyVisible(seed.id)) {
    throw new Error('Adventure run is not provider-eligible.');
  }

  const remaining = { remaining: budget.totalChars };
  const premise = clipText(seed.premise, budget.premiseChars);
  remaining.remaining -= premise.length;

  const newestFirst = state.adventureActions
    .filter((action) => action.runId === run.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
    .map((action) => ({ id: action.id, kind: action.kind, text: clipText(action.text, budget.actionChars) }));
  const recentActions = takeWithinBudget(newestFirst, budget.recentAdventureActions, remaining, (a) => a.text.length)
    .reverse();

  const npcIds = [...run.characterIds].sort();
  const ranked = retrieveAdventureMemories(eligibleAdventureMemories(state), {
    entityIds: [run.id, seed.id, seed.territoryId, ...npcIds],
    text: [task.queryText ?? '', ...recentActions.map((a) => a.text)].join(' ')
  });
  const selection = selectMemoriesWithinBudget(ranked, task.memoryBudget ?? DEFAULT_ADVENTURE_MEMORY_BUDGET);
  const memories = takeWithinBudget(
    selection.selected.map((item) => ({ id: item.memory.id, type: item.memory.type, summary: item.memory.summary })),
    budget.relevantAdventureMemories,
    remaining,
    (m) => m.summary.length
  );

  return {
    mode: seed.kind === 'pure-fun' ? 'pure-fun' : 'adventure',
    adventure: {
      runId: run.id,
      seedId: seed.id,
      territoryId: seed.territoryId,
      kind: seed.kind,
      premise,
      currentBeat: run.currentBeat
    },
    recentActions,
    memories,
    npcIds,
    allowedIds: {
      entityIds: [run.id, seed.id, seed.territoryId],
      npcIds,
      memoryIds: memories.map((m) => m.id)
    }
  };
}
