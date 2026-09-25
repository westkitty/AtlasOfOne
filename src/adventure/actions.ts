import {
  adventureActionSchema,
  adventureObservationSchema,
  type AdventureAction,
  type AdventureObservation,
  type AdventureRun
} from './schema';

export const ADVENTURE_ACTION_TEXT_MAX_LENGTH = 2000;
export const ADVENTURE_OBSERVATION_MAX_LENGTH = 600;

function requireActive(run: AdventureRun): void {
  if (run.status !== 'active') {
    throw new Error(`AdventureRun ${run.id} is ${run.status}; nothing more can be recorded.`);
  }
}

function boundedText(value: string, max: number, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} must not be empty.`);
  if (trimmed.length > max) throw new Error(`${label} exceeds ${max} characters.`);
  return trimmed;
}

/**
 * A02: record what the player chose in fiction. The record is fictional
 * action history only; it is never Evidence about Greyson.
 */
export function recordAdventureAction(
  run: AdventureRun,
  input: Omit<AdventureAction, 'runId'>
): AdventureAction {
  requireActive(run);
  if (!input.id.trim()) throw new Error('AdventureAction id must not be empty.');
  if (!Number.isFinite(Date.parse(input.createdAt))) throw new Error(`Invalid createdAt: ${input.createdAt}`);
  if (Date.parse(input.createdAt) < Date.parse(run.startedAt)) {
    throw new Error('AdventureAction createdAt precedes the run start.');
  }
  return adventureActionSchema.strict().parse({
    id: input.id,
    runId: run.id,
    createdAt: input.createdAt,
    kind: input.kind,
    text: boundedText(input.text, ADVENTURE_ACTION_TEXT_MAX_LENGTH, 'AdventureAction text')
  });
}

/**
 * A02: record an AdventureObservation grounded in this run's actions.
 *
 * An observation is NOT Evidence. It always starts `unreflected`, carries no
 * dimension/claim/strength/basis fields, and this module exposes no path that
 * converts it into an EvidenceRecord. Only a later Reflection response plus
 * deterministic RF02/RF05 conversion may produce evidence changes.
 */
export function recordAdventureObservation(
  run: AdventureRun,
  runActions: readonly AdventureAction[],
  input: { id: string; sourceActionIds: readonly string[]; observation: string }
): AdventureObservation {
  requireActive(run);
  if (!input.id.trim()) throw new Error('AdventureObservation id must not be empty.');
  const sourceActionIds = [...new Set(input.sourceActionIds)].sort();
  if (sourceActionIds.length === 0) throw new Error('AdventureObservation requires at least one source action.');

  const actionsById = new Map(runActions.map((action) => [action.id, action]));
  for (const actionId of sourceActionIds) {
    const action = actionsById.get(actionId);
    if (!action) throw new Error(`Unknown AdventureAction id: ${actionId}`);
    if (action.runId !== run.id) {
      throw new Error(`AdventureAction ${actionId} belongs to run ${action.runId}, not ${run.id}.`);
    }
  }

  return adventureObservationSchema.strict().parse({
    id: input.id,
    runId: run.id,
    sourceActionIds,
    observation: boundedText(input.observation, ADVENTURE_OBSERVATION_MAX_LENGTH, 'AdventureObservation text'),
    status: 'unreflected'
  });
}

/** Discarding is the only status change A02 permits; `reflected` belongs to Reflection. */
export function discardAdventureObservation(observation: AdventureObservation): AdventureObservation {
  if (observation.status === 'discarded') return observation;
  if (observation.status === 'reflected') {
    throw new Error(`AdventureObservation ${observation.id} is already reflected and stays as history.`);
  }
  return { ...observation, status: 'discarded' };
}
