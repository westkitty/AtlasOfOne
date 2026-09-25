import { useState } from 'react';
import { JournalHistory } from './JournalHistory';
import { nextJournalPrompt } from './prompts';
import type { JournalEntry } from './schema';
import type { VoiceState } from '../voice/types';

export interface JournalComposerProps {
  value: string;
  savedCount: number;
  onChange: (value: string) => void;
  /** Saves the draft; `sourcePrompt` is set only if Greyson chose a prompt. */
  onSave: (sourcePrompt?: string) => void;
  onClose: () => void;
  latestEntry?: JournalEntry;
  entries: readonly JournalEntry[];
  onMakeEntryPrivate: (id: string) => void;
  onRetractEntry: (id: string) => void;
  dictationSupported: boolean;
  dictationState: VoiceState;
  dictationStatusLabel: string;
  micMeterLive: boolean;
  micLevel: number;
  onStartDictation: () => void;
  onStopDictation: () => void;
  onCancelDictation: () => void;
  onMakeLatestPrivate: () => void;
  onRetractLatest: () => void;
}

/**
 * Blank, player-initiated Journal surface.
 *
 * Dictation is optional input only. Its transcript lands in this same editable
 * draft and never saves/submits itself. Provider responses, Reflection and
 * Adventure linking belong to later packets.
 */
export function JournalComposer({
  value,
  savedCount,
  onChange,
  onSave,
  onClose,
  latestEntry,
  dictationSupported,
  dictationState,
  dictationStatusLabel,
  micMeterLive,
  micLevel,
  onStartDictation,
  onStopDictation,
  onCancelDictation,
  onMakeLatestPrivate,
  onRetractLatest,
  entries,
  onMakeEntryPrivate,
  onRetractEntry
}: JournalComposerProps) {
  const [showHistory, setShowHistory] = useState(false);
  const [prompt, setPrompt] = useState<string | undefined>();

  const dictationBusy =
    dictationState === 'requesting-permission'
    || dictationState === 'listening'
    || dictationState === 'transcribing';

  return (
    <section
      className="journal-composer-overlay"
      data-testid="journal-composer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="journal-composer-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onClose();
      }}
    >
      <button
        type="button"
        className="journal-composer-close"
        data-testid="journal-close"
        aria-label="Close Journal"
        onClick={onClose}
      >
        <span aria-hidden="true">▾</span>
      </button>

      <header className="journal-composer-head">
        <p className="journal-composer-eyebrow">Local Journal</p>
        <h2 id="journal-composer-title">Write what you want.</h2>
        <p>No question required. Saving here does not score, interpret, or send the entry anywhere.</p>
      </header>

      {showHistory ? (
        <JournalHistory
          entries={entries}
          onMakePrivate={onMakeEntryPrivate}
          onRetract={onRetractEntry}
          onBack={() => setShowHistory(false)}
        />
      ) : (
      <>
      <label className="journal-composer-field">
        <span>Journal entry</span>
        <textarea
          autoFocus
          rows={7}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          data-testid="journal-entry-input"
          placeholder="Start anywhere."
        />
      </label>

      <section className="journal-prompt" data-testid="journal-prompt" aria-label="Optional prompt">
        {prompt === undefined ? (
          <button type="button" className="link-btn" data-testid="journal-prompt-request" onClick={() => setPrompt(nextJournalPrompt())}>
            Want a prompt? (optional)
          </button>
        ) : (
          <>
            <p data-testid="journal-prompt-text">{prompt}</p>
            <div className="journal-prompt-actions">
              <button type="button" className="link-btn" data-testid="journal-prompt-next" onClick={() => setPrompt(nextJournalPrompt(prompt))}>Another</button>
              <button type="button" className="link-btn" data-testid="journal-prompt-dismiss" onClick={() => setPrompt(undefined)}>No prompt</button>
            </div>
          </>
        )}
      </section>

      <section className="journal-dictation" data-testid="journal-dictation" aria-label="Journal dictation">
        <div className="journal-dictation-copy">
          <b>Dictate into this draft</b>
          <span data-testid="journal-dictation-status" aria-live="polite">
            {!dictationSupported && dictationState === 'idle'
              ? 'Microphone dictation unavailable — typing still works.'
              : dictationStatusLabel}
          </span>
        </div>

        {(dictationState === 'idle' || dictationState === 'error') && (
          <button
            type="button"
            data-testid="journal-dictate"
            disabled={!dictationSupported}
            onClick={onStartDictation}
          >
            {dictationState === 'error' ? 'Try dictation again' : 'Dictate'}
          </button>
        )}

        {dictationState === 'listening' && (
          <div className="journal-dictation-live">
            <div
              className={`mic-visualizer${micMeterLive ? '' : ' is-static'}`}
              data-testid="journal-mic-visualizer"
              data-level={Math.round(micLevel * 100)}
              data-metering={micMeterLive ? 'live' : 'unavailable'}
              role="img"
              aria-label={micMeterLive ? 'Microphone is live and listening' : 'Microphone is recording'}
            >
              {[0.55, 0.8, 1, 0.8, 0.55].map((weight, index) => (
                <span
                  key={index}
                  className="mic-bar"
                  style={{ transform: `scaleY(${(0.18 + micLevel * weight * 0.82).toFixed(3)})` }}
                />
              ))}
            </div>
            <button type="button" className="primary" data-testid="journal-dictation-done" onClick={onStopDictation}>
              Done speaking
            </button>
            <button type="button" data-testid="journal-dictation-cancel" onClick={onCancelDictation}>
              Cancel
            </button>
          </div>
        )}

        {(dictationState === 'requesting-permission' || dictationState === 'transcribing') && (
          <button type="button" data-testid="journal-dictation-cancel" onClick={onCancelDictation}>
            Cancel
          </button>
        )}
      </section>

      {latestEntry && (
        <aside className="journal-latest-controls" data-testid="journal-latest-controls">
          <div>
            <b>Latest saved entry</b>
            <span data-testid="journal-latest-status">
              {latestEntry.status === 'retracted'
                ? 'Retracted — kept in local history'
                : latestEntry.privacy === 'private'
                  ? 'Private — excluded from Atlas provider context'
                  : 'Saved locally'}
            </span>
          </div>
          <div className="journal-latest-actions">
            <button
              type="button"
              data-testid="journal-private-latest"
              disabled={latestEntry.privacy === 'private' || latestEntry.status === 'retracted'}
              onClick={onMakeLatestPrivate}
            >
              {latestEntry.privacy === 'private' ? 'Private' : 'Make private'}
            </button>
            <button
              type="button"
              data-testid="journal-retract-latest"
              disabled={latestEntry.status === 'retracted'}
              onClick={onRetractLatest}
            >
              {latestEntry.status === 'retracted' ? 'Retracted' : 'Retract'}
            </button>
          </div>
        </aside>
      )}

      <footer className="journal-composer-actions">
        <button
          type="button"
          className="link-btn"
          data-testid="journal-history-open"
          disabled={entries.length === 0 || dictationBusy}
          onClick={() => setShowHistory(true)}
        >
          History
        </button>
        <small data-testid="journal-saved-count">
          {savedCount === 0 ? 'No saved entries yet.' : `${savedCount} saved ${savedCount === 1 ? 'entry' : 'entries'}.`}
        </small>
        <button
          type="button"
          className="primary"
          data-testid="journal-save"
          disabled={!value.trim() || dictationBusy}
          onClick={() => onSave(prompt)}
        >
          Save locally
        </button>
      </footer>
      </>
      )}
    </section>
  );
}
