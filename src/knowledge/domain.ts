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
 * K01 supplies deterministic undercoverage/age factors. Later K02-K04 compose
 * the remaining explicit-interest/contradiction/diversity/cooldown factors into
 * stored priority. K00 only consumes that numeric result: highest first, then
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


const DAY_MS = 24 * 60 * 60 * 1000;

export interface KnowledgeGapBaseScoringContext {
  /** Eligible dimensions already explored/covered in the relevant Atlas scope. */
  coveredDimensionIds: readonly string[];
  /**
   * Supplied explicitly so scoring is deterministic and testable. No Date.now()
   * call is allowed inside K01.
   */
  now: string;
  /**
   * Most recent eligible exploration of this gap/theme. Undefined/null means
   * Atlas has no recorded exploration yet.
   */
  lastExploredAt?: string | null;
}

export interface KnowledgeGapUndercoverageScore {
  targetDimensionCount: number;
  missingDimensionCount: number;
  missingDimensionIds: string[];
  /** 0..1, based only on gap.dimensionIds and eligible covered dimensions. */
  ratio: number;
}

export interface KnowledgeGapAgeScore {
  neverExplored: boolean;
  /**
   * Whole elapsed days when known. null means "never explored" rather than a
   * fabricated large number.
   */
  daysSinceLastExploration: number | null;
}

export interface KnowledgeGapBaseScore {
  gapId: string;
  undercoverage: KnowledgeGapUndercoverageScore;
  age: KnowledgeGapAgeScore;
}

function parseTimestamp(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label} timestamp: ${value}`);
  return parsed;
}

/**
 * Score only the undercoverage factor named by the master plan.
 *
 * Duplicate dimension IDs never inflate the score, and dimensions outside this
 * gap are irrelevant. Text, kind, emotional language and dramatic framing are
 * intentionally not inputs.
 */
export function scoreKnowledgeGapUndercoverage(
  gap: KnowledgeGap,
  coveredDimensionIds: readonly string[]
): KnowledgeGapUndercoverageScore {
  const targets = [...new Set(gap.dimensionIds)];
  const covered = new Set(coveredDimensionIds);
  const missingDimensionIds = targets.filter((id) => !covered.has(id));

  return {
    targetDimensionCount: targets.length,
    missingDimensionCount: missingDimensionIds.length,
    missingDimensionIds,
    ratio: targets.length === 0 ? 0 : missingDimensionIds.length / targets.length
  };
}

/**
 * Score only age since last eligible exploration.
 *
 * "Never explored" remains a separate boolean instead of pretending it happened
 * N days ago. Future timestamps caused by clock drift clamp to zero elapsed days.
 */
export function scoreKnowledgeGapAge(
  now: string,
  lastExploredAt?: string | null
): KnowledgeGapAgeScore {
  const nowMs = parseTimestamp(now, 'now');
  if (!lastExploredAt) {
    return { neverExplored: true, daysSinceLastExploration: null };
  }

  const lastMs = parseTimestamp(lastExploredAt, 'last exploration');
  return {
    neverExplored: false,
    daysSinceLastExploration: Math.max(0, Math.floor((nowMs - lastMs) / DAY_MS))
  };
}

export function scoreKnowledgeGapBase(
  gap: KnowledgeGap,
  context: KnowledgeGapBaseScoringContext
): KnowledgeGapBaseScore {
  return {
    gapId: gap.id,
    undercoverage: scoreKnowledgeGapUndercoverage(gap, context.coveredDimensionIds),
    age: scoreKnowledgeGapAge(context.now, context.lastExploredAt)
  };
}

/**
 * Stable K01-only ordering with no arbitrary weighted blend:
 *
 * 1. larger undercoverage ratio;
 * 2. larger absolute missing-dimension count;
 * 3. never-explored before previously explored;
 * 4. older exploration before newer;
 * 5. stable gap ID.
 *
 * Later K02-K04 may add other explicit factors before final stored priority is
 * produced; this comparator does not claim to be the finished director ranking.
 */
export function compareKnowledgeGapBaseScores(
  left: KnowledgeGapBaseScore,
  right: KnowledgeGapBaseScore
): number {
  const ratio = right.undercoverage.ratio - left.undercoverage.ratio;
  if (ratio !== 0) return ratio;

  const missing = right.undercoverage.missingDimensionCount - left.undercoverage.missingDimensionCount;
  if (missing !== 0) return missing;

  if (left.age.neverExplored !== right.age.neverExplored) {
    return left.age.neverExplored ? -1 : 1;
  }

  const leftDays = left.age.daysSinceLastExploration ?? 0;
  const rightDays = right.age.daysSinceLastExploration ?? 0;
  const age = rightDays - leftDays;
  if (age !== 0) return age;

  return left.gapId.localeCompare(right.gapId);
}
