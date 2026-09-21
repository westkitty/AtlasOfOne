import type { KnowledgeGap } from '../contracts/reflection';
import type { CampaignState, EvidenceRecord, TurnRecord } from '../game/types';
import { providerEligibleV2State } from '../persistence/retirement';

const COVERAGE_ID_PREFIX = 'knowledge_gap_coverage_';
const CURIOSITY_ID_PREFIX = 'knowledge_gap_curiosity_';

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

export interface PassiveCoverageScoreInput {
  evidenceCount: number;
  sufficientlyCovered: boolean;
  /** Timestamps from the eligible source turns only. */
  sourceTurnTimestamps: readonly string[];
  /** Explicit reference time; score calculation never reads the clock. */
  now: string;
}

const safeSlug = (value: string) => {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'item';
};

const referenceNow = (options: CoverageGapOptions) => options.now ?? new Date().toISOString();

export function coverageGapId(kind: Extract<KnowledgeGap['kind'], 'unknown' | 'underexplored'>, territoryId: string, dimensionId: string): string {
  return `${COVERAGE_ID_PREFIX}${safeSlug(kind)}_${safeSlug(territoryId)}_${safeSlug(dimensionId)}`;
}

export function curiosityGapId(journalEntryId: string): string {
  return `${CURIOSITY_ID_PREFIX}${safeSlug(journalEntryId)}`;
}

export function isGeneratedCoverageGap(gap: KnowledgeGap): boolean {
  return gap.id.startsWith(COVERAGE_ID_PREFIX);
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
    .filter((gap) => options.includeNonOpen || gap.status === 'open')
    .sort((left, right) => right.priority - left.priority || left.id.localeCompare(right.id));
  const limit = options.limit;
  if (limit === undefined || !Number.isFinite(limit)) return gaps;
  return gaps.slice(0, Math.max(0, Math.floor(limit)));
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
