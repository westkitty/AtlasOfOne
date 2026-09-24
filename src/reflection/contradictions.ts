import type { ContradictionRecord, EvidenceRecord, CampaignState } from '../game/types';
import { createV2ProvenanceVisibility } from '../persistence/retirement';

export interface ContradictionCandidate {
  id: string;
  evidenceIds: [string, string];
  claim: string;
}

function pairKey(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join('\u0000');
}

function candidateId(leftId: string, rightId: string): string {
  const [left, right] = [leftId, rightId].sort();
  return `contradiction_candidate_${left}__${right}`;
}

function explicitCounterlink(left: EvidenceRecord, right: EvidenceRecord): boolean {
  return left.counterEvidenceIds.includes(right.id)
    || right.counterEvidenceIds.includes(left.id);
}

function sameEvidencePair(
  contradiction: ContradictionRecord,
  leftId: string,
  rightId: string
): boolean {
  return contradiction.evidenceIds.length === 2
    && pairKey(contradiction.evidenceIds[0], contradiction.evidenceIds[1])
      === pairKey(leftId, rightId);
}

/**
 * RF06 deterministic contradiction candidates.
 *
 * This does not infer contradiction from prose. A candidate exists only when
 * the existing evidence graph explicitly counterlinks two active, structurally
 * eligible records. The candidate remains neutral about which claim is true.
 *
 * Existing contradiction history suppresses duplicate candidate creation even
 * when the older contradiction has already been resolved.
 */
export function selectNewContradictionCandidates(
  state: CampaignState
): ContradictionCandidate[] {
  const visibility = createV2ProvenanceVisibility(state);
  const evidence = state.evidence
    .filter((record) => visibility.evidenceIsEligible(record.id))
    .sort((left, right) => left.id.localeCompare(right.id));

  const candidates: ContradictionCandidate[] = [];

  for (let leftIndex = 0; leftIndex < evidence.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < evidence.length; rightIndex += 1) {
      const left = evidence[leftIndex];
      const right = evidence[rightIndex];

      if (!explicitCounterlink(left, right)) continue;
      if (state.contradictions.some((record) => sameEvidencePair(record, left.id, right.id))) {
        continue;
      }

      candidates.push({
        id: candidateId(left.id, right.id),
        evidenceIds: [left.id, right.id],
        claim: `Both active claims remain on record: "${left.claim}" / "${right.claim}".`
      });
    }
  }

  return candidates;
}

/**
 * Converts one reviewed deterministic candidate into the existing durable
 * ContradictionRecord shape. This is still domain data only; adding it to
 * CampaignState is an integration-owned shared mutation under D06.
 */
export function contradictionRecordFromCandidate(
  candidate: ContradictionCandidate
): ContradictionRecord {
  return {
    id: candidate.id,
    claim: candidate.claim,
    evidenceIds: [...candidate.evidenceIds],
    status: 'open'
  };
}
