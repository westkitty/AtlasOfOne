import { markAdventureSeedStarted } from './seeds';
import { ADVENTURE_BEATS, adventureBeatPlan, nextAdventureBeat } from './beats';
import { adventureRunSchema, type AdventureRun, type AdventureSeed } from './schema';

export type AdventureRunEvent =
  | { type: 'advance'; at: string }
  | { type: 'complete'; at: string }
  | { type: 'withdraw'; at: string };

function requireInstant(value: string, label: string): string {
  if (!Number.isFinite(Date.parse(value))) throw new Error(`Invalid ${label}: ${value}`);
  return value;
}

/**
 * A01: open a run from an eligible, available seed. Callers must check
 * A00 `adventureSeedIsEligible` first; this function fails closed on a
 * non-available seed and never flips the seed itself (see markAdventureSeedStarted).
 */
export function startAdventureRun(
  seed: AdventureSeed,
  input: { id: string; startedAt: string; characterIds?: readonly string[] }
): AdventureRun {
  if (!input.id.trim()) throw new Error('AdventureRun id must not be empty.');
  if (seed.status !== 'available') {
    throw new Error(`AdventureSeed ${seed.id} is ${seed.status}; a run can start only from an available seed.`);
  }
  return adventureRunSchema.parse({
    id: input.id,
    seedId: seed.id,
    territoryId: seed.territoryId,
    status: 'active',
    currentBeat: ADVENTURE_BEATS[0],
    characterIds: [...new Set(input.characterIds ?? [])].sort(),
    memoryIds: [],
    startedAt: requireInstant(input.startedAt, 'startedAt')
  });
}

/**
 * A01 deterministic lifecycle reducer.
 *
 * active --advance--> active (next beat in the seed's bounded plan only)
 * active --complete--> complete (only from the plan's final beat)
 * active --withdraw--> withdrawn (from any beat; never a failure state)
 *
 * complete and withdrawn are terminal. Every illegal transition throws; the
 * reducer never silently repairs or skips a beat.
 */
export function reduceAdventureRun(
  run: AdventureRun,
  seed: AdventureSeed,
  event: AdventureRunEvent
): AdventureRun {
  if (run.seedId !== seed.id) {
    throw new Error(`AdventureRun ${run.id} belongs to seed ${run.seedId}, not ${seed.id}.`);
  }
  if (run.status !== 'active') {
    throw new Error(`AdventureRun ${run.id} is ${run.status}; ${event.type} is not allowed.`);
  }
  const at = requireInstant(event.at, `${event.type} time`);
  if (Date.parse(at) < Date.parse(run.startedAt)) {
    throw new Error(`AdventureRun ${run.id} ${event.type} time precedes startedAt.`);
  }

  switch (event.type) {
    case 'advance': {
      const next = nextAdventureBeat(seed, run.currentBeat);
      if (!next) throw new Error(`AdventureRun ${run.id} is on its final beat; complete it instead.`);
      return { ...run, currentBeat: next };
    }
    case 'complete': {
      const plan = adventureBeatPlan(seed);
      if (run.currentBeat !== plan[plan.length - 1]) {
        throw new Error(`AdventureRun ${run.id} cannot complete from beat ${run.currentBeat}.`);
      }
      return { ...run, status: 'complete', completedAt: at };
    }
    case 'withdraw':
      return { ...run, status: 'withdrawn', completedAt: at };
    default: {
      const unknown: never = event;
      throw new Error(`Unknown AdventureRun event: ${JSON.stringify(unknown)}`);
    }
  }
}

/**
 * Atomic seed -> run start for integration callers (I01).
 *
 * Starting a run and flipping its seed to `started` must happen together, or
 * two runs could open from one available seed. Callers should use this rather
 * than calling startAdventureRun and markAdventureSeedStarted separately.
 */
export function startAdventureFromSeed(
  seed: AdventureSeed,
  input: { id: string; startedAt: string; characterIds?: readonly string[] }
): { seed: AdventureSeed; run: AdventureRun } {
  const run = startAdventureRun(seed, input);
  return { seed: markAdventureSeedStarted(seed), run };
}
