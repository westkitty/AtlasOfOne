import type { ReactNode } from 'react';

export interface EncounterStageView {
  id: string;
  index: number;
  cleared: boolean;
  current: boolean;
}

export interface EncounterPanelProps {
  kind: 'boss' | 'door';
  title: string;
  step: string;
  dimension: string;
  question: string;
  evidenceClaims: string[];
  quiet: boolean;
  presentationLabel: string;
  offline: boolean;
  portraitSrc: string;
  stages: EncounterStageView[];
  crossing: [string, string] | null;
  reply: string;
  paused: boolean;
  answer: string;
  agency: ReactNode;
  onAnswerChange: (value: string) => void;
  onSubmit: () => void;
  onLeave: () => void;
}

/**
 * Presentation-only shell for the currently active legacy Boss/Mystery encounter.
 *
 * It receives already-derived encounter view state and emits player intent.
 * Availability, stage plans, rewards, completion, provider enrichment and every
 * GameEvent remain outside this component.
 */
export function EncounterPanel({
  kind,
  title,
  step,
  dimension,
  question,
  evidenceClaims,
  quiet,
  presentationLabel,
  offline,
  portraitSrc,
  stages,
  crossing,
  reply,
  paused,
  answer,
  agency,
  onAnswerChange,
  onSubmit,
  onLeave
}: EncounterPanelProps) {
  const isBoss = kind === 'boss';

  return (
    <section
      className={`screen encounter-screen ${isBoss ? 'is-boss-arena' : 'is-door-chamber'}`}
      data-testid={`encounter-${kind}`}
    >
      <div className="eyebrow">{isBoss ? 'BOSS FIGHT' : 'MYSTERY DOOR'}</div>
      <header>
        <div>
          <h1 className="screen-title">{title}</h1>
          <p>{step}{isBoss ? ' · your own mapped positions, put under load' : ' · optional to open, safe to close'}</p>
        </div>
        {quiet && <span className="chip">{presentationLabel}</span>}
        {offline && <span className="chip offline" data-testid="offline-indicator">Offline</span>}
      </header>

      <div className="encounter-stage-frame" aria-hidden="true">
        <div className="encounter-portrait">
          <img src={portraitSrc} alt="Greyson" draggable={false} />
        </div>
        <div className="encounter-stage-meta">
          <span className="encounter-sigil-badge">
            <i className="encounter-sigil-glyph">{isBoss ? '🔥' : '◈'}</i>
            <strong>{isBoss ? 'Trial Monolith' : 'Threshold Portal'}</strong>
          </span>
          <span className="encounter-dimension-badge">{dimension}</span>
        </div>
      </div>

      {isBoss && stages.length > 0 && (
        <ol className="stage-track" aria-label={`Boss Fight progress: ${step}`}>
          {stages.map((stage) => (
            <li key={stage.id} className={stage.cleared ? 'done' : stage.current ? 'now' : 'next'} aria-current={stage.current ? 'step' : undefined}>
              <span aria-hidden="true">{stage.cleared ? '✓' : stage.index + 1}</span>
            </li>
          ))}
        </ol>
      )}

      {!isBoss && crossing && (
        <div className="crossing" aria-hidden="true">
          <span>{crossing[0]}</span>
          <i>⟷</i>
          <span>{crossing[1]}</span>
        </div>
      )}

      <article className={`card encounter ${kind}`}>
        {reply && <p className="reply" role="status">{reply}</p>}
        <h2>{question}</h2>
        {evidenceClaims.length > 0 && (
          <>
            <p className="evidence-caption">From evidence you already mapped</p>
            <ul className="evidence-list">
              {evidenceClaims.map((claim, index) => <li key={index}>{claim}</li>)}
            </ul>
          </>
        )}
        <small>Dimension: {dimension}</small>
      </article>

      {paused && <div className="quiet">Session paused. Your Atlas is safe.</div>}

      <label className="answer">Your position
        <textarea
          rows={4}
          value={answer}
          onChange={(event) => onAnswerChange(event.target.value)}
          disabled={paused}
          data-testid="encounter-input"
        />
      </label>

      <button className="primary full" data-testid="encounter-submit" onClick={onSubmit} disabled={!answer.trim() || paused}>
        {isBoss ? 'Hold this position' : 'Walk through'}
      </button>
      <button className="full leave" data-testid="encounter-leave" onClick={onLeave}>
        {isBoss ? 'Step back for now' : 'Close the door for now'}
      </button>
      <p className="safe-note">PASS clears {isBoss ? 'a stage' : 'this crossing'} at no cost. Stepping back keeps every point you have earned.</p>

      {agency}
    </section>
  );
}
