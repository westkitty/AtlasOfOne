import type { AdventureAction, AdventureRun, AdventureSeed } from '../schema';
import { adventureBeatPlan } from '../beats';

/**
 * N01 compact adventure summary (section 14.1 layer 1).
 *
 * Built only from structural fields: kind, territory, lifecycle, beat position,
 * action counts by kind and linked memory ids. It never copies journal text,
 * action text, observation prose, or the seed premise, so a summary cannot leak
 * free text into provider context. No provider, no network.
 */

export const ADVENTURE_SUMMARY_MAX_LENGTH = 240;

export interface AdventureSummary {
  runId: string;
  seedId: string;
  kind: AdventureSeed['kind'];
  territoryId: string;
  status: AdventureRun['status'];
  beatsReached: number;
  beatsTotal: number;
  actionCounts: Readonly<Record<AdventureAction['kind'], number>>;
  memoryIds: readonly string[];
  text: string;
}

const STATUS_PHRASE: Record<AdventureRun['status'], string> = {
  active: 'is under way',
  complete: 'was completed',
  withdrawn: 'was set aside for now'
};

const ACTION_KINDS: readonly AdventureAction['kind'][] = ['say', 'do', 'inspect', 'travel', 'combat', 'leave'];

export function summarizeAdventureRun(
  run: AdventureRun,
  seed: AdventureSeed,
  actions: readonly AdventureAction[]
): AdventureSummary {
  if (run.seedId !== seed.id) {
    throw new Error(`AdventureRun ${run.id} belongs to seed ${run.seedId}, not ${seed.id}.`);
  }
  const plan = adventureBeatPlan(seed);
  const position = plan.indexOf(run.currentBeat as (typeof plan)[number]);
  if (position < 0) throw new Error(`Beat ${run.currentBeat} is not in this adventure's plan.`);

  const actionCounts = Object.fromEntries(ACTION_KINDS.map((kind) => [kind, 0])) as Record<AdventureAction['kind'], number>;
  for (const action of actions) {
    if (action.runId === run.id) actionCounts[action.kind] += 1;
  }
  const actionTotal = ACTION_KINDS.reduce((sum, kind) => sum + actionCounts[kind], 0);
  const memoryIds = [...new Set(run.memoryIds)].sort();
  const beatsReached = position + 1;

  const text = [
    `A ${seed.kind} adventure in ${run.territoryId} ${STATUS_PHRASE[run.status]}`,
    `after ${beatsReached} of ${plan.length} beats`,
    `with ${actionTotal} action${actionTotal === 1 ? '' : 's'}.`
  ].join(' ').slice(0, ADVENTURE_SUMMARY_MAX_LENGTH);

  return {
    runId: run.id,
    seedId: seed.id,
    kind: seed.kind,
    territoryId: run.territoryId,
    status: run.status,
    beatsReached,
    beatsTotal: plan.length,
    actionCounts,
    memoryIds,
    text
  };
}
