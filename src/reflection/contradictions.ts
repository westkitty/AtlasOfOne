import { createEvidenceVisibility } from '../cartographer/context';
import type { CampaignState, ContradictionRecord, EvidenceRecord } from '../game/types';

export interface ContradictionCandidate {
  id: string;
  claim: string;
  evidenceIds: string[];
}

function sameEvidenceSet(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((id, index) => id === b[index]);
}

function evidenceFor(state: CampaignState, id: string): EvidenceRecord | undefined {
  return state.evidence.find((record) => record.id === id);
}

/**
 * RF06 deterministic contradiction constructor.
 *
 * The semantic relationship ("these claims pull against each other") is an
 * explicit candidate supplied by a later human/model proposal boundary.
 * TypeScript decides only whether that candidate is allowed to become a durable
 * ContradictionRecord:
 *
 * - at least two distinct evidence IDs;
 * - every source resolves to an active, structurally visible EvidenceRecord;
 * - source claims are not byte-identical duplicates;
 * - stable ID collisions cannot overwrite an older contradiction;
 * - the same evidence set is idempotently de-duplicated.
 *
 * This function returns a record. It does not append to CampaignState and does
 * not dispatch a GameEvent; shared mutation remains integration-owned.
 */
export function buildContradictionRecord(
  state: CampaignState,
  candidate: ContradictionCandidate
): ContradictionRecord {
  if (!candidate.id.trim()) throw new Error('Contradiction id must not be empty.');
  if (!candidate.claim.trim()) throw new Error('Contradiction claim must not be empty.');

  const evidenceIds = [...new Set(candidate.evidenceIds)];
  if (evidenceIds.length < 2) {
    throw new Error('A contradiction requires at least two distinct evidence sources.');
  }

  const visibility = createEvidenceVisibility(state);
  const records = evidenceIds.map((id) => {
    const record = evidenceFor(state, id);
    if (!record) throw new Error(`Unknown EvidenceRecord id: ${id}`);
    if (!visibility.evidenceIsVisible(id)) {
      throw new Error(`Ineligible EvidenceRecord id: ${id}`);
    }
    return record;
  });

  if (new Set(records.map((record) => record.claim.trim())).size < 2) {
    throw new Error('A contradiction requires at least two distinct supported claims.');
  }

  const idCollision = state.contradictions.find((record) => record.id === candidate.id);
  if (idCollision) {
    if (
      idCollision.claim === candidate.claim.trim()
      && sameEvidenceSet(idCollision.evidenceIds, evidenceIds)
    ) return idCollision;
    throw new Error(`Contradiction id already exists: ${candidate.id}`);
  }

  const existing = state.contradictions.find((record) =>
    sameEvidenceSet(record.evidenceIds, evidenceIds)
  );
  if (existing) return existing;

  return {
    id: candidate.id,
    claim: candidate.claim.trim(),
    evidenceIds: [...evidenceIds].sort(),
    status: 'open'
  };
}
