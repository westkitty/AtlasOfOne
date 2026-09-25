import { describe, expect, it } from 'vitest';
import { generateLocalAssessment } from '../../src/cartographer/finalize';
import { createInitialCampaign } from '../../src/game/engine';
import {
  appendAtlasSnapshot,
  createAtlasSnapshotRecord,
  selectAtlasSnapshotsChronological,
  selectAtlasSnapshotsNewestFirst,
  selectLatestAtlasSnapshot
} from '../../src/atlas/history';

const synthesis = () => generateLocalAssessment(createInitialCampaign());

const snapshotInput = (id: string, createdAt: string) => ({
  id,
  createdAt,
  evidenceIds: ['ev_' + id],
  insightIds: ['insight_' + id],
  contradictionIds: ['contradiction_' + id],
  synthesis: synthesis()
});

describe('Atlas Snapshot history (S00)', () => {
  it('creates the first immutable history record with no predecessor', () => {
    const input = snapshotInput('snapshot_1', '2026-01-01T00:00:00.000Z');
    const record = createAtlasSnapshotRecord(input);

    expect(record.previousSnapshotId).toBeUndefined();
    expect(record.evidenceIds).toEqual(['ev_snapshot_1']);
    expect(record.insightIds).toEqual(['insight_snapshot_1']);
    expect(record.contradictionIds).toEqual(['contradiction_snapshot_1']);

    input.evidenceIds.push('mutated');
    input.insightIds.push('mutated');
    input.contradictionIds.push('mutated');

    expect(record.evidenceIds).toEqual(['ev_snapshot_1']);
    expect(record.insightIds).toEqual(['insight_snapshot_1']);
    expect(record.contradictionIds).toEqual(['contradiction_snapshot_1']);
  });

  it('links a newer Snapshot to the explicit prior record', () => {
    const first = createAtlasSnapshotRecord(
      snapshotInput('snapshot_1', '2026-01-01T00:00:00.000Z')
    );
    const second = createAtlasSnapshotRecord(
      snapshotInput('snapshot_2', '2026-02-01T00:00:00.000Z'),
      first
    );

    expect(second.previousSnapshotId).toBe(first.id);
  });

  it('rejects a predecessor relationship that does not move forward in time', () => {
    const first = createAtlasSnapshotRecord(
      snapshotInput('snapshot_1', '2026-02-01T00:00:00.000Z')
    );

    expect(() => createAtlasSnapshotRecord(
      snapshotInput('snapshot_2', '2026-01-01T00:00:00.000Z'),
      first
    )).toThrow('must be newer than previous Snapshot');

    expect(() => createAtlasSnapshotRecord(
      snapshotInput('snapshot_2', first.createdAt),
      first
    )).toThrow('must be newer than previous Snapshot');
  });

  it('sorts history deterministically without mutating caller order', () => {
    const first = createAtlasSnapshotRecord(
      snapshotInput('snapshot_a', '2026-01-01T00:00:00.000Z')
    );
    const second = createAtlasSnapshotRecord(
      snapshotInput('snapshot_b', '2026-02-01T00:00:00.000Z'),
      first
    );
    const source = [second, first];

    expect(selectAtlasSnapshotsChronological(source).map((item) => item.id))
      .toEqual(['snapshot_a', 'snapshot_b']);
    expect(selectAtlasSnapshotsNewestFirst(source).map((item) => item.id))
      .toEqual(['snapshot_b', 'snapshot_a']);
    expect(selectLatestAtlasSnapshot(source)?.id).toBe('snapshot_b');
    expect(source.map((item) => item.id)).toEqual(['snapshot_b', 'snapshot_a']);
  });

  it('appends only to the actual latest Snapshot and preserves historical records', () => {
    const first = createAtlasSnapshotRecord(
      snapshotInput('snapshot_1', '2026-01-01T00:00:00.000Z')
    );
    const second = createAtlasSnapshotRecord(
      snapshotInput('snapshot_2', '2026-02-01T00:00:00.000Z'),
      first
    );
    const third = createAtlasSnapshotRecord(
      snapshotInput('snapshot_3', '2026-03-01T00:00:00.000Z'),
      second
    );
    const source = [second, first];

    const appended = appendAtlasSnapshot(source, third);

    expect(appended.map((item) => item.id))
      .toEqual(['snapshot_1', 'snapshot_2', 'snapshot_3']);
    expect(appended[0]).toEqual(first);
    expect(appended[1]).toEqual(second);
    expect(source.map((item) => item.id)).toEqual(['snapshot_2', 'snapshot_1']);
  });

  it('rejects duplicate IDs, broken predecessor chains and backdated appends', () => {
    const first = createAtlasSnapshotRecord(
      snapshotInput('snapshot_1', '2026-01-01T00:00:00.000Z')
    );
    const second = createAtlasSnapshotRecord(
      snapshotInput('snapshot_2', '2026-02-01T00:00:00.000Z'),
      first
    );

    expect(() => appendAtlasSnapshot([first], first))
      .toThrow('Duplicate AtlasSnapshot id');

    const wrongParent = {
      ...second,
      id: 'snapshot_wrong_parent',
      previousSnapshotId: 'not_the_latest'
    };
    expect(() => appendAtlasSnapshot([first], wrongParent))
      .toThrow('must reference latest Snapshot');

    const backdated = {
      ...second,
      id: 'snapshot_backdated',
      createdAt: '2025-12-01T00:00:00.000Z'
    };
    expect(() => appendAtlasSnapshot([first], backdated))
      .toThrow('must be newer than latest Snapshot');

    expect(() => appendAtlasSnapshot([], {
      ...first,
      previousSnapshotId: 'invented_parent'
    })).toThrow('First AtlasSnapshot must not reference a previous Snapshot');
  });

  it('fails closed on invalid Snapshot dates', () => {
    expect(() => createAtlasSnapshotRecord(
      snapshotInput('snapshot_bad_date', 'not-a-date')
    )).toThrow('Invalid AtlasSnapshot createdAt');

    expect(() => selectAtlasSnapshotsChronological([{
      ...createAtlasSnapshotRecord(
        snapshotInput('snapshot_valid', '2026-01-01T00:00:00.000Z')
      ),
      createdAt: 'invalid'
    }])).toThrow('Invalid AtlasSnapshot createdAt');
  });
});
