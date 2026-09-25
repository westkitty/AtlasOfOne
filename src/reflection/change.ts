import type { CampaignState } from '../game/types';
import { buildReflectionProvenanceDelta } from './provenance';
import type { ReflectionRecord } from './schema';

export interface ChangeOverTimeCandidate {
  kind: 'revision-review';
  reflectionId: string;
  sourceKind: ReflectionRecord['sourceKind'];
  sourceIds: string[];
  /**
   * Atlas's earlier interpretation. This is NOT relabeled as a prior Greyson
   * belief merely because Greyson later revised it.
   */
  priorInterpretation: string;
  priorAuthority: 'atlas-interpretation';
  /** Greyson's explicit replacement/amendment wording. */
  replacementClaim: string;
  replacementAuthority: 'greyson-revision';
  /**
   * Timestamp of the Reflection record, not a claimed time when Greyson changed.
   * The v2 Reflection schema has no decisionAt field, so RF07 does not fabricate one.
   */
  reflectionCreatedAt: string;
  /**
   * Downstream UI/logic must distinguish "I changed" from "Atlas was wrong
   * before" before treating this as actual change-over-time.
   */
  requiresChangeConfirmation: true;
}

function comparableText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/**
 * RF07 correction-or-change review candidate detector.
 *
 * This does not infer that Greyson changed his mind. REVISE proves only that
 * Greyson replaced/amended Atlas's proposed interpretation. The difference may
 * mean either:
 *
 * - Atlas was wrong before; or
 * - Greyson actually changed over time.
 *
 * RF07 preserves that ambiguity as data. A later human-authority surface must
 * confirm actual change before downstream code may state it as change-over-time.
 *
 * A candidate is emitted only when RF05 can prove:
 * - the Reflection is still structurally eligible;
 * - the explicit revision has non-empty replacement wording;
 * - the earlier Atlas interpretation is still available;
 * - old/new wording is not merely the same normalized text.
 *
 * The result is proposal/candidate data only. It does not mutate Evidence,
 * Contradiction, KnowledgeGap, CampaignState or progression.
 */
export function detectChangeOverTimeCandidate(
  state: CampaignState,
  reflectionId: string
): ChangeOverTimeCandidate | null {
  const delta = buildReflectionProvenanceDelta(state, reflectionId);
  if (!delta || delta.kind !== 'revision') return null;

  const priorInterpretation = delta.originalInterpretation?.trim();
  const replacementClaim = delta.replacementClaim.trim();

  // Do not manufacture a historical "before" interpretation when none was
  // preserved. More importantly, never promote it into a Greyson-authored claim.
  if (!priorInterpretation) return null;

  // Explicit REVISE is the authority signal for a difference worth reviewing.
  // This equality guard only suppresses no-op wording changes; it is not
  // semantic similarity analysis and does not decide whether Greyson changed.
  if (comparableText(priorInterpretation) === comparableText(replacementClaim)) return null;

  return {
    kind: 'revision-review',
    reflectionId: delta.reflectionId,
    sourceKind: delta.sourceKind,
    sourceIds: [...delta.sourceIds],
    priorInterpretation,
    priorAuthority: 'atlas-interpretation',
    replacementClaim,
    replacementAuthority: 'greyson-revision',
    reflectionCreatedAt: delta.createdAt,
    requiresChangeConfirmation: true
  };
}
