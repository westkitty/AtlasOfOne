import type { KnowledgeGap } from './schema';

export const GAP_EXACT_REPEAT_COOLDOWN_SELECTIONS = 3;
export const GAP_DIVERSITY_RELEVANCE_WEIGHT = 0.8;
export const GAP_DIVERSITY_NOVELTY_WEIGHT = 0.2;

export interface KnowledgeSelectionHistoryItem {
  gapId: string;
  territoryIds: readonly string[];
  /**
   * Caller-owned stable theme identifiers. Until Adventure themes exist, a
   * caller may use dimension IDs. K04 does not infer themes from prose.
   */
  themeIds: readonly string[];
}

export interface KnowledgeGapDiversityScore {
  gapId: string;
  basePriority: number;
  maxRecentSimilarity: number;
  effectivePriority: number;
  exactRepeatCoolingDown: boolean;
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function jaccard(left: readonly string[], right: readonly string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  if (a.size === 0 && b.size === 0) return 0;

  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function recencyWeight(index: number): number {
  return 1 / (index + 1);
}

function recentSimilarity(
  gap: KnowledgeGap,
  history: readonly KnowledgeSelectionHistoryItem[]
): number {
  const candidateThemes = unique(gap.dimensionIds);
  const candidateTerritories = unique(gap.territoryIds);

  let max = 0;
  for (let index = 0; index < history.length; index += 1) {
    const item = history[index];
    const themeSimilarity = jaccard(candidateThemes, item.themeIds);
    const territorySimilarity = jaccard(candidateTerritories, item.territoryIds);
    const structuralSimilarity = Math.max(themeSimilarity, territorySimilarity);
    max = Math.max(max, structuralSimilarity * recencyWeight(index));
  }
  return max;
}

/**
 * K04 post-score reranking.
 *
 * K01 remains the sole owner of the base priority. K04 only applies a bounded,
 * transparent novelty penalty and a short exact-gap cooldown to the selection
 * order. This is deliberately analogous to MMR-style relevance/diversity
 * reranking rather than a second hidden "importance" model.
 */
export function scoreKnowledgeGapDiversity(
  gap: KnowledgeGap,
  history: readonly KnowledgeSelectionHistoryItem[]
): KnowledgeGapDiversityScore {
  const recent = history.slice(0, GAP_EXACT_REPEAT_COOLDOWN_SELECTIONS);
  const exactRepeatCoolingDown = recent.some((item) => item.gapId === gap.id);
  const maxRecentSimilarity = recentSimilarity(gap, recent);

  const effectivePriority =
    (gap.priority * GAP_DIVERSITY_RELEVANCE_WEIGHT)
    - (100 * maxRecentSimilarity * GAP_DIVERSITY_NOVELTY_WEIGHT);

  return {
    gapId: gap.id,
    basePriority: gap.priority,
    maxRecentSimilarity,
    effectivePriority,
    exactRepeatCoolingDown
  };
}

/**
 * Returns open candidates in deterministic diversity-aware order.
 *
 * Exact repeats from the short cooldown window are ranked behind all non-cooled
 * candidates. They are not deleted: if every available gap is cooling down,
 * Atlas can still return the best one instead of fabricating a new theme.
 */
export function rankKnowledgeGapsWithDiversity(
  gaps: readonly KnowledgeGap[],
  history: readonly KnowledgeSelectionHistoryItem[]
): KnowledgeGap[] {
  const open = gaps.filter((gap) => gap.status === 'open');

  return [...open].sort((left, right) => {
    const a = scoreKnowledgeGapDiversity(left, history);
    const b = scoreKnowledgeGapDiversity(right, history);

    if (a.exactRepeatCoolingDown !== b.exactRepeatCoolingDown) {
      return a.exactRepeatCoolingDown ? 1 : -1;
    }

    // If every available candidate is cooling down, fall back to the strongest
    // base priority rather than applying a second repetition punishment inside
    // the cooled group. Cooldown is a reranking tool, not a dead-end.
    if (a.exactRepeatCoolingDown && b.exactRepeatCoolingDown) {
      if (a.basePriority !== b.basePriority) {
        return b.basePriority - a.basePriority;
      }
      return left.id.localeCompare(right.id);
    }

    if (a.effectivePriority !== b.effectivePriority) {
      return b.effectivePriority - a.effectivePriority;
    }
    if (a.basePriority !== b.basePriority) {
      return b.basePriority - a.basePriority;
    }
    return left.id.localeCompare(right.id);
  });
}
