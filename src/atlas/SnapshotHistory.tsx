import { useState } from 'react';
import type { SnapshotComparison } from './compare';
import type { SnapshotIneligibleReason } from './eligibility';
import type { AtlasSnapshot } from './schema';

export interface SnapshotHistoryProps {
  /** Newest first. */
  snapshots: readonly AtlasSnapshot[];
  eligible: boolean;
  reasons: readonly SnapshotIneligibleReason[];
  /** Comparison of the two newest Snapshots, if both exist and are eligible to compare. */
  latestChange?: SnapshotComparison;
  onTakeSnapshot: () => void;
}

const REASON_COPY: Record<SnapshotIneligibleReason, string> = {
  'invalid-requested-at': 'The clock looks wrong; try again later.',
  'insufficient-evidence': 'A Snapshot needs a few things you have confirmed in your own words first.',
  'milestone-not-reached': 'Not enough of the map is charted yet for a first Snapshot.',
  'cadence-not-first-snapshot': 'Automatic Snapshots only happen after the first one.',
  'milestone-only-first-snapshot': 'Milestone Snapshots only apply to the first one.',
  'too-soon': 'The last Snapshot is very recent. Try again tomorrow.',
  'no-new-material': 'Nothing new has been confirmed since the last Snapshot.'
};

function count(delta: { added: string[]; removed: string[] }) {
  return `+${delta.added.length} / −${delta.removed.length}`;
}

/**
 * S04 dated, revisable Snapshot history.
 *
 * Presentation only. Each Snapshot is immutable history; nothing here edits
 * one. "What changed" lists supported deltas only (S05), with rejected
 * interpretations shown as rejected — never as supported.
 */
export function SnapshotHistory({ snapshots, eligible, reasons, latestChange, onTakeSnapshot }: SnapshotHistoryProps) {
  const [openId, setOpenId] = useState<string | undefined>(snapshots[0]?.id);

  return (
    <article className="card snapshot-history" data-testid="atlas-snapshots">
      <div className="assessment-head">
        <div>
          <h2>Atlas Snapshots</h2>
          <p className="settings-note">
            Dated, revisable readings of what you have confirmed so far. A Snapshot is never the last word; you can
            keep writing, revise, or withdraw anything, and later Snapshots will show what changed.
          </p>
        </div>
        <div className="assessment-actions no-print">
          <button className="primary" type="button" data-testid="take-snapshot" disabled={!eligible} onClick={onTakeSnapshot}>
            Take a dated Snapshot
          </button>
        </div>
      </div>

      {!eligible && reasons.length > 0 && (
        <ul className="snapshot-reasons" data-testid="snapshot-reasons">
          {[...new Set(reasons.map((reason) => REASON_COPY[reason]))].map((text) => <li key={text}>{text}</li>)}
        </ul>
      )}

      {latestChange && (
        <section className="snapshot-change" data-testid="snapshot-change" aria-label="What changed since the previous Snapshot">
          <h3>What changed since the previous Snapshot</h3>
          <ul>
            <li>Confirmed statements: {count(latestChange.evidence)}</li>
            <li>Supported insights: {count(latestChange.insights.supported)}</li>
            <li>Rejected interpretations (kept as rejected, not reasserted): {count(latestChange.insights.rejected)}</li>
            <li>Open contradictions: {count(latestChange.contradictions)}</li>
            {latestChange.withheldCount > 0 && <li>{latestChange.withheldCount} item(s) withheld because you made them private or withdrew them.</li>}
          </ul>
        </section>
      )}

      {snapshots.length === 0 ? (
        <p className="empty" data-testid="snapshot-empty">No Snapshots yet.</p>
      ) : (
        <ol className="snapshot-list">
          {snapshots.map((snapshot, index) => {
            const open = openId === snapshot.id;
            const legacy = snapshot.evidenceIds.length + snapshot.insightIds.length + snapshot.contradictionIds.length === 0;
            return (
              <li key={snapshot.id} data-testid="snapshot-item" data-snapshot-id={snapshot.id}>
                <button type="button" className="snapshot-summary" aria-expanded={open} onClick={() => setOpenId(open ? undefined : snapshot.id)}>
                  <time dateTime={snapshot.createdAt}>{new Date(snapshot.createdAt).toLocaleDateString()}</time>
                  <span className="chip">{index === 0 ? 'Latest' : 'Earlier'}</span>
                  {legacy && <span className="chip">Historical (no linked sources)</span>}
                </button>
                {open && (
                  <div className="snapshot-body" data-testid="snapshot-body">
                    <p>{snapshot.synthesis.whoIsGreyson}</p>
                    {[
                      snapshot.synthesis.temperament,
                      snapshot.synthesis.valuesAndMorals,
                      snapshot.synthesis.relationshipsAndSocial,
                      snapshot.synthesis.interestsAndPreferences
                    ].map((domain) => (
                      <div key={domain.title} className="snapshot-domain">
                        <h4>{domain.title}</h4>
                        {domain.establishedEvidence.length > 0 && (
                          <ul>{domain.establishedEvidence.map((item, i) => <li key={i}>{item}</li>)}</ul>
                        )}
                        <ul className="uncertainty-list">
                          {domain.openQuestionsAndUncertainty.map((item, i) => <li key={i}>{item}</li>)}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </article>
  );
}
