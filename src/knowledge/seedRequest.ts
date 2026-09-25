import { z } from 'zod';
import { adventureKindSchema, type AdventureKind } from '../adventure/schema';
import type { CampaignState } from '../game/types';
import {
  GAP_EXACT_REPEAT_COOLDOWN_SELECTIONS,
  rankKnowledgeGapsWithDiversity,
  type KnowledgeSelectionHistoryItem
} from './diversity';
import { selectEligibleKnowledgeGaps } from './eligibility';
import { scoreKnowledgeGapStructuralRelevance } from './relevance';
import { scoreKnowledgeGap } from './scoring';

export const ADVENTURE_SEED_REQUEST_VERSION = 1 as const;
export const DEFAULT_GAP_SEED_KIND: AdventureKind = 'investigation';

export const adventureSeedRequestSchema = z.object({
  requestVersion: z.literal(ADVENTURE_SEED_REQUEST_VERSION),
  gapId: z.string().min(1),
  sourceGapIds: z.array(z.string().min(1)).min(1),
  territoryId: z.string().min(1),
  dimensionIds: z.array(z.string()),
  kind: adventureKindSchema.refine((kind) => kind !== 'pure-fun', {
    message: 'Gap seed requests may not use the pure-fun kind.'
  }),
  learningTarget: z.literal('reflection-eligible'),
  /** Stable IDs of gaps withheld by K05/K06 before selection. IDs only, never summaries. */
  excludedGapIds: z.array(z.string()),
  scoring: z.object({
    basePriority: z.number(),
    relevancePoints: z.number(),
    rankedPriority: z.number(),
    exactRepeatCoolingDown: z.boolean()
  }).strict()
}).strict();

export type AdventureSeedRequest = z.infer<typeof adventureSeedRequestSchema>;

export interface AdventureSeedRequestInput {
  now: string;
  lastExploredAtByTerritory: Readonly<Record<string, string | undefined>>;
  confirmedChangeSourceIds: readonly string[];
  /** Most-recent-first selection history (K04). */
  history: readonly KnowledgeSelectionHistoryItem[];
  kind?: AdventureKind;
}

/**
 * K07 deterministic KnowledgeGap -> AdventureSeed request.
 *
 * Order is fixed and privacy comes first:
 * 1. K05/K06 eligibility (open + structurally visible). PRIVATE, retracted,
 *    retired and non-open gaps are removed BEFORE any scoring or ranking;
 * 2. K01 undercoverage/age base score from current territory state;
 * 3. K03 structural relevance points (provenance only);
 * 4. K04 diversity/cooldown reranking.
 *
 * No step reads gap.summary or Journal prose. Returns null when nothing is
 * eligible rather than fabricating a request. Never calls a provider and
 * never mutates state. The model may later propose a premise for the returned
 * request but cannot change its gaps, territory, kind or learningTarget.
 */
export function buildAdventureSeedRequest(
  state: CampaignState,
  input: AdventureSeedRequestInput
): AdventureSeedRequest | null {
  const kind = input.kind ?? DEFAULT_GAP_SEED_KIND;
  if (kind === 'pure-fun') {
    throw new Error('pure-fun seeds do not come from KnowledgeGaps; use the A09 pure-fun path.');
  }

  const eligible = selectEligibleKnowledgeGaps(state);
  if (eligible.length === 0) return null;

  const eligibleIds = new Set(eligible.map((gap) => gap.id));
  const excludedGapIds = state.knowledgeGaps
    .map((gap) => gap.id)
    .filter((id) => !eligibleIds.has(id))
    .sort();

  const territories = state.territories.map((territory) => ({
    id: territory.id,
    requiredDimensions: territory.requiredDimensions,
    coveredDimensions: territory.coveredDimensions
  }));

  const scored = new Map(eligible.map((gap) => {
    const base = scoreKnowledgeGap(gap, {
      territories,
      lastExploredAtByTerritory: input.lastExploredAtByTerritory,
      now: input.now
    }).total;
    const relevance = scoreKnowledgeGapStructuralRelevance(
      { ...gap, priority: base },
      {
        contradictions: state.contradictions,
        confirmedChangeSourceIds: input.confirmedChangeSourceIds
      }
    );
    const relevancePoints = relevance.contradictionPoints + relevance.confirmedChangePoints;
    return [gap.id, { gap: { ...gap, priority: base + relevancePoints }, base, relevancePoints }] as const;
  }));

  const selected = rankKnowledgeGapsWithDiversity(
    [...scored.values()].map((entry) => entry.gap),
    input.history
  )[0];
  if (!selected) return null;

  const territoryId = [...new Set(selected.territoryIds)].sort()[0];
  if (!territoryId) return null;

  const entry = scored.get(selected.id)!;
  const recent = input.history.slice(0, GAP_EXACT_REPEAT_COOLDOWN_SELECTIONS);

  return adventureSeedRequestSchema.parse({
    requestVersion: ADVENTURE_SEED_REQUEST_VERSION,
    gapId: selected.id,
    sourceGapIds: [selected.id],
    territoryId,
    dimensionIds: [...new Set(selected.dimensionIds)].sort(),
    kind,
    learningTarget: 'reflection-eligible',
    excludedGapIds,
    scoring: {
      basePriority: entry.base,
      relevancePoints: entry.relevancePoints,
      rankedPriority: selected.priority,
      exactRepeatCoolingDown: recent.some((item) => item.gapId === selected.id)
    }
  });
}
