import { reflectionRecordSchema, type ReflectionRecord } from './schema';

export type ReflectionEvidenceClaimSource =
  | 'confirmed-interpretation'
  | 'explicit-response';

export interface ReflectionEvidenceProposal {
  reflectionId: string;
  sourceKind: ReflectionRecord['sourceKind'];
  sourceIds: string[];
  decision: 'confirm' | 'partial';
  epistemicStatus: 'confirmed' | 'partial';
  /**
   * Human-authorized candidate claim only.
   *
   * This is not an EvidenceRecord and carries no GameEvent/progression authority.
   * Integration must later attach a valid evidence dimension/territory/provenance
   * representation before any shared campaign mutation can occur.
   */
  claim: string;
  claimSource: ReflectionEvidenceClaimSource;
  response: string;
  createdAt: string;
}

/**
 * RF02 deterministic Reflection -> evidence-proposal firewall.
 *
 * A proposal exists only when Greyson explicitly supplied a non-empty response
 * and the active, non-private Reflection is in a supported epistemic state.
 *
 * Confirm may authorize the proposed interpretation text, because Greyson has
 * explicitly said it fits. Partial never reuses the whole interpretation:
 * only Greyson's own response can become the candidate claim.
 *
 * The return value is intentionally *not* an EvidenceRecord. The legacy
 * EvidenceRecord cannot encode Reflection provenance without fabricating a
 * TurnRecord link, so shared conversion remains a later integration-owned step.
 */
export function buildReflectionEvidenceProposal(
  input: ReflectionRecord
): ReflectionEvidenceProposal | null {
  const record = reflectionRecordSchema.parse(input);

  if (record.recordStatus !== 'active' || record.privacy !== 'normal') return null;
  if (!record.response.trim()) return null;

  if (record.decision === 'confirm' && record.epistemicStatus === 'confirmed') {
    const interpretation = record.interpretation?.trim();
    return {
      reflectionId: record.id,
      sourceKind: record.sourceKind,
      sourceIds: [...record.sourceIds],
      decision: 'confirm',
      epistemicStatus: 'confirmed',
      claim: interpretation ? record.interpretation! : record.response,
      claimSource: interpretation ? 'confirmed-interpretation' : 'explicit-response',
      response: record.response,
      createdAt: record.createdAt
    };
  }

  if (record.decision === 'partial' && record.epistemicStatus === 'partial') {
    return {
      reflectionId: record.id,
      sourceKind: record.sourceKind,
      sourceIds: [...record.sourceIds],
      decision: 'partial',
      epistemicStatus: 'partial',
      claim: record.response,
      claimSource: 'explicit-response',
      response: record.response,
      createdAt: record.createdAt
    };
  }

  return null;
}
