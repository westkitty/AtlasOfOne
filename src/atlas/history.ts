import { atlasSnapshotSchema, type AtlasSnapshot } from './schema';

function snapshotTime(snapshot: Pick<AtlasSnapshot, 'id' | 'createdAt'>): number {
  const parsed = Date.parse(snapshot.createdAt);
  if (!Number.isFinite(parsed)) {
    throw new Error('Invalid AtlasSnapshot createdAt for ' + snapshot.id + ': ' + snapshot.createdAt);
  }
  return parsed;
}

function compareSnapshots(left: AtlasSnapshot, right: AtlasSnapshot): number {
  const byTime = snapshotTime(left) - snapshotTime(right);
  return byTime || left.id.localeCompare(right.id);
}

export type NewAtlasSnapshot = Omit<AtlasSnapshot, 'previousSnapshotId'>;

/**
 * Construct one immutable Snapshot history record.
 *
 * S00 does not decide whether a Snapshot is eligible or synthesize its prose.
 * Callers supply already-authorized synthesis/provenance inputs. The only
 * history authority owned here is stable identity, dating and predecessor chain.
 */
export function createAtlasSnapshotRecord(
  input: NewAtlasSnapshot,
  previous?: AtlasSnapshot
): AtlasSnapshot {
  const snapshot = atlasSnapshotSchema.parse({
    ...input,
    evidenceIds: [...input.evidenceIds],
    insightIds: [...input.insightIds],
    contradictionIds: [...input.contradictionIds],
    ...(previous ? { previousSnapshotId: previous.id } : {})
  });

  snapshotTime(snapshot);

  if (previous && snapshotTime(snapshot) <= snapshotTime(previous)) {
    throw new Error(
      'AtlasSnapshot ' + snapshot.id + ' must be newer than previous Snapshot ' + previous.id + '.'
    );
  }

  return snapshot;
}

export function selectAtlasSnapshotsChronological(
  snapshots: readonly AtlasSnapshot[]
): AtlasSnapshot[] {
  return snapshots.map((snapshot) => atlasSnapshotSchema.parse(snapshot)).sort(compareSnapshots);
}

export function selectAtlasSnapshotsNewestFirst(
  snapshots: readonly AtlasSnapshot[]
): AtlasSnapshot[] {
  return selectAtlasSnapshotsChronological(snapshots).reverse();
}

export function selectLatestAtlasSnapshot(
  snapshots: readonly AtlasSnapshot[]
): AtlasSnapshot | undefined {
  return selectAtlasSnapshotsNewestFirst(snapshots)[0];
}

/**
 * Append without rewriting historical records.
 *
 * A non-empty history requires the new record to point at the actual latest
 * Snapshot. This keeps comparison lineage explicit even if imported history was
 * stored out of array order.
 */
export function appendAtlasSnapshot(
  snapshots: readonly AtlasSnapshot[],
  snapshot: AtlasSnapshot
): AtlasSnapshot[] {
  const parsed = atlasSnapshotSchema.parse(snapshot);
  snapshotTime(parsed);

  if (snapshots.some((item) => item.id === parsed.id)) {
    throw new Error('Duplicate AtlasSnapshot id: ' + parsed.id);
  }

  const latest = selectLatestAtlasSnapshot(snapshots);

  if (!latest) {
    if (parsed.previousSnapshotId !== undefined) {
      throw new Error('First AtlasSnapshot must not reference a previous Snapshot.');
    }
  } else {
    if (parsed.previousSnapshotId !== latest.id) {
      throw new Error(
        'AtlasSnapshot ' + parsed.id + ' must reference latest Snapshot ' + latest.id + '.'
      );
    }
    if (snapshotTime(parsed) <= snapshotTime(latest)) {
      throw new Error(
        'AtlasSnapshot ' + parsed.id + ' must be newer than latest Snapshot ' + latest.id + '.'
      );
    }
  }

  return selectAtlasSnapshotsChronological([...snapshots, parsed]);
}
