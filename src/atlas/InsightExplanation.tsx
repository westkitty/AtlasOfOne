import type { InsightExplanationResult } from './explain';

const STATUS_LABEL = {
  confirmed: 'Confirmed by you',
  pending: 'Not yet confirmed',
  rejected: 'You rejected this — not counted'
} as const;

const BASIS_LABEL = {
  explicit: 'you said this',
  example: 'your example',
  inference: 'inferred',
  revision: 'your revision'
} as const;

export interface InsightExplanationProps {
  explanation: InsightExplanationResult;
}

/** RF08 presentational surface. Props in only; no state, effects or calls. */
export function InsightExplanation({ explanation }: InsightExplanationProps) {
  if (explanation.kind === 'withheld') {
    return (
      <section className="insight-explanation" data-testid="insight-explanation" aria-label="Why this insight exists">
        <p>This insight is no longer shown because a source it relied on is private or withdrawn.</p>
      </section>
    );
  }

  const { title, status, confidence, createdAt, evidence, reflections, counterContradictionIds, snapshots, withheldSourceCount } = explanation;

  return (
    <section className="insight-explanation" data-testid="insight-explanation" aria-label="Why this insight exists">
      <h3>{title}</h3>
      <p data-testid="insight-status">{STATUS_LABEL[status]} · confidence {confidence} · since {createdAt.slice(0, 10)}</p>

      <h4>Sources</h4>
      {evidence.length === 0 ? <p>No visible sources.</p> : (
        <ul data-testid="insight-evidence">
          {evidence.map((item) => (
            <li key={item.id}>
              {item.id} — {item.dimension} ({BASIS_LABEL[item.basis]}, {item.origin})
            </li>
          ))}
        </ul>
      )}

      <h4>Your reflections</h4>
      {reflections.length === 0 ? <p>No reflection yet.</p> : (
        <ul data-testid="insight-reflections">
          {reflections.map((item) => (
            <li key={item.id}>{item.createdAt.slice(0, 10)}: {item.decision ?? 'undecided'} ({item.epistemicStatus})</li>
          ))}
        </ul>
      )}

      <h4>Counter-evidence</h4>
      {counterContradictionIds.length === 0 ? <p>No open contradictions.</p> : (
        <ul data-testid="insight-contradictions">
          {counterContradictionIds.map((id) => <li key={id}>{id}</li>)}
        </ul>
      )}

      <h4>Over time</h4>
      {snapshots.length === 0 ? <p>Not yet in a Snapshot.</p> : (
        <ul data-testid="insight-snapshots">
          {snapshots.map((item) => <li key={item.id}>{item.id} ({item.createdAt.slice(0, 10)})</li>)}
        </ul>
      )}

      {withheldSourceCount > 0 && (
        <p data-testid="insight-withheld">
          {withheldSourceCount} private or withdrawn {withheldSourceCount === 1 ? 'source is' : 'sources are'} not shown.
        </p>
      )}
    </section>
  );
}
