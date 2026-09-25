import type { CampaignState, EvidenceRecord } from '../game/types';
import { createV2ProvenanceVisibility } from '../persistence/retirement';
import { selectLatestAtlasSnapshot } from './history';

/**
 * S01 deterministic Snapshot eligibility / request path.
 *
 * Plan 15.3: the first Snapshot may come from a deterministic coverage milestone
 * (or an explicit Greyson request); later Snapshots come from a bounded cadence
 * or an explicit Greyson request. Never from CAMPAIGN_COMPLETED.
 *
 * Only provenance-visible, human-authored material counts:
 * - EvidenceRecord: status `active`, dimension not PRIVATE (M06/F-visibility),
 *   and origin `player-stated` (model-proposed/engine-derived never count);
 * - InsightRecord: status `confirmed` and every supporting evidence qualifies;
 * - ContradictionRecord: every supporting evidence qualifies.
 *
 * AdventureObservations and Reflections are never counted: the Snapshot schema
 * carries only evidence/insight/contradiction provenance, and fictional actions
 * are never Evidence about Greyson.
 *
 * This decides only whether a request may be made. It does not write state.
 */

export type SnapshotRequestTrigger = 'milestone' | 'cadence' | 'explicit-request';

export const SNAPSHOT_ELIGIBILITY_RULES = {
  /** Minimum qualifying evidence for any Snapshot. */
  minEvidence: 3,
  /** First-Snapshot milestone: distinct dimensions covered by qualifying evidence. */
  milestoneMinDimensions: 6,
  /** Bounded cadence between automatic Snapshots. */
  cadenceMinIntervalMs: 7 * 24 * 60 * 60 * 1000,
  /** Bound on explicit requests so a button cannot spam history. */
  explicitMinIntervalMs: 24 * 60 * 60 * 1000
} as const;

export type SnapshotIneligibleReason =
  | 'invalid-requested-at'
  | 'insufficient-evidence'
  | 'milestone-not-reached'
  | 'cadence-not-first-snapshot'
  | 'milestone-only-first-snapshot'
  | 'too-soon'
  | 'no-new-material';

export interface AtlasSnapshotRequest {
  trigger: SnapshotRequestTrigger;
  requestedAt: string;
  previousSnapshotId?: string;
  evidenceIds: string[];
  insightIds: string[];
  contradictionIds: string[];
  /** Qualifying IDs not referenced by the previous Snapshot ("what changed"). */
  newSourceIds: string[];
}

export type SnapshotEligibility =
  | { eligible: true; request: AtlasSnapshotRequest }
  | { eligible: false; reasons: SnapshotIneligibleReason[] };

export interface QualifyingSnapshotProvenance {
  evidence: EvidenceRecord[];
  evidenceIds: string[];
  insightIds: string[];
  contradictionIds: string[];
}

/** Provenance-only selection; never inspects prose. Sorted for determinism. */
export function selectQualifyingSnapshotProvenance(
  state: CampaignState
): QualifyingSnapshotProvenance {
  const visibility = createV2ProvenanceVisibility(state);

  const evidence = state.evidence
    .filter((record) => record.origin === 'player-stated' && visibility.evidenceIsEligible(record.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const qualifying = new Set(evidence.map((record) => record.id));
  const allQualify = (ids: readonly string[]) =>
    ids.length > 0 && ids.every((id) => qualifying.has(id));

  const insightIds = state.insights
    .filter((record) => record.status === 'confirmed'
      && visibility.insightIsEligible(record.id)
      && allQualify(record.evidenceIds))
    .map((record) => record.id)
    .sort();

  const contradictionIds = state.contradictions
    .filter((record) => visibility.contradictionIsEligible(record.id) && allQualify(record.evidenceIds))
    .map((record) => record.id)
    .sort();

  return { evidence, evidenceIds: [...qualifying].sort(), insightIds, contradictionIds };
}

export function evaluateSnapshotEligibility(
  state: CampaignState,
  input: { trigger: SnapshotRequestTrigger; requestedAt: string }
): SnapshotEligibility {
  const requestedTime = Date.parse(input.requestedAt);
  if (!Number.isFinite(requestedTime)) return { eligible: false, reasons: ['invalid-requested-at'] };

  const provenance = selectQualifyingSnapshotProvenance(state);
  const latest = selectLatestAtlasSnapshot(state.atlasSnapshots);
  const reasons: SnapshotIneligibleReason[] = [];

  if (provenance.evidenceIds.length < SNAPSHOT_ELIGIBILITY_RULES.minEvidence) {
    reasons.push('insufficient-evidence');
  }

  if (!latest) {
    if (input.trigger === 'cadence') reasons.push('cadence-not-first-snapshot');
    if (input.trigger === 'milestone') {
      const dimensions = new Set(provenance.evidence.map((record) => record.dimension));
      if (dimensions.size < SNAPSHOT_ELIGIBILITY_RULES.milestoneMinDimensions) {
        reasons.push('milestone-not-reached');
      }
    }
  } else {
    if (input.trigger === 'milestone') reasons.push('milestone-only-first-snapshot');
    const minInterval = input.trigger === 'explicit-request'
      ? SNAPSHOT_ELIGIBILITY_RULES.explicitMinIntervalMs
      : SNAPSHOT_ELIGIBILITY_RULES.cadenceMinIntervalMs;
    if (requestedTime - Date.parse(latest.createdAt) < minInterval) reasons.push('too-soon');
  }

  const previousIds = new Set(latest
    ? [...latest.evidenceIds, ...latest.insightIds, ...latest.contradictionIds]
    : []);
  const newSourceIds = [
    ...provenance.evidenceIds,
    ...provenance.insightIds,
    ...provenance.contradictionIds
  ].filter((id) => !previousIds.has(id));
  if (latest && newSourceIds.length === 0) reasons.push('no-new-material');

  // Ineligible results deliberately carry no provenance IDs.
  if (reasons.length > 0) return { eligible: false, reasons };

  return {
    eligible: true,
    request: {
      trigger: input.trigger,
      requestedAt: input.requestedAt,
      ...(latest ? { previousSnapshotId: latest.id } : {}),
      evidenceIds: provenance.evidenceIds,
      insightIds: provenance.insightIds,
      contradictionIds: provenance.contradictionIds,
      newSourceIds
    }
  };
}
