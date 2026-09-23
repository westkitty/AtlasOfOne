import type { KnowledgeGap } from './schema';

export function selectKnowledgeGapById(
  gaps: readonly KnowledgeGap[],
  id: string
): KnowledgeGap | undefined {
  return gaps.find((gap) => gap.id === id);
}

export function selectOpenKnowledgeGaps(
  gaps: readonly KnowledgeGap[]
): KnowledgeGap[] {
  return gaps.filter((gap) => gap.status === 'open');
}

export function selectKnowledgeGapsForTerritory(
  gaps: readonly KnowledgeGap[],
  territoryId: string
): KnowledgeGap[] {
  return gaps.filter((gap) => gap.territoryIds.includes(territoryId));
}

export function selectKnowledgeGapsForDimension(
  gaps: readonly KnowledgeGap[],
  dimensionId: string
): KnowledgeGap[] {
  return gaps.filter((gap) => gap.dimensionIds.includes(dimensionId));
}

export function selectKnowledgeGapsByKind(
  gaps: readonly KnowledgeGap[],
  kind: KnowledgeGap['kind']
): KnowledgeGap[] {
  return gaps.filter((gap) => gap.kind === kind);
}

/**
 * Stable candidate order for already-scored gaps.
 *
 * K01 owns how priority is computed (undercoverage + age since last exploration).
 * K00 only makes the result deterministic: highest numeric priority first, then
 * stable ID as the tie-breaker. No trauma/drama/content weighting occurs here.
 */
export function selectRankedOpenKnowledgeGaps(
  gaps: readonly KnowledgeGap[]
): KnowledgeGap[] {
  return selectOpenKnowledgeGaps(gaps).sort(
    (left, right) => (right.priority - left.priority) || left.id.localeCompare(right.id)
  );
}

/**
 * Source inspection helper only. Privacy/retraction eligibility is deliberately
 * not decided here; K05/M06 own that provenance boundary.
 */
export function knowledgeGapSourceIds(gap: KnowledgeGap): string[] {
  return [...gap.sourceEvidenceIds, ...gap.sourceJournalEntryIds];
}
