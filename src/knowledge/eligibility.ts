import type { CampaignState } from '../game/types';
import { createV2ProvenanceVisibility } from '../persistence/retirement';
import { selectOpenKnowledgeGaps } from './domain';
import type { KnowledgeGap } from './schema';

/**
 * K05 structural eligibility for Knowledge Gaps.
 *
 * A gap must be open and every recorded source contributing to its stored
 * summary must remain structurally visible. Mixed public/private provenance is
 * therefore preserved as history by M06 but withheld from selection until the
 * private/retracted source is no longer part of the stored summary contract.
 *
 * Source-free coverage-derived gaps remain eligible by M06 design.
 */
export function selectEligibleKnowledgeGaps(state: CampaignState): KnowledgeGap[] {
  const visibility = createV2ProvenanceVisibility(state);
  return selectOpenKnowledgeGaps(state.knowledgeGaps)
    .filter((gap) => visibility.knowledgeGapIsStructurallyVisible(gap.id));
}

export function knowledgeGapIsEligible(state: CampaignState, id: string): boolean {
  return selectEligibleKnowledgeGaps(state).some((gap) => gap.id === id);
}
