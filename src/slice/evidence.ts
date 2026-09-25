import type { CampaignState, EvidenceRecord } from '../game/types';
import { retireIneligibleV2DerivedState } from '../persistence/retirement';
import { buildReflectionEvidenceProposal } from '../reflection/evidence';

/**
 * I06: convert Greyson's explicit Reflection decision into supported Evidence.
 *
 * Only RF02's firewall decides whether a claim exists (confirm/partial with his
 * own non-empty response, eligible source chain). This step attaches the
 * structural fields RF02 deliberately left out:
 * - dimension/territory come from the adventure's seed and curiosity gap
 *   (structural provenance), never from the prose;
 * - origin 'player-stated', basis 'explicit'; confirm = strength 2, partial = 1;
 * - `sourceReflectionIds` carries provenance so PRIVATE/retraction propagates;
 * - no XP, no reward: the legacy EVIDENCE_ADDED event (which awards XP) is not
 *   used, so disclosure is never scored.
 *
 * Returns the state unchanged when no claim is authorized or the source cannot
 * be placed structurally (e.g. a pure-fun or journal-sourced Reflection).
 */
export function applyReflectionEvidence(
  state: CampaignState,
  input: { reflectionId: string; evidenceId: string }
): CampaignState {
  if (state.evidence.some((record) => record.sourceReflectionIds?.includes(input.reflectionId))) return state;
  const proposal = buildReflectionEvidenceProposal(state, input.reflectionId);
  if (!proposal || proposal.sourceKind !== 'adventure') return state;

  const observation = state.adventureObservations.find((item) => item.id === proposal.sourceIds[0]);
  const run = observation && state.adventureRuns.find((item) => item.id === observation.runId);
  const seed = run && state.adventureSeeds.find((item) => item.id === run.seedId);
  const gap = seed && state.knowledgeGaps.find((item) => seed.sourceGapIds.includes(item.id));
  const dimension = gap?.dimensionIds[0];
  if (!seed || !dimension) return state;

  const evidence: EvidenceRecord = {
    id: input.evidenceId,
    dimension,
    claim: proposal.claim,
    sourceTurnIds: [],
    basis: 'explicit',
    strength: proposal.decision === 'confirm' ? 2 : 1,
    territories: [seed.territoryId],
    counterEvidenceIds: [],
    status: 'active',
    origin: 'player-stated',
    sourceReflectionIds: [proposal.reflectionId]
  };
  return { ...state, evidence: [...state.evidence, evidence] };
}

/** Reflection privacy/retraction: retire Reflection-sourced Evidence durably (RF09 + I06). */
export function retireReflectionEvidence(state: CampaignState): CampaignState {
  return retireIneligibleV2DerivedState(state);
}
