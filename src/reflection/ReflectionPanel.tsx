import type { ReflectionDecision, ReflectionRecord } from './schema';

const SOURCE_LABEL: Record<ReflectionRecord['sourceKind'], string> = {
  journal: 'From your Journal',
  adventure: 'From an adventure observation',
  contradiction: 'From a contradiction',
  insight: 'From an older insight',
  pattern: 'From a repeated pattern',
  snapshot: 'From a Snapshot comparison'
};

export interface ReflectionPanelProps {
  record: ReflectionRecord;
  value: string;
  onChange: (value: string) => void;
  onDecision: (decision: ReflectionDecision) => void;
  onClose: () => void;
}

/**
 * Human-authority surface for one already-created ReflectionRecord.
 *
 * This component does not create reflections, evidence, progression, provider
 * calls, or interpretations. It renders an existing proposal and returns only
 * Greyson's explicit decision plus whatever words he chose to type.
 */
export function ReflectionPanel({
  record,
  value,
  onChange,
  onDecision,
  onClose
}: ReflectionPanelProps) {
  const hasWords = value.trim().length > 0;

  return (
    <section
      className="reflection-overlay"
      data-testid="reflection-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reflection-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <button
        type="button"
        className="reflection-close"
        data-testid="reflection-close"
        aria-label="Close reflection"
        onClick={onClose}
      >
        <span aria-hidden="true">▾</span>
      </button>

      <header className="reflection-head">
        <p className="reflection-eyebrow">{SOURCE_LABEL[record.sourceKind]}</p>
        <h2 id="reflection-title">Your call.</h2>
        <p>Atlas can ask. You decide what, if anything, this means about you.</p>
      </header>

      <article className="reflection-question">
        <p>{record.question}</p>
        {record.interpretation && (
          <blockquote data-testid="reflection-interpretation">
            {record.interpretation}
          </blockquote>
        )}
      </article>

      <label className="reflection-response">
        <span>Your words</span>
        <textarea
          rows={4}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          data-testid="reflection-response"
          placeholder="Optional for Confirm. Required for Partial or Revise."
        />
      </label>

      <p className="reflection-note" data-testid="reflection-note">
        Confirm can be one tap. Partial and Revise require your own words so Atlas cannot invent the nuance.
        Nothing here awards XP.
      </p>

      <div className="reflection-actions" aria-label="Reflection decisions">
        <button
          type="button"
          className="primary"
          data-testid="reflection-confirm"
          onClick={() => onDecision('confirm')}
        >
          Confirm
        </button>
        <button
          type="button"
          data-testid="reflection-partial"
          disabled={!hasWords}
          onClick={() => onDecision('partial')}
        >
          Partial
        </button>
        <button
          type="button"
          data-testid="reflection-reject"
          onClick={() => onDecision('reject')}
        >
          Reject
        </button>
        <button
          type="button"
          data-testid="reflection-uncertain"
          onClick={() => onDecision('uncertain')}
        >
          Uncertain
        </button>
        <button
          type="button"
          data-testid="reflection-revise"
          disabled={!hasWords}
          onClick={() => onDecision('revise')}
        >
          Revise
        </button>
        <button
          type="button"
          data-testid="reflection-private"
          onClick={() => onDecision('private')}
        >
          Private
        </button>
      </div>
    </section>
  );
}
