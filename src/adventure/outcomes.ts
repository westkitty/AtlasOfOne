import { reduceAdventureRun } from './run';
import type { AdventureRun, AdventureSeed } from './schema';

/**
 * How a run stepped out of its beats. None of these is a failure, a verdict,
 * or a moral judgment; each leads to a different story state (section 10.5).
 */
export const ADVENTURE_EXIT_CAUSES = ['chose-to-leave', 'escaped', 'overpowered', 'paused-for-later'] as const;
export type AdventureExitCause = (typeof ADVENTURE_EXIT_CAUSES)[number];

export const STORY_CONTINUATIONS = {
  'chose-to-leave': 'the-world-carries-on',
  escaped: 'safe-at-a-nearby-waypoint',
  overpowered: 'recovered-by-a-friendly-hand',
  'paused-for-later': 'thread-left-open'
} as const satisfies Record<AdventureExitCause, string>;

export interface AdventureOutcome {
  runId: string;
  seedId: string;
  resolution: 'completed' | 'withdrawn';
  cause: AdventureExitCause | 'finished';
  storyContinuation: (typeof STORY_CONTINUATIONS)[AdventureExitCause] | 'story-concluded';
  /** Reflection is only ever offered, never required, and never for learningTarget none. */
  reflectionOffered: boolean;
  /** Outcomes manufacture nothing: no XP, rewards, penalties, evidence or observations. */
  xpDelta: 0;
  rewardIds: readonly [];
  evidenceIds: readonly [];
  observationIds: readonly [];
}

/**
 * A05: withdraw from a run at any beat with a fail-forward story state.
 * Withdrawal never subtracts progress, never records a judgment, and never
 * creates evidence or rewards.
 */
export function withdrawAdventureRun(
  run: AdventureRun,
  seed: AdventureSeed,
  input: { at: string; cause: AdventureExitCause }
): { run: AdventureRun; outcome: AdventureOutcome } {
  if (!(ADVENTURE_EXIT_CAUSES as readonly string[]).includes(input.cause)) {
    throw new Error(`Unknown adventure exit cause: ${String(input.cause)}`);
  }
  const next = reduceAdventureRun(run, seed, { type: 'withdraw', at: input.at });
  return {
    run: next,
    outcome: {
      runId: run.id,
      seedId: seed.id,
      resolution: 'withdrawn',
      cause: input.cause,
      storyContinuation: STORY_CONTINUATIONS[input.cause],
      reflectionOffered: false,
      xpDelta: 0,
      rewardIds: [],
      evidenceIds: [],
      observationIds: []
    }
  };
}

/** A05 companion: completion outcome. Completion alone creates no self-evidence. */
export function completeAdventureRun(
  run: AdventureRun,
  seed: AdventureSeed,
  input: { at: string }
): { run: AdventureRun; outcome: AdventureOutcome } {
  const next = reduceAdventureRun(run, seed, { type: 'complete', at: input.at });
  return {
    run: next,
    outcome: {
      runId: run.id,
      seedId: seed.id,
      resolution: 'completed',
      cause: 'finished',
      storyContinuation: 'story-concluded',
      reflectionOffered: seed.learningTarget === 'reflection-eligible',
      xpDelta: 0,
      rewardIds: [],
      evidenceIds: [],
      observationIds: []
    }
  };
}
