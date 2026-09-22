import type { AdventureRun } from '../contracts/adventure';
import type { CampaignState } from '../game/types';
import { selectAvailableAdventureSeeds } from './seeds';

export interface AdventureRunLifecycleOptions {
  now?: () => string;
}

/**
 * A01 owns lifecycle only. A03 replaces this neutral placeholder with a real
 * six-beat template position; A01 does not invent beat transitions.
 */
export const A01_INITIAL_BEAT_ID = 'pending';

/** Collision-safe deterministic run identity: one durable run identity per seed. */
export function adventureRunId(seedId: string): string {
  return `adventure-run:${encodeURIComponent(JSON.stringify({ seedId }))}`;
}

/**
 * Returns the sole active run. Ambiguous corrupted multi-active state fails closed.
 */
export function selectActiveAdventureRun(state: CampaignState): AdventureRun | null {
  const active = state.adventureRuns.filter((run) => run.status === 'active');
  return active.length === 1 ? active[0] : null;
}

/**
 * Start one A00-eligible available seed as the campaign's sole active run.
 *
 * This is a pure deterministic state transition. It does not generate narrative,
 * create actions/observations/memories, place world markers, or award progression.
 */
export function startAdventureRun(
  state: CampaignState,
  seedId: string,
  options: AdventureRunLifecycleOptions = {}
): CampaignState {
  if (state.adventureRuns.some((run) => run.status === 'active')) return state;

  const seed = selectAvailableAdventureSeeds(state).find((candidate) => candidate.id === seedId);
  if (!seed) return state;
  if (state.adventureRuns.some((run) => run.seedId === seed.id || run.id === adventureRunId(seed.id))) return state;

  const at = options.now?.() ?? new Date().toISOString();
  const run: AdventureRun = {
    id: adventureRunId(seed.id),
    seedId: seed.id,
    territoryId: seed.territoryId,
    locationId: seed.locationId,
    status: 'active',
    currentBeatId: A01_INITIAL_BEAT_ID,
    recurringCharacterIds: [],
    memoryIds: [],
    startedAt: at
  };
  const adventureSeeds = state.adventureSeeds.map((candidate) => candidate.id === seed.id
    ? { ...candidate, status: 'started' as const }
    : candidate
  );
  return { ...state, adventureSeeds, adventureRuns: [...state.adventureRuns, run], updatedAt: at };
}

/**
 * Complete only the campaign's unambiguous active run. A05 later owns explicit
 * withdrawal/fail-forward outcomes; this function never creates `withdrawn`.
 */
export function completeAdventureRun(
  state: CampaignState,
  runId: string,
  options: AdventureRunLifecycleOptions = {}
): CampaignState {
  const active = selectActiveAdventureRun(state);
  if (!active || active.id !== runId) return state;
  const seed = state.adventureSeeds.find((candidate) => candidate.id === active.seedId);
  if (!seed || seed.status !== 'started') return state;

  const at = options.now?.() ?? new Date().toISOString();
  const adventureRuns = state.adventureRuns.map((run) => run.id === runId
    ? { ...run, status: 'complete' as const, completedAt: at }
    : run
  );
  return { ...state, adventureRuns, updatedAt: at };
}
