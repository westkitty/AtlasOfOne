import type { CampaignState, InsightStatus } from '../game/types';
import { createV2ProvenanceVisibility } from '../persistence/retirement';
import { selectAtlasSnapshotsChronological } from './history';
import type { AtlasSnapshot } from './schema';

/**
 * S05 "what changed" comparison between two Snapshots, from supported
 * provenance deltas only. No prose diffing and no model involvement.
 *
 * `AtlasSnapshot.insightIds` is PROVENANCE, not endorsement: it mixes
 * supporting and rejected-interpretation IDs. Each insight ID is therefore
 * classified by its LIVE InsightRecord status. A rejected insight is reported
 * under `rejected`, never under `supported`. (A dedicated persisted
 * `rejectedInsightIds` field is requested for a later schema packet; this
 * implementation does not depend on it.)
 *
 * IDs whose source is no longer eligible (PRIVATE/retracted by M06) are not
 * listed; they are reported only as `withheldCount`.
 */

export interface IdDelta {
  added: string[];
  removed: string[];
}

export interface SnapshotComparison {
  fromSnapshotId: string;
  toSnapshotId: string;
  evidence: IdDelta;
  contradictions: IdDelta;
  insights: {
    supported: IdDelta;
    rejected: IdDelta;
    pending: IdDelta;
  };
  withheldCount: number;
}

type InsightBucket = 'supported' | 'rejected' | 'pending';

const BUCKET: Record<InsightStatus, InsightBucket> = {
  confirmed: 'supported',
  rejected: 'rejected',
  pending: 'pending'
};

function delta(from: readonly string[], to: readonly string[]): IdDelta {
  const before = new Set(from);
  const after = new Set(to);
  return {
    added: [...after].filter((id) => !before.has(id)).sort(),
    removed: [...before].filter((id) => !after.has(id)).sort()
  };
}

export function compareAtlasSnapshots(
  state: CampaignState,
  fromSnapshotId: string,
  toSnapshotId: string
): SnapshotComparison {
  const byId = new Map(state.atlasSnapshots.map((snapshot) => [snapshot.id, snapshot]));
  const from = byId.get(fromSnapshotId);
  const to = byId.get(toSnapshotId);
  if (!from) throw new Error(`Unknown AtlasSnapshot id: ${fromSnapshotId}`);
  if (!to) throw new Error(`Unknown AtlasSnapshot id: ${toSnapshotId}`);
  if (from.id === to.id) throw new Error('Cannot compare an AtlasSnapshot with itself.');

  const [older] = selectAtlasSnapshotsChronological([from, to]);
  if (older.id !== from.id) {
    throw new Error(`AtlasSnapshot ${fromSnapshotId} must be older than ${toSnapshotId}.`);
  }

  const visibility = createV2ProvenanceVisibility(state);
  const insightById = new Map(state.insights.map((record) => [record.id, record]));
  let withheld = 0;

  const visibleDelta = (pick: (s: AtlasSnapshot) => string[], eligible: (id: string) => boolean): IdDelta => {
    const raw = delta(pick(from), pick(to));
    const keep = (ids: string[]) => ids.filter((id) => {
      if (eligible(id)) return true;
      withheld += 1;
      return false;
    });
    return { added: keep(raw.added), removed: keep(raw.removed) };
  };

  const evidence = visibleDelta((s) => s.evidenceIds, visibility.evidenceIsEligible);
  const contradictions = visibleDelta((s) => s.contradictionIds, visibility.contradictionIsEligible);
  const insightDelta = visibleDelta((s) => s.insightIds, (id) => insightById.has(id) && visibility.insightIsEligible(id));

  const insights: SnapshotComparison['insights'] = {
    supported: { added: [], removed: [] },
    rejected: { added: [], removed: [] },
    pending: { added: [], removed: [] }
  };
  for (const side of ['added', 'removed'] as const) {
    for (const id of insightDelta[side]) {
      insights[BUCKET[insightById.get(id)!.status]][side].push(id);
    }
  }

  return {
    fromSnapshotId: from.id,
    toSnapshotId: to.id,
    evidence,
    contradictions,
    insights,
    withheldCount: withheld
  };
}
