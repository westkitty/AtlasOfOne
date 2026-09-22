import type { KnowledgeGap } from '../contracts/reflection';
import type { CampaignState, EvidenceRecord, TurnRecord } from '../game/types';
import { providerEligibleV2State, retireIneligibleV2State } from '../persistence/retirement';

const COVERAGE_ID_PREFIX = 'knowledge_gap_coverage_';
const CURIOSITY_ID_PREFIX = 'knowledge_gap_curiosity_';
const DEFAULT_RECENT_RUN_WINDOW = 6;
const DEFAULT_EXACT_GAP_COOLDOWN_RUNS = 2;
const TERRITORY_REPEAT_PENALTY = 8;
const TERRITORY_REPEAT_CAP = 24;
const DIMENSION_REPEAT_PENALTY = 4;
const DIMENSION_REPEAT_CAP = 12;
const SELECTED_TERRITORY_PENALTY = 10;
const SELECTED_DIMENSION_PENALTY = 6;

export interface CoverageGapOptions {
  /** Supply this in deterministic callers and tests. */
  now?: string;
}

export interface KnowledgeGapSelectionOptions {
  /** Open gaps are selected unless this is explicitly enabled. */
  includeNonOpen?: boolean;
  /** A finite non-negative maximum number of gaps to return. */
  limit?: number;
}

export interface DiverseKnowledgeGapSelectionOptions {
  /** A finite non-negative maximum number of gaps to return. */
  limit?: number;
  /** Eligible Adventure runs considered for broad repetition penalties. */
  recentRunWindow?: number;
  /** Eligible Adventure runs that suppress an exact previously used gap. */
  exactGapCooldownRuns?: number;
}

export interface PassiveCoverageScoreInput {
  evidenceCount: number;
  sufficientlyCovered: boolean;
  /** Timestamps from the eligible source turns only. */
  sourceTurnTimestamps: readonly string[];
  /** Explicit reference time; score calculation never reads the clock. */
  now: string;
}

const encodedIdentity = (parts: readonly string[]) => encodeURIComponent(JSON.stringify(parts));

const referenceNow = (options: CoverageGapOptions) => options.now ?? new Date().toISOString();

export function coverageGapId(kind: Extract<KnowledgeGap['kind'], 'unknown' | 'underexplored'>, territoryId: string, dimensionId: string): string {
  return `${COVERAGE_ID_PREFIX}${encodedIdentity([kind, territoryId, dimensionId])}`;
}

export function curiosityGapId(journalEntryId: string): string {
  return `${CURIOSITY_ID_PREFIX}${encodedIdentity([journalEntryId])}`;
}

export function isGeneratedCoverageGap(gap: KnowledgeGap): boolean {
  if (gap.kind !== 'unknown' && gap.kind !== 'underexplored') return false;
  if (gap.territoryIds.length !== 1 || gap.dimensionIds.length !== 1 || gap.sourceJournalEntryIds.length !== 0) return false;
  return gap.id === coverageGapId(gap.kind, gap.territoryIds[0], gap.dimensionIds[0]);
}

function agePoints(sourceTurnTimestamps: readonly string[], now: string): number {
  const reference = Date.parse(now);
  if (!Number.isFinite(reference) || sourceTurnTimestamps.length === 0) return 30;

  const timestamps = sourceTurnTimestamps.map(Date.parse);
  if (timestamps.some((timestamp) => !Number.isFinite(timestamp))) return 30;

  const newest = Math.max(...timestamps);
  const ageDays = (reference - newest) / (24 * 60 * 60 * 1000);
  if (ageDays < 14) return 0;
  if (ageDays < 60) return 10;
  if (ageDays < 180) return 20;
  return 30;
}

/**
 * Content-blind passive coverage scoring. Only evidence count/coverage state
 * and eligible source timestamps participate in this calculation.
 */
export function passiveCoveragePriority(input: PassiveCoverageScoreInput): number | null {
  if (input.sufficientlyCovered) return null;
  const coveragePoints = input.evidenceCount === 0 ? 60 : input.evidenceCount === 1 ? 30 : 15;
  return coveragePoints + agePoints(input.sourceTurnTimestamps, input.now);
}

