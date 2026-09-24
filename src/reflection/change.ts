import type { CampaignState } from '../game/types';
import { buildReflectionProvenanceDelta } from './provenance';
import type { ReflectionRecord } from './schema';

export interface ChangeOverTimeCandidate {
  kind: 'explicit-revision';
  reflectionId: string;
  sourceKind: ReflectionRecord['sourceKind'];
  sourceIds: string[];
  priorClaim: string;
  replacementClaim: string;
  changedAt: string;
}

function comparableText(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

/**
 * RF07 explicit changed-mind/change-over-time candidate detector.
 *
 * This does not infer semantic change from arbitrary old/new prose. The signal
 * of change is Greyson's explicit REVISE decision already preserved by RF05.
 *
 * A candidate is emitted only when RF05 can prove:
 * - the Reflection is still structurally eligible;
 * - the explicit revision has non-empty replacement wording;
 * - the historical interpretation being revised is still available;
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

  const priorClaim = delta.originalInterpretation?.trim();
  const replacementClaim = delta.replacementClaim.trim();

  // Do not manufacture a historical "before" claim when the old
  // interpretation was never preserved.
  if (!priorClaim) return null;

  // Explicit REVISE is the authority signal. This equality guard only suppresses
  // no-op wording changes; it is not semantic similarity analysis.
  if (comparableText(priorClaim) === comparableText(replacementClaim)) return null;

  return {
    kind: 'explicit-revision',
    reflectionId: delta.reflectionId,
    sourceKind: delta.sourceKind,
    sourceIds: [...delta.sourceIds],
    priorClaim,
    replacementClaim,
    changedAt: delta.createdAt
  };
}
