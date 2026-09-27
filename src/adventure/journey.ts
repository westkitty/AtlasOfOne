import type { CampaignState } from '../game/types';
import { retireIneligibleV2State } from '../persistence/retirement';
import { encounterObservationId } from './play';

/**
 * One thing that happened in the world, for the Journal's Journey list and the
 * world's memory markers. Built only from deterministic local records (runs and
 * their fixed-copy encounter observations), after live privacy/retraction
 * retirement. It never reads Journal text, seed premises or evidence, and it is
 * fiction: nothing here is a claim about the player.
 */
export interface JourneyEvent {
  runId: string;
  territoryId: string;
  startedAt: string;
  completedAt?: string;
  status: 'active' | 'complete' | 'withdrawn';
  outcome?: string;
}

export function selectJourneyEvents(state: CampaignState): JourneyEvent[] {
  const eligible = retireIneligibleV2State(state);
  const liveSeedIds = new Set(eligible.adventureSeeds.filter((seed) => seed.status !== 'retired').map((seed) => seed.id));
  return eligible.adventureRuns
    // A run whose seed was retired (its source made private/retracted) disappears too.
    .filter((run) => liveSeedIds.has(run.seedId))
    .map((run) => {
      const observation = eligible.adventureObservations.find((entry) => entry.id === encounterObservationId(run.id) && entry.status !== 'discarded');
      return {
        runId: run.id,
        territoryId: run.territoryId,
        startedAt: run.startedAt,
        ...(run.completedAt ? { completedAt: run.completedAt } : {}),
        status: run.status,
        ...(observation ? { outcome: observation.observation } : {})
      };
    })
    .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt));
}

/** Completed adventures leave a memory in the world where they happened. */
export function selectWorldMemories(state: CampaignState): JourneyEvent[] {
  return selectJourneyEvents(state).filter((event) => event.status === 'complete');
}
