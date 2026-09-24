import type { KnowledgeGap } from './schema';

export const GAP_UNDERCOVERAGE_WEIGHT = 70;
export const GAP_AGE_WEIGHT = 30;
export const GAP_AGE_SATURATION_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

export interface TerritoryCoverageInput {
  id: string;
  requiredDimensions: readonly string[];
  coveredDimensions: readonly string[];
}

export interface GapScoreInputs {
  territories: readonly TerritoryCoverageInput[];
  lastExploredAtByTerritory: Readonly<Record<string, string | undefined>>;
  now: string;
}

export interface GapScoreBreakdown {
  undercoverageRatio: number;
  ageRatio: number;
  undercoveragePoints: number;
  agePoints: number;
  total: number;
}

function parseInstant(value: string, label: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid ${label}: ${value}`);
  return parsed;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function territoryUndercoverage(territory: TerritoryCoverageInput): number {
  const required = [...new Set(territory.requiredDimensions)];
  if (required.length === 0) return 0;
  const covered = new Set(territory.coveredDimensions);
  const missing = required.filter((dimension) => !covered.has(dimension)).length;
  return missing / required.length;
}

function territoryAgeRatio(
  territoryId: string,
  lastExploredAtByTerritory: GapScoreInputs['lastExploredAtByTerritory'],
  nowMs: number
): number {
  const lastExploredAt = lastExploredAtByTerritory[territoryId];
  if (lastExploredAt === undefined) return 1;

  const lastMs = parseInstant(lastExploredAt, `lastExploredAt for ${territoryId}`);
  const elapsedDays = Math.max(0, nowMs - lastMs) / DAY_MS;
  return clamp01(elapsedDays / GAP_AGE_SATURATION_DAYS);
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * K01 deterministic base score.
 *
 * This intentionally has only two inputs:
 * - how much required territory coverage is still missing;
 * - how long it has been since those territories were explored.
 *
 * Explicit curiosity, contradiction relevance, journal salience, theme diversity,
 * cooldowns and privacy are separate packets. No gap prose/kind can affect this
 * score, so dramatic or painful material receives no hidden preference.
 */
export function scoreKnowledgeGap(
  gap: KnowledgeGap,
  input: GapScoreInputs
): GapScoreBreakdown {
  const nowMs = parseInstant(input.now, 'now');
  const territoryById = new Map(input.territories.map((territory) => [territory.id, territory]));

  const territories = gap.territoryIds.map((territoryId) => {
    const territory = territoryById.get(territoryId);
    if (!territory) throw new Error(`Unknown KnowledgeGap territory: ${territoryId}`);
    return territory;
  });

  if (territories.length === 0) {
    return {
      undercoverageRatio: 0,
      ageRatio: 0,
      undercoveragePoints: 0,
      agePoints: 0,
      total: 0
    };
  }

  const undercoverageRatio = average(territories.map(territoryUndercoverage));
  const ageRatio = average(
    territories.map((territory) =>
      territoryAgeRatio(territory.id, input.lastExploredAtByTerritory, nowMs)
    )
  );

  const undercoveragePoints = Math.round(undercoverageRatio * GAP_UNDERCOVERAGE_WEIGHT);
  const agePoints = Math.round(ageRatio * GAP_AGE_WEIGHT);

  return {
    undercoverageRatio,
    ageRatio,
    undercoveragePoints,
    agePoints,
    total: undercoveragePoints + agePoints
  };
}

export function withKnowledgeGapScore(
  gap: KnowledgeGap,
  input: GapScoreInputs
): KnowledgeGap {
  return { ...gap, priority: scoreKnowledgeGap(gap, input).total };
}
