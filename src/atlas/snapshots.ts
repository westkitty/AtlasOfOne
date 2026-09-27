import type { FinalAssessment } from '../cartographer/finalize';
import { campaignReachedEndState } from '../game/engine';
import type { CampaignState, PersistedAtlasSnapshot } from '../game/types';
import { retireIneligibleV2State } from '../persistence/retirement';

/**
 * Atlas Snapshots (MASTER_INTEGRATION_PLAN §15): dated, immutable,
 * point-in-time syntheses of what is currently supported. A snapshot is never
 * "final", never overwritten, and never the campaign's end. New material
 * produces a new snapshot; old ones stay exactly as they were written.
 *
 * Eligibility is deterministic. The prose body comes from the existing
 * non-fabricating synthesizer (local) or the semantically validated remote
 * path; this module only decides whether a snapshot may be taken and records it.
 */

export type SnapshotEligibilityReason =
  | 'first-milestone-not-reached'
  | 'nothing-new-since-last'
  | 'already-taken-today'
  | 'eligible';

export interface SnapshotEligibility {
  eligible: boolean;
  reason: SnapshotEligibilityReason;
}

export interface SnapshotSources {
  evidenceIds: string[];
  insightIds: string[];
  contradictionIds: string[];
}

export interface SnapshotChange {
  added: SnapshotSources;
  noLongerSupported: SnapshotSources;
}

export interface SnapshotHistoryEntry {
  snapshot: PersistedAtlasSnapshot;
  /** Retired / historical snapshots render no body: their support was withdrawn or they predate v2. */
  displayable: boolean;
  body?: FinalAssessment;
  changeFromPrevious?: SnapshotChange;
}

const dayOf = (iso: string) => iso.slice(0, 10);
const sorted = (values: Iterable<string>) => [...new Set(values)].sort();

/** The ids a snapshot taken now would rest on: only currently eligible, non-private, non-retracted support. */
export function currentSnapshotSources(state: CampaignState): SnapshotSources {
  const eligible = retireIneligibleV2State(state);
  return {
    evidenceIds: sorted(eligible.evidence.filter((item) => item.status === 'active').map((item) => item.id)),
    insightIds: sorted(eligible.insights.filter((item) => item.status === 'confirmed').map((item) => item.id)),
    contradictionIds: sorted(eligible.contradictions.map((item) => item.id))
  };
}

