import type { CampaignState } from '../game/types';
import { createV2ProvenanceVisibility } from '../persistence/retirement';
import { reflectionRecordSchema, type ReflectionRecord } from './schema';
import { buildReflectionEvidenceProposal } from './evidence';

interface ReflectionProvenanceBase {
  reflectionId: string;
  sourceKind: ReflectionRecord['sourceKind'];
  sourceIds: string[];
  createdAt: string;
}

export interface PartialReflectionProvenance extends ReflectionProvenanceBase {
  kind: 'partial';
  /**
   * The part Greyson explicitly supplied. This is the only claim RF02 allows
   * forward from a PARTIAL decision.
   */
  acceptedClaim: string;
  /**
   * The original interpretation remains visible as history so later code can
   * explain what was *not* silently promoted wholesale.
   */
  originalInterpretation?: string;
}

export interface RevisionReflectionProvenance extends ReflectionProvenanceBase {
  kind: 'revision';
  /** Greyson's replacement/amendment text. */
  replacementClaim: string;
  /**
   * Preserve the source lineage the older interpretation came from. These IDs
   * are not deleted or reclassified here; integration/RF06-RF07 can compare
   * old and new claims without destroying history.
   */
  priorSourceIds: string[];
  originalInterpretation?: string;
}

export type ReflectionProvenanceDelta =
  | PartialReflectionProvenance
  | RevisionReflectionProvenance;

/**
 * RF05 partial/revision provenance boundary.
 *
 * This is proposal data only. It never mutates EvidenceRecord, InsightRecord,
 * ContradictionRecord, CampaignState, or GameEvent state.
 *
 * PARTIAL:
 * - delegates claim authority to the already-reviewed RF02 firewall;
 * - preserves the original interpretation alongside Greyson's narrower words.
 *
 * REVISE:
 * - requires an active, structurally eligible Reflection;
 * - preserves the previous source IDs and optional interpretation;
 * - emits Greyson's replacement text without deciding which shared claim is
 *   ultimately superseded/contested. That cross-domain mutation remains an
 *   integration-owned later step.
 */
export function buildReflectionProvenanceDelta(
  state: CampaignState,
  reflectionId: string
): ReflectionProvenanceDelta | null {
  const input = state.reflections.find((record) => record.id === reflectionId);
  if (!input) throw new Error(`Unknown ReflectionRecord id: ${reflectionId}`);

  const record = reflectionRecordSchema.parse(input);
  const visibility = createV2ProvenanceVisibility(state);
  if (!visibility.reflectionIsEligible(record.id)) return null;

  if (record.decision === 'partial' && record.epistemicStatus === 'partial') {
    const proposal = buildReflectionEvidenceProposal(state, record.id);
    if (!proposal || proposal.decision !== 'partial') return null;

    const originalInterpretation = record.interpretation?.trim()
      ? record.interpretation
      : undefined;

    return {
      kind: 'partial',
      reflectionId: record.id,
      sourceKind: record.sourceKind,
      sourceIds: [...record.sourceIds],
      acceptedClaim: proposal.claim,
      ...(originalInterpretation === undefined ? {} : { originalInterpretation }),
      createdAt: record.createdAt
    };
  }

  if (record.decision === 'revise' && record.epistemicStatus === 'pending') {
    if (!record.response.trim()) return null;

    const originalInterpretation = record.interpretation?.trim()
      ? record.interpretation
      : undefined;

    return {
      kind: 'revision',
      reflectionId: record.id,
      sourceKind: record.sourceKind,
      sourceIds: [...record.sourceIds],
      replacementClaim: record.response,
      priorSourceIds: [...record.sourceIds],
      ...(originalInterpretation === undefined ? {} : { originalInterpretation }),
      createdAt: record.createdAt
    };
  }

  return null;
}
