import { useState } from 'react';
import { renderFallbackBeat } from '../adventure/fallbackRenderer';
import type { AdventureRun, AdventureSeed } from '../adventure/schema';
import { CombatPanel } from '../combat/ui/CombatPanel';
import type { CombatPanelView } from '../combat/ui/combatPanelView';
import type { CombatPlayerIntent } from '../combat/runner';

export interface AdventurePanelProps {
  /** The active run, if any. */
  active?: { run: AdventureRun; seed: AdventureSeed };
  /** Available, eligible seeds Greyson may start (shown when nothing is active). */
  available: readonly AdventureSeed[];
  combatView?: CombatPanelView;
  lastOutcome?: string;
  /** N05: recalls an earlier character/place in this territory (structural label only). */
  recurringLine?: string | null;
  onStart: (seedId: string) => void;
  onChoice: (label: string) => void;
  onCombatIntent: (intent: CombatPlayerIntent) => void;
  onWithdraw: () => void;
  onClose: () => void;
}

/**
 * Adventure surface (I01/I02 presentation).
 *
 * Presentation only: beat text comes from the deterministic local renderer
 * (A06), Combat from the C13 panel. Every beat offers a way to step away,
 * and free input is always accepted. Nothing here decides mechanics.
 */
export function AdventurePanel({
  active,
  available,
  combatView,
  lastOutcome,
  recurringLine,
  onStart,
  onChoice,
  onCombatIntent,
  onWithdraw,
  onClose
}: AdventurePanelProps) {
  const [freeText, setFreeText] = useState('');
  const beat = active && active.run.status === 'active'
    ? renderFallbackBeat(active.seed, active.run.currentBeat as Parameters<typeof renderFallbackBeat>[1])
    : undefined;

  return (
    <section
      className="adventure-overlay"
      data-testid="adventure-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="adventure-title"
      onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}
    >
      <button type="button" className="journal-composer-close" data-testid="adventure-close" aria-label="Back to the map" onClick={onClose}>
        <span aria-hidden="true">▾</span>
      </button>

      {!beat ? (
        <>
          <h2 id="adventure-title">Adventures</h2>
          {lastOutcome && <p className="adventure-outcome" data-testid="adventure-outcome" role="status">{lastOutcome}</p>}
          {available.length === 0 ? (
            <p data-testid="adventure-none">No adventures waiting right now. Choose “Explore this” on a Journal entry to open one.</p>
          ) : (
            <ul className="adventure-seed-list">
              {available.map((seed) => (
                <li key={seed.id}>
                  <p>{seed.premise}</p>
                  {seed.learningTarget === 'none' && <small className="chip" data-testid="adventure-just-for-fun">Just for fun</small>}
                  <button type="button" className="primary" data-testid="adventure-start" onClick={() => onStart(seed.id)}>
                    Set out
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <p className="journal-composer-eyebrow" data-testid="adventure-beat" data-beat={beat.beat}>
            {beat.heading} · {beat.index + 1} of {beat.total}
          </p>
          <h2 id="adventure-title" className="adventure-prompt" data-testid="adventure-prompt">{beat.prompt}</h2>
          {beat.beat === 'hook' && recurringLine && <p className="adventure-recurring" data-testid="adventure-recurring">{recurringLine}</p>}

          {combatView ? (
            <div data-testid="adventure-combat">
              <CombatPanel view={combatView} onIntent={onCombatIntent} />
            </div>
          ) : (
            <>
              <div className="adventure-options">
                {beat.options.map((option) => (
                  <button key={option.id} type="button" data-testid="adventure-option" onClick={() => onChoice(option.label)}>
                    {option.label}
                  </button>
                ))}
              </div>
              <form
                className="adventure-free"
                onSubmit={(event) => {
                  event.preventDefault();
                  const text = freeText.trim();
                  if (!text) return;
                  setFreeText('');
                  onChoice(text);
                }}
              >
                <label>
                  <span>Or do something else</span>
                  <input
                    data-testid="adventure-free-input"
                    value={freeText}
                    maxLength={200}
                    onChange={(event) => setFreeText(event.target.value)}
                    placeholder="Anything you like"
                  />
                </label>
                <button type="submit" data-testid="adventure-free-submit" disabled={!freeText.trim()}>Go</button>
              </form>
            </>
          )}

          <button type="button" className="link-btn adventure-withdraw" data-testid="adventure-withdraw" onClick={onWithdraw}>
            {beat.withdrawOption.label}
          </button>
        </>
      )}
    </section>
  );
}