function eligibleEvidenceForDimension(state: CampaignState, territoryId: string, dimensionId: string): EvidenceRecord[] {
  const turnsById = new Map(state.turns.map((turn) => [turn.id, turn]));
  return state.evidence
    .filter((evidence) => evidence.status === 'active'
      && evidence.dimension === dimensionId
      && evidence.territories.includes(territoryId)
      && !state.privateTopics.includes(evidence.dimension)
      && evidence.sourceTurnIds.length > 0
      && evidence.sourceTurnIds.every((sourceId) => {
        const turn = turnsById.get(sourceId);
        return Boolean(turn && !turn.retracted && !state.privateTopics.includes(turn.dimension));
      }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function eligibleTurnTimestamps(evidence: readonly EvidenceRecord[], turns: readonly TurnRecord[]): string[] {
  const turnsById = new Map(turns.map((turn) => [turn.id, turn]));
  return [...new Set(evidence.flatMap((record) => record.sourceTurnIds))]
    .sort((left, right) => left.localeCompare(right))
    .map((sourceId) => turnsById.get(sourceId)?.createdAt ?? '');
}

function sufficientCoverage(evidence: readonly EvidenceRecord[]): boolean {
  const sourceTurnIds = new Set(evidence.flatMap((record) => record.sourceTurnIds));
  return sourceTurnIds.size >= 2 && evidence.some((record) => record.strength >= 2);
}

/** Generates passive coverage gaps from authoritative local campaign state only. */
export function generateCoverageGaps(state: CampaignState, options: CoverageGapOptions = {}): KnowledgeGap[] {
  const now = referenceNow(options);
  return [...state.territories]
    .sort((left, right) => left.id.localeCompare(right.id))
    .flatMap((territory) => [...territory.requiredDimensions]
      .sort((left, right) => left.localeCompare(right))
      .filter((dimensionId) => !state.privateTopics.includes(dimensionId))
      .flatMap((dimensionId) => {
        const evidence = eligibleEvidenceForDimension(state, territory.id, dimensionId);
        const sufficientlyCovered = sufficientCoverage(evidence);
        const priority = passiveCoveragePriority({
          evidenceCount: evidence.length,
          sufficientlyCovered,
          sourceTurnTimestamps: eligibleTurnTimestamps(evidence, state.turns),
          now
        });
        if (priority === null) return [];
        const kind = evidence.length === 0 ? 'unknown' : 'underexplored';
        return [{
          id: coverageGapId(kind, territory.id, dimensionId),
          kind,
          territoryIds: [territory.id],
          dimensionIds: [dimensionId],
          sourceEvidenceIds: evidence.map((record) => record.id),
          sourceJournalEntryIds: [],
          summary: `Coverage for ${territory.label} / ${dimensionId} remains ${kind === 'unknown' ? 'unknown' : 'underexplored'}.`,
          status: 'open',
          priority
        } satisfies KnowledgeGap];
      }));
}

/** Returns RF09-eligible persisted gaps in deterministic selection order. */
export function selectKnowledgeGaps(state: CampaignState, options: KnowledgeGapSelectionOptions = {}): KnowledgeGap[] {
  const gaps = providerEligibleV2State(state).knowledgeGaps
    .filter((gap) => gap.dimensionIds.every((dimensionId) => !state.privateTopics.includes(dimensionId)))
    .filter((gap) => options.includeNonOpen || gap.status === 'open')
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  const limit = options.limit;
  if (limit === undefined || !Number.isFinite(limit)) return gaps;
  return gaps.slice(0, Math.max(0, Math.floor(limit)));
}

const normalizedWindow = (value: number | undefined, fallback: number): number =>
  value === undefined || !Number.isFinite(value) || value < 0 ? fallback : Math.floor(value);

const normalizedLimit = (value: number | undefined, fallback: number): number =>
  value === undefined ? fallback : !Number.isFinite(value) || value < 0 ? 0 : Math.min(fallback, Math.floor(value));

const hasOverlap = (left: readonly string[], right: readonly string[]) => {
  const rightIds = new Set(right);
  return left.some((id) => rightIds.has(id));
};

interface EligibleAdventureHistory {
  id: string;
  timestamp: number | null;
  seed: CampaignState['adventureSeeds'][number];
}

function eligibleAdventureHistory(state: CampaignState): EligibleAdventureHistory[] {
  const eligibleSeeds = new Map(providerEligibleV2State(state).adventureSeeds.map((seed) => [seed.id, seed]));
  return state.adventureRuns
    .flatMap((run) => {
      const seed = eligibleSeeds.get(run.seedId);
      if (!seed) return [];
      const timestamp = Date.parse(run.completedAt ?? run.startedAt);
      return [{ id: run.id, timestamp: Number.isFinite(timestamp) ? timestamp : null, seed }];
    })
    .sort((left, right) => {
      if (left.timestamp !== null && right.timestamp !== null) return right.timestamp - left.timestamp || left.id.localeCompare(right.id);
      if (left.timestamp !== null) return -1;
      if (right.timestamp !== null) return 1;
      return left.id.localeCompare(right.id);
    });
}

function incrementCounts(counts: Map<string, number>, ids: readonly string[]): void {
  for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
}

/**
 * Reorders the RF09/K05-safe open selector result without changing persisted
 * priorities. Only eligible Adventure IDs, territory IDs, dimension IDs and
 * timestamps participate; no player or Adventure content is inspected.
 */
export function selectDiverseKnowledgeGaps(state: CampaignState, options: DiverseKnowledgeGapSelectionOptions = {}): KnowledgeGap[] {
  const baseCandidates = selectKnowledgeGaps(state);
  const history = eligibleAdventureHistory(state);
  const limit = normalizedLimit(options.limit, baseCandidates.length);
  const validRecentHistory = history.filter((entry) => entry.timestamp !== null);
  if (validRecentHistory.length === 0) return baseCandidates.slice(0, limit);

  const cooldownRuns = normalizedWindow(options.exactGapCooldownRuns, DEFAULT_EXACT_GAP_COOLDOWN_RUNS);
  const cooldownGapIds = new Set(validRecentHistory.slice(0, cooldownRuns).flatMap(({ seed }) => seed.sourceGapIds));
  const candidates = baseCandidates.filter((gap) => !cooldownGapIds.has(gap.id));
  const recentRuns = validRecentHistory.slice(0, normalizedWindow(options.recentRunWindow, DEFAULT_RECENT_RUN_WINDOW));
  const recentTerritoryCounts = new Map<string, number>();
  const recentDimensionCounts = new Map<string, number>();
  const eligibleGapsById = new Map(selectKnowledgeGaps(state, { includeNonOpen: true }).map((gap) => [gap.id, gap]));

  for (const { seed } of recentRuns) {
    incrementCounts(recentTerritoryCounts, [seed.territoryId]);
    for (const gapId of seed.sourceGapIds) {
      const sourceGap = eligibleGapsById.get(gapId);
      if (sourceGap) incrementCounts(recentDimensionCounts, sourceGap.dimensionIds);
    }
  }

  const selected: KnowledgeGap[] = [];
  const selectedNonCuriosity: KnowledgeGap[] = [];
  const effectiveScore = (gap: KnowledgeGap): number => {
    if (gap.kind === 'curiosity') return gap.priority;
    const territoryRepeatCount = gap.territoryIds.reduce((total, id) => total + (recentTerritoryCounts.get(id) ?? 0), 0);
    const dimensionRepeatCount = gap.dimensionIds.reduce((total, id) => total + (recentDimensionCounts.get(id) ?? 0), 0);
    const hasSelectedTerritory = selectedNonCuriosity.some((selectedGap) => hasOverlap(gap.territoryIds, selectedGap.territoryIds));
    const hasSelectedDimension = selectedNonCuriosity.some((selectedGap) => hasOverlap(gap.dimensionIds, selectedGap.dimensionIds));
    return gap.priority
      - Math.min(TERRITORY_REPEAT_CAP, TERRITORY_REPEAT_PENALTY * territoryRepeatCount)
      - Math.min(DIMENSION_REPEAT_CAP, DIMENSION_REPEAT_PENALTY * dimensionRepeatCount)
      - (hasSelectedTerritory ? SELECTED_TERRITORY_PENALTY : 0)
      - (hasSelectedDimension ? SELECTED_DIMENSION_PENALTY : 0);
  };

  while (candidates.length > 0 && selected.length < limit) {
    let bestIndex = 0;
    for (let index = 1; index < candidates.length; index += 1) {
      const candidate = candidates[index];
      const best = candidates[bestIndex];
      const comparison = effectiveScore(candidate) - effectiveScore(best)
        || candidate.priority - best.priority
        || best.id.localeCompare(candidate.id);
      if (comparison > 0) bestIndex = index;
    }
    const [next] = candidates.splice(bestIndex, 1);
    selected.push(next);
    if (next.kind !== 'curiosity') selectedNonCuriosity.push(next);
  }

  return selected;
}

const sameGap = (left: KnowledgeGap, right: KnowledgeGap) =>
  left.id === right.id
  && left.kind === right.kind
  && left.status === right.status
  && left.priority === right.priority
  && left.summary === right.summary
  && JSON.stringify(left.territoryIds) === JSON.stringify(right.territoryIds)
  && JSON.stringify(left.dimensionIds) === JSON.stringify(right.dimensionIds)
  && JSON.stringify(left.sourceEvidenceIds) === JSON.stringify(right.sourceEvidenceIds)
  && JSON.stringify(left.sourceJournalEntryIds) === JSON.stringify(right.sourceJournalEntryIds);

/**
 * Reconciles only deterministic passive coverage gaps. Manual, curiosity and
 * non-open generated records are deliberately left alone.
 */
export function refreshCoverageGaps(state: CampaignState, options: CoverageGapOptions = {}): CampaignState {
  const now = referenceNow(options);
  const generated = generateCoverageGaps(state, { now });
  const generatedById = new Map(generated.map((gap) => [gap.id, gap]));
  let changed = false;

  const knowledgeGaps = state.knowledgeGaps.map((gap) => {
    if (!isGeneratedCoverageGap(gap) || gap.status !== 'open') return gap;
    const replacement = generatedById.get(gap.id);
    if (replacement) {
      if (sameGap(gap, replacement)) return gap;
      changed = true;
      return replacement;
    }
    changed = true;
    return { ...gap, status: 'resolved' as const };
  });
  const existingIds = new Set(state.knowledgeGaps.map((gap) => gap.id));
  const additions = generated.filter((gap) => !existingIds.has(gap.id));
  if (additions.length > 0) changed = true;
  if (!changed) return state;
  return { ...state, knowledgeGaps: [...knowledgeGaps, ...additions], updatedAt: now };
}

/**
 * Explicit player-owned retirement for one exact durable Knowledge gap.
 *
 * This changes lifecycle state only. Source Journal/evidence/history is preserved,
 * and the canonical structural retirement pass handles dependent seed eligibility.
 */
export function retireKnowledgeGap(state: CampaignState, gapId: string, options: CoverageGapOptions = {}): CampaignState {
  const target = state.knowledgeGaps.find((gap) => gap.id === gapId);
  if (!target || (target.status !== 'open' && target.status !== 'seeded')) return state;

  const now = referenceNow(options);
  const knowledgeGaps = state.knowledgeGaps.map((gap) => gap.id === gapId ? { ...gap, status: 'retired' as const } : gap);
  return retireIneligibleV2State({ ...state, knowledgeGaps, updatedAt: now });
}

/** Creates a durable gap only after an explicit player "Explore this" action. */
export function markJournalForExploration(state: CampaignState, journalEntryId: string, options: CoverageGapOptions = {}): CampaignState {
  const gapId = curiosityGapId(journalEntryId);
  if (state.knowledgeGaps.some((gap) => gap.id === gapId)) return state;
  if (!providerEligibleV2State(state).journalEntryIds.includes(journalEntryId)) return state;

  const now = referenceNow(options);
  const gap: KnowledgeGap = {
    id: gapId,
    kind: 'curiosity',
    territoryIds: [state.activeTerritory],
    dimensionIds: [],
    sourceEvidenceIds: [],
    sourceJournalEntryIds: [journalEntryId],
    summary: 'Player explicitly chose to explore a Journal entry.',
    status: 'open',
    priority: 100
  };
  return { ...state, knowledgeGaps: [...state.knowledgeGaps, gap], updatedAt: now };
}