function ownSnapshots(state: CampaignState): PersistedAtlasSnapshot[] {
  return state.atlasSnapshots
    .filter((snapshot) => snapshot.provenance.kind === 'snapshot')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function diff(before: readonly string[], after: readonly string[]) {
  const previous = new Set(before);
  const current = new Set(after);
  return { added: after.filter((id) => !previous.has(id)), removed: before.filter((id) => !current.has(id)) };
}

export function snapshotChange(previous: SnapshotSources, next: SnapshotSources): SnapshotChange {
  const evidence = diff(previous.evidenceIds, next.evidenceIds);
  const insights = diff(previous.insightIds, next.insightIds);
  const contradictions = diff(previous.contradictionIds, next.contradictionIds);
  return {
    added: { evidenceIds: evidence.added, insightIds: insights.added, contradictionIds: contradictions.added },
    noLongerSupported: { evidenceIds: evidence.removed, insightIds: insights.removed, contradictionIds: contradictions.removed }
  };
}

const changeIsEmpty = (change: SnapshotChange) =>
  [change.added, change.noLongerSupported].every((side) => side.evidenceIds.length + side.insightIds.length + side.contradictionIds.length === 0);

/**
 * §15.3: the first snapshot uses the existing deterministic milestone (every
 * territory charted). After that, Greyson may request one explicitly, bounded
 * to one per calendar day and only when the supported material changed.
 */
export function snapshotEligibility(state: CampaignState, nowIso: string): SnapshotEligibility {
  const own = ownSnapshots(state);
  const last = own.at(-1);
  if (!last) {
    return campaignReachedEndState(state)
      ? { eligible: true, reason: 'eligible' }
      : { eligible: false, reason: 'first-milestone-not-reached' };
  }
  if (dayOf(last.createdAt) === dayOf(nowIso)) return { eligible: false, reason: 'already-taken-today' };
  if (changeIsEmpty(snapshotChange(last, currentSnapshotSources(state)))) return { eligible: false, reason: 'nothing-new-since-last' };
  return { eligible: true, reason: 'eligible' };
}

/**
 * Append one immutable snapshot. Refuses (returns the same state) when not
 * eligible, so a double tap or a late second synthesis cannot create two.
 */
export function recordAtlasSnapshot(
  state: CampaignState,
  body: FinalAssessment,
  nowIso: string,
  /** The sources the body was synthesized from. If they changed meanwhile (a retraction, PRIVATE), the body is stale and refused. */
  synthesizedFrom?: SnapshotSources
): CampaignState {
  if (!snapshotEligibility(state, nowIso).eligible) return state;
  const sources = currentSnapshotSources(state);
  if (synthesizedFrom && JSON.stringify(synthesizedFrom) !== JSON.stringify(sources)) return state;
  const previous = ownSnapshots(state).at(-1);
  const snapshot: PersistedAtlasSnapshot = {
    id: `snapshot_${nowIso.replace(/[^0-9]/g, '')}_${state.atlasSnapshots.length + 1}`,
    createdAt: nowIso,
    ...sources,
    synthesis: {
      summary: body.whoIsGreyson,
      territorySummaries: state.territories.map((territory) => ({ territoryId: territory.id, summary: `${territory.label}: ${territory.status}` }))
    },
    ...(previous ? { previousSnapshotId: previous.id } : {}),
    provenance: { kind: 'snapshot' },
    eligibility: 'eligible',
    detail: { ...body, generatedAt: nowIso }
  };
  return { ...state, atlasSnapshots: [...state.atlasSnapshots, snapshot], updatedAt: nowIso };
}

/**
 * Newest-first history for display. Retirement is recomputed live so a snapshot
 * whose support was made private or retracted this session hides immediately,
 * not only after the next load. A pre-v2 Final Assessment still sitting in the
 * legacy field is shown read-only, without being written anywhere.
 */
export function snapshotHistory(state: CampaignState): SnapshotHistoryEntry[] {
  const live = retireIneligibleV2State(state).atlasSnapshots;
  const entries: SnapshotHistoryEntry[] = [];
  const own = live.filter((snapshot) => snapshot.provenance.kind === 'snapshot').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  own.forEach((snapshot, index) => {
    const previous = index > 0 ? own[index - 1] : undefined;
    const displayable = snapshot.eligibility === 'eligible';
    entries.push({
      snapshot,
      displayable,
      ...(displayable && snapshot.detail ? { body: snapshot.detail } : {}),
      ...(displayable && previous ? { changeFromPrevious: snapshotChange(previous, snapshot) } : {})
    });
  });

  // Legacy v1 assessments stay readable history (never deleted), shown only on
  // explicit request by the UI because they predate provenance-based retirement.
  for (const legacy of live.filter((snapshot) => snapshot.provenance.kind === 'legacy-final-assessment')) {
    entries.push({ snapshot: legacy, displayable: false, ...(legacy.legacyFinalAssessment ? { body: legacy.legacyFinalAssessment } : {}) });
  }
  const legacyField = state.finalAssessment;
  if (legacyField && !live.some((snapshot) => snapshot.provenance.sourceFinalAssessmentId === legacyField.id)) {
    entries.push({
      snapshot: {
        id: `legacy_${legacyField.id}`, createdAt: legacyField.generatedAt, evidenceIds: [], insightIds: [], contradictionIds: [],
        synthesis: { summary: legacyField.whoIsGreyson, territorySummaries: [] },
        provenance: { kind: 'legacy-final-assessment', sourceFinalAssessmentId: legacyField.id }, eligibility: 'historical-ineligible'
      },
      displayable: false,
      body: legacyField
    });
  }
  return entries.sort((a, b) => b.snapshot.createdAt.localeCompare(a.snapshot.createdAt));
}
