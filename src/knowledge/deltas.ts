import type { KnowledgeGap } from '../contracts/reflection';
import type { CampaignState } from '../game/types';
import { providerEligibleV2State } from '../persistence/retirement';
import {
  detectChangeOverTimeCandidates,
  detectSupportedContradictionCandidates,
  type ChangeOverTimeCandidate,
  type SupportedContradictionCandidate
} from '../reflection/deltas';

const CONTRADICTION_GAP_PREFIX = 'knowledge_gap_contradiction_';
const CHANGE_GAP_PREFIX = 'knowledge_gap_change_';

export const K03_CONTRADICTION_PRIORITY = 85;
export const K03_COUNTER_LINKED_CHANGE_PRIORITY = 80;
export const K03_SAME_DIMENSION_CHANGE_PRIORITY = 75;

const CONTRADICTION_SUMMARY = 'Supported evidence remains in unresolved tension.';
const CHANGE_SUMMARY = 'Player revision history indicates a possible change over time.';

const compareText = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0;
const sortedUnique = (values: readonly string[]) => [...new Set(values)].sort(compareText);
const encodedIdentity = (parts: readonly string[]) => encodeURIComponent(JSON.stringify(parts));
const pairKey = (ids: readonly string[]) => JSON.stringify(sortedUnique(ids));

export interface RefreshContradictionChangeGapsOptions {
  now?: string;
}

export function contradictionGapId(evidenceIds: readonly string[]): string {
  return `${CONTRADICTION_GAP_PREFIX}${encodedIdentity(sortedUnique(evidenceIds))}`;
}

export function changeGapId(olderEvidenceId: string, newerEvidenceId: string): string {
  return `${CHANGE_GAP_PREFIX}${encodedIdentity([olderEvidenceId, newerEvidenceId])}`;
}

export function isGeneratedContradictionChangeGap(gap: KnowledgeGap): boolean {
  if (gap.sourceJournalEntryIds.length !== 0 || gap.sourceEvidenceIds.length !== 2) return false;
  if (gap.kind === 'contradiction') return gap.id === contradictionGapId(gap.sourceEvidenceIds);
  if (gap.kind === 'change') return gap.id === changeGapId(gap.sourceEvidenceIds[0], gap.sourceEvidenceIds[1]);
  return false;
}

function contradictionGap(candidate: SupportedContradictionCandidate): KnowledgeGap {
  return {
    id: contradictionGapId(candidate.evidenceIds),
    kind: 'contradiction',
    territoryIds: sortedUnique(candidate.territoryIds),
    dimensionIds: sortedUnique(candidate.dimensionIds),
    sourceEvidenceIds: sortedUnique(candidate.evidenceIds),
    sourceJournalEntryIds: [],
    summary: CONTRADICTION_SUMMARY,
    status: 'open',
    priority: K03_CONTRADICTION_PRIORITY
  };
}

function changeGap(state: CampaignState, candidate: ChangeOverTimeCandidate): KnowledgeGap | null {
  const evidenceById = new Map(state.evidence.map((record) => [record.id, record]));
  const older = evidenceById.get(candidate.olderEvidenceId);
  const newer = evidenceById.get(candidate.newerEvidenceId);
  if (!older || !newer || state.privateTopics.includes(candidate.dimensionId)) return null;

  const territoryIds = sortedUnique([...older.territories, ...newer.territories]);
  if (territoryIds.length === 0) return null;

  return {
    id: changeGapId(candidate.olderEvidenceId, candidate.newerEvidenceId),
    kind: 'change',
    territoryIds,
    dimensionIds: [candidate.dimensionId],
    sourceEvidenceIds: [candidate.olderEvidenceId, candidate.newerEvidenceId],
    sourceJournalEntryIds: [],
    summary: CHANGE_SUMMARY,
    status: 'open',
    priority: candidate.relation === 'counter-linked-revision'
      ? K03_COUNTER_LINKED_CHANGE_PRIORITY
      : K03_SAME_DIMENSION_CHANGE_PRIORITY
  };
}

/**
 * Converts only RF06/RF07 structural state into K03 gaps. No claim, answer,
 * Journal, interpretation, or Adventure prose participates in generation or rank.
 */
export function generateContradictionChangeGaps(state: CampaignState): KnowledgeGap[] {
  const eligibleContradictionIds = new Set(providerEligibleV2State(state).contradictionIds);
  const supportedByPair = new Map(
    detectSupportedContradictionCandidates(state).map((candidate) => [pairKey(candidate.evidenceIds), candidate])
  );
  const generated = new Map<string, KnowledgeGap>();

  for (const record of state.contradictions) {
    if (record.status !== 'open' || !eligibleContradictionIds.has(record.id)) continue;
    if (record.evidenceIds.length !== 2 || record.evidenceIds[0] === record.evidenceIds[1]) continue;

    const key = pairKey(record.evidenceIds);
    const candidate = supportedByPair.get(key);
    if (!candidate || candidate.territoryIds.length === 0 || candidate.dimensionIds.length === 0) continue;

    const gap = contradictionGap(candidate);
    generated.set(gap.id, gap);
  }

  for (const candidate of detectChangeOverTimeCandidates(state)) {
    const gap = changeGap(state, candidate);
    if (gap) generated.set(gap.id, gap);
  }

  return [...generated.values()].sort((left, right) => right.priority - left.priority || compareText(left.id, right.id));
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

/** Reconciles only generated OPEN K03 gaps; historical non-open state is immutable here. */
export function refreshContradictionChangeGaps(
  state: CampaignState,
  options: RefreshContradictionChangeGapsOptions = {}
): CampaignState {
  const generated = generateContradictionChangeGaps(state);
  const generatedById = new Map(generated.map((gap) => [gap.id, gap]));
  let changed = false;

  const knowledgeGaps = state.knowledgeGaps.map((gap) => {
    if (!isGeneratedContradictionChangeGap(gap) || gap.status !== 'open') return gap;
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

  return {
    ...state,
    knowledgeGaps: [...knowledgeGaps, ...additions],
    updatedAt: options.now ?? new Date().toISOString()
  };
}
