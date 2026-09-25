import type { ContradictionRecord } from '../game/types';
import type { KnowledgeGap } from './schema';

export const GAP_CONTRADICTION_RELEVANCE_POINTS = 10;
export const GAP_CONFIRMED_CHANGE_RELEVANCE_POINTS = 10;

export interface KnowledgeStructuralRelevanceInput {
  /**
   * Durable contradictions already admitted by RF06 authority.
   * Only open contradictions can add current relevance.
   */
  contradictions: readonly Pick<ContradictionRecord, 'status' | 'evidenceIds'>[];
  /**
   * Source IDs for change-over-time that Greyson has explicitly confirmed.
   *
   * RF07 correction-or-change candidates MUST NOT be placed here merely because
   * they exist; RF07 deliberately preserves "Atlas was wrong" versus "I changed"
   * as unresolved until a later human-authority confirmation.
   */
  confirmedChangeSourceIds: readonly string[];
}

export interface KnowledgeStructuralRelevanceScore {
  gapId: string;
  basePriority: number;
  contradictionRelevant: boolean;
  confirmedChangeRelevant: boolean;
  contradictionPoints: number;
  confirmedChangePoints: number;
  effectivePriority: number;
}

function overlaps(left: readonly string[], right: ReadonlySet<string>): boolean {
  return left.some((id) => right.has(id));
}

/**
 * K03 structural relevance only.
 *
 * This function never reads gap.summary or any journal/evidence prose. A painful
 * or dramatic topic cannot score higher because of its wording. Relevance comes
 * only from explicit provenance relationships that deterministic Atlas state
 * already knows about.
 *
 * The 10/10 point values are small, reversible implementation defaults layered
 * over K01's 0-100 undercoverage/age base score. K03 does not mutate that base.
 */
export function scoreKnowledgeGapStructuralRelevance(
  gap: KnowledgeGap,
  input: KnowledgeStructuralRelevanceInput
): KnowledgeStructuralRelevanceScore {
  const gapEvidenceIds = new Set(gap.sourceEvidenceIds);
  const gapSourceIds = new Set([
    ...gap.sourceEvidenceIds,
    ...gap.sourceJournalEntryIds
  ]);

  const contradictionRelevant = input.contradictions.some(
    (record) =>
      record.status === 'open'
      && overlaps(record.evidenceIds, gapEvidenceIds)
  );

  const confirmedChangeRelevant = overlaps(
    input.confirmedChangeSourceIds,
    gapSourceIds
  );

  const contradictionPoints = contradictionRelevant
    ? GAP_CONTRADICTION_RELEVANCE_POINTS
    : 0;
  const confirmedChangePoints = confirmedChangeRelevant
    ? GAP_CONFIRMED_CHANGE_RELEVANCE_POINTS
    : 0;

  return {
    gapId: gap.id,
    basePriority: gap.priority,
    contradictionRelevant,
    confirmedChangeRelevant,
    contradictionPoints,
    confirmedChangePoints,
    effectivePriority: gap.priority + contradictionPoints + confirmedChangePoints
  };
}

/**
 * Deterministic structural-relevance ordering for already K01-scored gaps.
 *
 * K04 diversity/cooldown remains a separate later reranking concern. K07 may
 * compose both scores when it selects a seed request; neither packet is allowed
 * to infer importance from prose.
 */
export function rankKnowledgeGapsWithStructuralRelevance(
  gaps: readonly KnowledgeGap[],
  input: KnowledgeStructuralRelevanceInput
): KnowledgeGap[] {
  return gaps
    .filter((gap) => gap.status === 'open')
    .slice()
    .sort((left, right) => {
      const a = scoreKnowledgeGapStructuralRelevance(left, input);
      const b = scoreKnowledgeGapStructuralRelevance(right, input);

      if (a.effectivePriority !== b.effectivePriority) {
        return b.effectivePriority - a.effectivePriority;
      }
      if (a.basePriority !== b.basePriority) {
        return b.basePriority - a.basePriority;
      }
      return left.id.localeCompare(right.id);
    });
}
