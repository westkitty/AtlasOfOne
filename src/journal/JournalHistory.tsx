import { useState } from 'react';
import { groupJournalEntriesByDay } from './domain';
import type { JournalEntry } from './schema';

export interface JournalHistoryProps {
  entries: readonly JournalEntry[];
  onMakePrivate: (id: string) => void;
  onRetract: (id: string) => void;
  onBack: () => void;
  /** Places Greyson may choose for an explicit "Explore this". */
  exploreTerritories?: readonly { id: string; label: string }[];
  onExplore?: (id: string, territoryId: string) => void;
}

function formatDay(dayKey: string): string {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function formatTime(createdAt: string): string {
  return new Date(createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function statusLabel(entry: JournalEntry): string | undefined {
  if (entry.status === 'retracted') return 'Retracted';
  if (entry.privacy === 'private') return 'Private';
  return undefined;
}

/**
 * J06 local Journal history with day navigation.
 *
 * Presentation only: every change goes through the caller's privacy callbacks,
 * which apply M06 retirement. Nothing here sends entries anywhere.
 */
export function JournalHistory({ entries, onMakePrivate, onRetract, onBack, exploreTerritories = [], onExplore }: JournalHistoryProps) {
  const [exploringId, setExploringId] = useState<string | undefined>();
  const groups = groupJournalEntriesByDay(entries);
  const [dayIndex, setDayIndex] = useState(0);
  const [openId, setOpenId] = useState<string | undefined>();
  const safeIndex = Math.min(dayIndex, Math.max(groups.length - 1, 0));
  const group = groups[safeIndex];

  return (
    <section className="journal-history" data-testid="journal-history" aria-label="Journal history">
      <div className="journal-history-head">
        <button type="button" data-testid="journal-history-back" onClick={onBack}>Back to writing</button>
      </div>

      {!group ? (
        <p className="journal-history-empty" data-testid="journal-history-empty">No saved entries yet.</p>
      ) : (
        <>
          <nav className="journal-history-days" aria-label="Journal days">
            <button
              type="button"
              data-testid="journal-history-newer"
              aria-label="Newer day"
              disabled={safeIndex === 0}
              onClick={() => { setDayIndex(safeIndex - 1); setOpenId(undefined); }}
            >
              ‹
            </button>
            <h3 data-testid="journal-history-day" data-day={group.dayKey} aria-live="polite">{formatDay(group.dayKey)}</h3>
            <button
              type="button"
              data-testid="journal-history-older"
              aria-label="Older day"
              disabled={safeIndex >= groups.length - 1}
              onClick={() => { setDayIndex(safeIndex + 1); setOpenId(undefined); }}
            >
              ›
            </button>
          </nav>

          <ol className="journal-history-list">
            {group.entries.map((entry) => {
              const status = statusLabel(entry);
              const open = openId === entry.id;
              return (
                <li key={entry.id} className="journal-history-entry" data-testid="journal-history-entry" data-entry-id={entry.id}>
                  <button
                    type="button"
                    className="journal-history-summary"
                    aria-expanded={open}
                    onClick={() => setOpenId(open ? undefined : entry.id)}
                  >
                    <time dateTime={entry.createdAt}>{formatTime(entry.createdAt)}</time>
                    {status && <span className="journal-history-status" data-testid="journal-history-status">{status}</span>}
                    <span className="journal-history-excerpt">{entry.text.trim().slice(0, 90)}{entry.text.trim().length > 90 ? '…' : ''}</span>
                  </button>
                  {open && (
                    <div className="journal-history-detail" data-testid="journal-history-detail">
                      {entry.sourcePrompt && <p className="journal-history-prompt">Prompt: {entry.sourcePrompt}</p>}
                      <p className="journal-history-text">{entry.text}</p>
                      <div className="journal-latest-actions">
                        <button
                          type="button"
                          data-testid="journal-history-private"
                          disabled={entry.privacy === 'private' || entry.status === 'retracted'}
                          onClick={() => onMakePrivate(entry.id)}
                        >
                          {entry.privacy === 'private' ? 'Private' : 'Make private'}
                        </button>
                        <button
                          type="button"
                          data-testid="journal-history-retract"
                          disabled={entry.status === 'retracted'}
                          onClick={() => onRetract(entry.id)}
                        >
                          {entry.status === 'retracted' ? 'Retracted' : 'Retract'}
                        </button>
                      </div>
                      {onExplore && entry.status === 'active' && entry.privacy === 'normal' && exploreTerritories.length > 0 && (
                        exploringId === entry.id ? (
                          <div className="journal-explore" data-testid="journal-explore-places" role="group" aria-label="Where should this adventure happen?">
                            <p>Where should this adventure happen?</p>
                            {exploreTerritories.map((territory) => (
                              <button
                                key={territory.id}
                                type="button"
                                data-testid="journal-explore-place"
                                data-territory={territory.id}
                                onClick={() => { setExploringId(undefined); onExplore(entry.id, territory.id); }}
                              >
                                {territory.label}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <button type="button" className="link-btn" data-testid="journal-explore" onClick={() => setExploringId(entry.id)}>
                            Explore this (optional adventure)
                          </button>
                        )
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </section>
  );
}
