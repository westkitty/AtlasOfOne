import type { AdventureObservation, AdventureRun, AdventureSeed } from './schema';

/**
 * A10: an optional, ID-only suggestion that a completed adventure could be
 * offered to Reflection.
 *
 * It is a candidate, never Evidence. It carries no observation prose, no
 * dimension, claim, strength or basis, and nothing here can create an
 * EvidenceRecord. Only a later Reflection response plus deterministic RF
 * conversion may change evidence.
 */
export interface ReflectionHandoffCandidate {
  kind: 'reflection-handoff-candidate';
  sourceKind: 'adventure';
  runId: string;
  seedId: string;
  territoryId: string;
  observationIds: readonly string[];
  /** Offered, never required. */
  optional: true;
  isEvidence: false;
}

export interface ReflectionHandoffOptions {
  /**
   * Optional provenance gate, e.g. createV2ProvenanceVisibility(state).adventureObservationIsEligible.
   * Observations the gate rejects are dropped before deciding.
   */
  observationIsEligible?: (id: string) => boolean;
}

export function proposeReflectionHandoff(
  run: AdventureRun,
  seed: AdventureSeed,
  observations: readonly AdventureObservation[],
  options: ReflectionHandoffOptions = {}
): ReflectionHandoffCandidate | null {
  if (run.seedId !== seed.id) {
    throw new Error(`AdventureRun ${run.id} belongs to seed ${run.seedId}, not ${seed.id}.`);
  }
  if (run.status !== 'complete') return null;
  if (seed.learningTarget !== 'reflection-eligible' || seed.kind === 'pure-fun') return null;

  const gate = options.observationIsEligible ?? (() => true);
  const observationIds = [...new Set(
    observations
      .filter((observation) => observation.runId === run.id)
      .filter((observation) => observation.status === 'unreflected')
      .filter((observation) => observation.sourceActionIds.length > 0)
      .map((observation) => observation.id)
      .filter(gate)
  )].sort();

  if (observationIds.length === 0) return null;

  return {
    kind: 'reflection-handoff-candidate',
    sourceKind: 'adventure',
    runId: run.id,
    seedId: seed.id,
    territoryId: run.territoryId,
    observationIds,
    optional: true,
    isEvidence: false
  };
}
