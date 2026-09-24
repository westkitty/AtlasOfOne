import type { JournalEntry } from './schema';

export interface JournalComposerProps {
  value: string;
  savedCount: number;
  onChange: (value: string) => void;
  onSave: () => void;
  onClose: () => void;
  latestEntry?: JournalEntry;
  onMakeLatestPrivate: () => void;
  onRetractLatest: () => void;
}

/**
 * Blank, player-initiated Journal surface.
 *
 * This is deliberately not a Cartographer question form. It accepts Greyson's
 * text without a preceding prompt and emits only local save/close intent.
 * Provider responses, privacy controls, STT and history navigation belong to
 * later Journal packets.
 */
export function JournalComposer({
  value,
  savedCount,
  onChange,
  onSave,
  onClose,
  latestEntry,
  onMakeLatestPrivate,
  onRetractLatest
}: JournalComposerProps) {
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
        <small data-testid="journal-saved-count">
          {savedCount === 0 ? 'No saved entries yet.' : `${savedCount} saved ${savedCount === 1 ? 'entry' : 'entries'}.`}
        </small>
        <button
          type="button"
          className="primary"
          data-testid="journal-save"
          disabled={!value.trim()}
          onClick={onSave}
        >
          Save locally
        </button>
      </footer>
    </section>
  );
}
