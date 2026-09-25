/**
 * P05 explicit budgets for the v2 mode-specific bounded context compilers.
 *
 * Extends (does not replace) the legacy `CONTEXT_BUDGET` in ../context.ts, as
 * plan section 14.3 requires. Item caps follow the 14.3 suggestions; character
 * caps are conservative placeholders until measured against the selected
 * Workers AI model (tracked as P06 / provider evaluation work).
 *
 * Every compiler clips per-item text and stops adding items once either the
 * item cap or the mode's total character cap would be exceeded, so payload
 * size is independent of campaign length.
 */
export const MODE_CONTEXT_BUDGET = {
  journal: {
    currentEntryChars: 4000,
    recentEntries: 3,
    recentEntryChars: 280,
    knowledgeGaps: 3,
    gapSummaryChars: 200,
    totalChars: 6000
  },
  reflection: {
    sources: 6,
    sourceChars: 400,
    reflectionHistory: 4,
    historyChars: 240,
    rejectedInterpretations: 5,
    rejectedChars: 240,
    totalChars: 5000
  },
  adventure: {
    adventureSummary: 1,
    premiseChars: 280,
    recentAdventureActions: 6,
    actionChars: 160,
    /** Memory selection itself is bounded by N03 (`selectMemoriesWithinBudget`). */
    relevantAdventureMemories: 8,
    totalChars: 4000
  },
  snapshot: {
    evidence: 12,
    claimChars: 240,
    confirmedInsights: 5,
    insightChars: 240,
    contradictions: 4,
    contradictionChars: 240,
    reflectionHistory: 4,
    historyChars: 240,
    rejectedInterpretations: 5,
    rejectedChars: 240,
    totalChars: 8000
  }
} as const;

export const clipText = (value: string, limit: number): string =>
  (value.length > limit ? `${value.slice(0, limit)}…` : value);

/**
 * Take items in order while both the item cap and the remaining character
 * budget allow. Items that do not fit are skipped whole (never truncated
 * further), matching N03's selection rule.
 */
export function takeWithinBudget<T>(
  items: readonly T[],
  maxItems: number,
  budget: { remaining: number },
  cost: (item: T) => number
): T[] {
  const taken: T[] = [];
  for (const item of items) {
    if (taken.length >= maxItems) break;
    const c = cost(item);
    if (c > budget.remaining) continue;
    taken.push(item);
    budget.remaining -= c;
  }
  return taken;
}

/** Stable serialization used for size accounting and tests. */
export const serializeModeContext = (context: unknown): string => JSON.stringify(context);
