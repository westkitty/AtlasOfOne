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

/**
 * K06 user-owned "do not explore this" transition.
 *
 * Retirement preserves the gap, summary, source IDs and prior priority as
 * history. It only changes selection authority. Resolved gaps are already
 * closed history and are not silently relabeled as user-retired.
 */
export function retireKnowledgeGap(gap: KnowledgeGap): KnowledgeGap {
  if (gap.status === 'retired') return gap;
  if (gap.status === 'resolved') {
    throw new Error(`KnowledgeGap ${gap.id} is resolved and cannot be retired as an exploration preference.`);
  }
  return { ...gap, status: 'retired' };
}

export function retireKnowledgeGapById(
  gaps: readonly KnowledgeGap[],
  id: string
): KnowledgeGap[] {
  const index = gaps.findIndex((gap) => gap.id === id);
  if (index < 0) throw new Error(`Unknown KnowledgeGap id: ${id}`);

  const current = gaps[index];
  const retired = retireKnowledgeGap(current);
  if (retired === current) return [...gaps];

  const next = [...gaps];
  next[index] = retired;
  return next;
}

