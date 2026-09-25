import { useState } from 'react';
import type { CombatPlayerIntent } from '../runner';
import type { CombatVerb } from '../types';
import type { CombatantView, CombatPanelView, VerbView } from './combatPanelView';

/**
 * C13 mobile CombatPanel. Props in, intents out: it never calls the engine.
 * The integration owner renders it from buildCombatPanelView(...) and routes
 * `onIntent` into deterministic orchestration (e.g. runner.playRound).
 */
export interface CombatPanelProps {
  view: CombatPanelView;
  onIntent: (intent: CombatPlayerIntent) => void;
  /** Optional initial open menu (tests / restored UI state). */
  initialOpenVerb?: CombatVerb | null;
}

function HpRow({ combatant }: { combatant: CombatantView }) {
  return (
    <li className={`cp-hp cp-hp--${combatant.side}${combatant.down ? ' is-down' : ''}`}>
      <span className="cp-hp__name">{combatant.label}{combatant.down ? ' (down)' : ''}</span>
      <span className="cp-hp__bar" aria-hidden="true">
        <span className="cp-hp__fill" style={{ width: `${combatant.hpPercent}%` }} />
      </span>
      <span className="cp-hp__text">{combatant.hpText}</span>
    </li>
  );
}

export function CombatPanel({ view, onIntent, initialOpenVerb = null }: CombatPanelProps) {
  const [openVerb, setOpenVerb] = useState<CombatVerb | null>(initialOpenVerb);
  const open = view.verbs.find((verb) => verb.verb === openVerb && verb.enabled);

  const choose = (verb: VerbView) => {
    if (!verb.enabled) return;
    const usable = verb.options.filter((option) => option.enabled && option.intent);
    if (usable.length === 1 && verb.options.length === 1) {
      setOpenVerb(null);
      onIntent(usable[0].intent!);
      return;
    }
    setOpenVerb(openVerb === verb.verb ? null : verb.verb);
  };

  return (
    <section className="combat-panel" aria-label="Combat" data-phase={view.phase}>
      <header className="cp-objective">
        <p className="cp-objective__line"><strong>{view.objective.line}</strong></p>
        <p className="cp-objective__progress">
          <span>{view.objective.progressText}</span>
          <span className="cp-round"> · Round {view.round}</span>
        </p>
      </header>

      <ul className="cp-hp-list" aria-label="Health">
        <HpRow combatant={view.player} />
        {view.allies.map((ally) => <HpRow key={ally.id} combatant={ally} />)}
        {view.enemies.map((enemy) => <HpRow key={enemy.id} combatant={enemy} />)}
      </ul>

      {view.intents.length > 0 && (
        <ul className="cp-intents" aria-label="Enemy intent">
          {view.intents.map((intent) => (
            <li key={intent.enemyId} className={`cp-intent cp-intent--${intent.intent}`}>
              <span className="cp-glyph" aria-hidden="true">{intent.glyph}</span>
              <span>{intent.text}</span>
            </li>
          ))}
        </ul>
      )}

      {view.statuses.length > 0 && (
        <ul className="cp-statuses" aria-label="Statuses">
          {view.statuses.map((status) => (
            <li key={status.key} className={`cp-status cp-status--${status.status}`}>
              <span className="cp-glyph" aria-hidden="true">{status.glyph}</span>
              <span>
                <strong>{status.label}</strong> · {status.targetLabel} ({status.remainingRounds}r) — {status.explanation}
              </span>
            </li>
          ))}
        </ul>
      )}

      {view.outcome && <p className="cp-outcome" role="status">Encounter resolved: {view.outcome}.</p>}

      <div className="cp-verbs" role="group" aria-label="Actions">
        {view.verbs.map((verb) => (
          <button
            key={verb.verb}
            type="button"
            className={`cp-verb cp-verb--${verb.verb}`}
            disabled={!verb.enabled}
            aria-expanded={verb.options.length === 1 ? undefined : openVerb === verb.verb}
            aria-describedby={verb.reason ? `cp-reason-${verb.verb}` : undefined}
            data-verb={verb.verb}
            onClick={() => choose(verb)}
          >
            {verb.label}
          </button>
        ))}
      </div>

      <ul className="cp-reasons">
        {view.verbs.filter((verb) => verb.reason).map((verb) => (
          <li key={verb.verb} id={`cp-reason-${verb.verb}`} data-reason-for={verb.verb}>
            {verb.label}: {verb.reason}
          </li>
        ))}
      </ul>

      {open && (
        <ul className="cp-options" aria-label={`${open.label} options`}>
          {open.options.map((option) => (
            <li key={option.id}>
              <button
                type="button"
                className="cp-option"
                disabled={!option.enabled || !option.intent}
                data-option={option.id}
                onClick={() => {
                  if (!option.intent) return;
                  setOpenVerb(null);
                  onIntent(option.intent);
                }}
              >
                {option.label}
                {option.reason ? <span className="cp-option__reason"> — {option.reason}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
