import type { FinalAssessment } from '../cartographer/finalize';
import type { SnapshotEligibility, SnapshotHistoryEntry } from './snapshots';

export interface SnapshotPanelProps {
  history: SnapshotHistoryEntry[];
  eligibility: SnapshotEligibility;
  synthesizing: boolean;
  chartedCount: number;
  territoryCount: number;
  onTakeSnapshot: () => void;
}

const LOCKED_COPY: Record<SnapshotEligibility['reason'], (charted: number, total: number) => string> = {
  'first-milestone-not-reached': (charted, total) => `Your first Snapshot becomes available once every territory is charted (${charted} of ${total} so far). It is a dated picture, not an ending.`,
  'nothing-new-since-last': () => 'Nothing new is supported since your last Snapshot, so a new one would be identical. Keep journaling and exploring.',
  'already-taken-today': () => 'One Snapshot per day. The next one can be taken tomorrow if something has changed.',
  eligible: () => ''
};

function provenanceLabel(provider: string): string {
  return provider === 'local-synthesizer'
    ? 'Written on this device from your recorded evidence'
    : 'Drafted by the Atlas model and checked against your evidence';
}

function Body({ body }: { body: FinalAssessment }) {
  const domains = [
    body.temperament, body.valuesAndMorals, body.politicalAndIdeology, body.relationshipsAndSocial,
    body.cognitiveStyle, body.interestsAndPreferences, body.fearsAndHopes, body.idealFutureAndAmbition
  ];
  return <div className="assessment-body">
    <blockquote className="who-is-greyson" data-testid="snapshot-summary"><p>{body.whoIsGreyson}</p></blockquote>
    <div className="domain-grid">
      {domains.map((domain) => <div key={domain.title} className="domain-card">
        <h4>{domain.title}</h4>
        <p className="domain-summary">{domain.summary}</p>
        <div className="epistemic-group"><strong className="epistemic-label evidence-label">What you told Atlas</strong>
          <ul className="claim-list">{domain.establishedEvidence.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
        <div className="epistemic-group"><strong className="epistemic-label inference-label">Interpretations — not confirmed by you</strong>
          <ul className="hypothesis-list">{domain.supportedInferences.map((item, index) => <li key={index}><span>{item.hypothesis}</span><small className={`conf-badge ${item.confidence}`}>{item.confidence}</small></li>)}</ul></div>
        <div className="epistemic-group"><strong className="epistemic-label uncertainty-label">Still open</strong>
          <ul className="uncertainty-list">{domain.openQuestionsAndUncertainty.map((item, index) => <li key={index}>{item}</li>)}</ul></div>
      </div>)}
    </div>
    {body.contradictionsAndTensions.length > 0 && <div className="assessment-subblock"><h3>Tensions</h3><div className="tensions-list">
      {body.contradictionsAndTensions.map((tension, index) => <div key={index} className="tension-card"><b>{tension.tension}</b><small>{tension.status}</small></div>)}
    </div></div>}
    {body.frameworkEstimates.length > 0 && <div className="assessment-subblock"><h3>Model framework comparisons</h3>
      <p className="settings-note">Working hypotheses from the model, not diagnoses and not confirmed by you.</p>
      <div className="framework-list">{body.frameworkEstimates.map((item, index) => <div key={index} className="framework-card"><b>{item.framework}: {item.estimate}</b><small>{item.caveat}</small></div>)}</div>
    </div>}
    {body.representativeQuotes.length > 0 && <div className="assessment-subblock"><h3>Your words</h3>
      <ul className="quote-list">{body.representativeQuotes.map((quote, index) => <li key={index}>{quote}</li>)}</ul></div>}
    {body.openQuestions.length > 0 && <div className="assessment-subblock"><h3>Open questions</h3>
      <ul className="uncertainty-list">{body.openQuestions.map((question, index) => <li key={index}>{question}</li>)}</ul></div>}
  </div>;
}

function count(ids: { evidenceIds: string[]; insightIds: string[]; contradictionIds: string[] }) {
  return { evidence: ids.evidenceIds.length, insights: ids.insightIds.length, contradictions: ids.contradictionIds.length };
}

/**
 * Atlas Snapshots: a dated history, newest first. Old snapshots are never
 * rewritten; a retired one stays listed but closed.
 */
export function SnapshotPanel({ history, eligibility, synthesizing, chartedCount, territoryCount, onTakeSnapshot }: SnapshotPanelProps) {
  const latestDisplayable = history.find((entry) => entry.displayable);
  return <article className="card assessment-section" data-testid="snapshot-section">
    <div className="assessment-head">
      <div>
        <h2>Atlas Snapshots</h2>
        <p className="settings-note">Dated pictures of what your evidence supports right now. Each one stays as it was written; the Atlas keeps going.</p>
      </div>
      <div className="assessment-actions no-print">
        {eligibility.eligible && <button className="primary" data-testid="take-snapshot-btn" onClick={onTakeSnapshot} disabled={synthesizing}>{synthesizing ? 'Writing…' : 'Take a Snapshot'}</button>}
        {latestDisplayable && <button className="print-btn" data-testid="print-snapshot-btn" onClick={() => window.print()}>Print / Save as PDF</button>}
      </div>
    </div>
    {!eligibility.eligible && <div className="empty" data-testid="snapshot-locked">{LOCKED_COPY[eligibility.reason](chartedCount, territoryCount)}</div>}
    <ol className="snapshot-history" data-testid="snapshot-history">
      {history.map((entry) => {
        const { snapshot } = entry;
        const legacy = snapshot.provenance.kind === 'legacy-final-assessment';
        const date = new Date(snapshot.createdAt).toLocaleDateString();
        return <li key={snapshot.id} className="snapshot-entry" data-testid="snapshot-entry" data-eligibility={snapshot.eligibility}>
          <div className="assessment-meta">
            <span className="chip">{legacy ? `Final Assessment from the earlier version · ${date}` : `Snapshot · ${date}`}</span>
            {entry.body && !legacy && <span className="chip">{provenanceLabel(entry.body.provider)}</span>}
          </div>
          {entry.changeFromPrevious && (() => {
            const added = count(entry.changeFromPrevious.added);
            const gone = count(entry.changeFromPrevious.noLongerSupported);
            return <p className="settings-note" data-testid="snapshot-change">Since the previous Snapshot: +{added.evidence} evidence, +{added.insights} confirmed insights, +{added.contradictions} tensions{gone.evidence + gone.insights + gone.contradictions > 0 ? `; ${gone.evidence + gone.insights + gone.contradictions} no longer supported` : ''}.</p>;
          })()}
          {entry.displayable && entry.body && <Body body={entry.body} />}
          {!legacy && !entry.displayable && <p className="settings-note" data-testid="snapshot-retired">Retired: something this Snapshot rested on was later made private or retracted. It stays in your history, closed.</p>}
          {legacy && entry.body && <details className="legacy-assessment">
            <summary>Show the earlier text (written before Snapshots; kept as history)</summary>
            <Body body={entry.body} />
          </details>}
        </li>;
      })}
    </ol>
  </article>;
}
