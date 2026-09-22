import { useMemo, useState, type ReactNode } from 'react';
import './JournalPanel.css';
import { sanctuaryFor } from '../world/sanctuaries';
import { voiceStateLabel } from '../voice/state';
import { journalEntriesForDate, journalEntryDates, journalEntriesNewestFirst } from './state';
import type { JournalEntry, JournalPrivacy } from '../contracts/journal';
import type { KnowledgeGapStatus } from '../contracts/reflection';
import type { SassLevel, TerritoryState } from '../game/types';
import type { MockPrompt } from '../cartographer/mock';
import type { VoiceMode, VoiceState } from '../voice/types';

const GREYSON_PORTRAITS = {
  neutral: '/assets/atlas/v3/greyson/portrait-neutral.png', serious: '/assets/atlas/v3/greyson/portrait-serious.png',
  warm: '/assets/atlas/v3/greyson/portrait-warm.png', wry: '/assets/atlas/v3/greyson/portrait-wry.png'
} as const;

export type JournalExplorationStatus = 'none' | KnowledgeGapStatus;

export interface JournalPanelProps {
  activeTerritory: TerritoryState; prompt: MockPrompt; promptOverride: { kind: 'deeper' | 'reroll'; prompt: MockPrompt } | null;
  reply: string; answer: string; sessionPaused: boolean; quiet: boolean; sass: SassLevel; bannersLength: number;
  voiceMode: VoiceMode; voiceState: VoiceState; isSubmitting: boolean; micLevel: number; micMeterLive: boolean;
  draftPrivate: boolean; promptRequested: boolean; journalEntries: JournalEntry[];
  explorationStatusByEntryId: Readonly<Record<string, JournalExplorationStatus>>;
  onAnswerChange: (answer: string) => void; onDraftPrivateChange: (value: boolean) => void; onRequestPrompt: () => void;
  onSaveJournal: () => void; onRetractJournal: (entryId: string) => void; onSetJournalPrivacy: (entryId: string, privacy: JournalPrivacy) => void;
  onExploreLater: (entryId: string) => void; onExploreNow: (entryId: string) => void; onStopExploring: (entryId: string) => void;
  onClose: () => void; onModeChange: (mode: VoiceMode) => void; onSubmit: () => void;
  onStartRecording: () => void; onStopRecording: () => void; onCancelVoice: () => void; actionBar: ReactNode;
}

const entryTime = (createdAt: string) => createdAt.replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');

export function JournalPanel(props: JournalPanelProps) {
  const {
    activeTerritory, prompt, promptOverride, reply, answer, sessionPaused, quiet, sass, bannersLength, voiceMode, voiceState,
    isSubmitting, micLevel, micMeterLive, draftPrivate, promptRequested, journalEntries, explorationStatusByEntryId, onAnswerChange, onDraftPrivateChange,
    onRequestPrompt, onSaveJournal, onRetractJournal, onSetJournalPrivacy, onExploreLater, onExploreNow, onStopExploring, onClose, onModeChange, onSubmit, onStartRecording,
    onStopRecording, onCancelVoice, actionBar
  } = props;
  const [dateFilter, setDateFilter] = useState('all');
  const activeSanctuary = sanctuaryFor(activeTerritory.id);
  const dates = useMemo(() => journalEntryDates(journalEntries), [journalEntries]);
  const history = useMemo(
    () => dateFilter === 'all' ? journalEntriesNewestFirst(journalEntries) : journalEntriesForDate(journalEntries, dateFilter),
    [dateFilter, journalEntries]
  );
  const promptLabel = promptOverride ? `${promptOverride.kind === 'deeper' ? 'Going deeper' : 'Reframed'} prompt` : 'Optional prompt';

  return <div className="convo journal" data-testid="convo">
    <button className="convo-close" data-testid="leave-encounter" aria-label="Back to the map" onClick={onClose}><span aria-hidden="true">▾</span></button>
    <div className="convo-header"><div className="convo-portrait" aria-hidden="true"><img src={quiet ? GREYSON_PORTRAITS.serious : (sass === 'risks-understood' ? GREYSON_PORTRAITS.wry : (bannersLength > 0 ? GREYSON_PORTRAITS.warm : GREYSON_PORTRAITS.neutral))} alt="Greyson" draggable={false} /></div><div className="convo-meta"><div className="convo-sanctuary" data-testid="convo-sanctuary"><span className="convo-sanctuary-glyph" aria-hidden="true">{activeSanctuary.glyph}</span><strong className="convo-sanctuary-name">{activeSanctuary.name}</strong><span className="convo-sanctuary-atmosphere">· {activeSanctuary.atmosphere}</span></div><p className="convo-speaker">Journal{quiet && <span className="chip">quiet</span>}</p><small className="convo-dimension">Local first. You decide what it means.</small></div></div>
    {reply && <p className="convo-reply" role="status">{reply}</p>}
    <h2 className="journal-title">Journal</h2>
    {sessionPaused && <p className="convo-paused">Session paused. Your Atlas is safe.</p>}
    {promptRequested && <section className="journal-prompt" data-testid="journal-prompt"><span className="eyebrow">{promptLabel}</span><small className="convo-dimension" data-testid="prompt-dimension">Evidence dimension: {prompt.dimension}</small><p className="convo-question" data-testid="prompt-question">{prompt.question}</p></section>}
    {voiceMode === 'type'
      ? <div className="composer journal-composer"><label className="answer">Write what is here<textarea autoFocus rows={4} value={answer} onChange={(e) => onAnswerChange(e.target.value)} disabled={sessionPaused} data-testid="answer-input" placeholder="Write it however it comes out." /></label><label className="journal-private"><input type="checkbox" checked={draftPrivate} onChange={(event) => onDraftPrivateChange(event.target.checked)} disabled={sessionPaused} data-testid="journal-private-draft" /> Keep this entry private</label><div className="composer-send"><button className="link-btn" data-testid="mode-talk" onClick={() => onModeChange('talk')} disabled={sessionPaused}>Dictate instead</button><button className="primary" data-testid="save-journal" onClick={onSaveJournal} disabled={!answer.trim() || sessionPaused}>Save locally</button></div>{promptRequested && <><button className="link-btn journal-map" data-testid="submit-answer" onClick={onSubmit} disabled={!answer.trim() || sessionPaused || isSubmitting || draftPrivate} aria-describedby={draftPrivate ? 'journal-private-map-note' : undefined}>{isSubmitting ? 'Mapping coordinate...' : 'Map this answer'}</button>{draftPrivate && <small id="journal-private-map-note" className="journal-private-note">Private entries stay local and cannot be mapped.</small>}</>}</div>
      : <div className="voice-card" data-testid="voice-card"><span className={`voice-badge ${voiceState}`} data-testid="voice-status">{voiceState === 'idle' && isSubmitting ? 'The Cartographer is thinking...' : voiceStateLabel(voiceState)}</span>{voiceState === 'idle' && !isSubmitting && <button className="mic-btn" data-testid="mic-button" aria-label="Start listening" onClick={onStartRecording} disabled={sessionPaused}>🎙</button>}{voiceState === 'listening' && <><div className={`mic-visualizer${micMeterLive ? '' : ' is-static'}`} data-testid="mic-visualizer" data-level={Math.round(micLevel * 100)} data-metering={micMeterLive ? 'live' : 'unavailable'} role="img" aria-label={micMeterLive ? 'Microphone is live and listening' : 'Microphone is recording'}>{[0.55, 0.8, 1, 0.8, 0.55].map((weight, index) => <span key={index} className="mic-bar" style={{ transform: `scaleY(${(0.18 + micLevel * weight * 0.82).toFixed(3)})` }} />)}</div><button className="mic-btn is-listening" data-testid="mic-stop" aria-label="Done speaking" onClick={onStopRecording}>◼</button><div className="voice-actions"><button className="primary" data-testid="voice-submit-done" onClick={onStopRecording}>Done speaking</button><button data-testid="voice-cancel" onClick={onCancelVoice}>Cancel</button></div></>}{(voiceState === 'requesting-permission' || voiceState === 'transcribing') && <div className="voice-actions"><button data-testid="voice-cancel" onClick={onCancelVoice}>Cancel</button></div>}{voiceState === 'error' && <div className="voice-actions"><button className="primary" data-testid="voice-retry" onClick={onStartRecording}>Try again</button><button data-testid="voice-fallback-type" onClick={() => onModeChange('type')}>Switch to typing</button></div>}<button className="link-btn" data-testid="mode-type" onClick={() => onModeChange('type')}>Type instead</button></div>}
    {!promptRequested && <button className="link-btn journal-request-prompt" data-testid="request-prompt" onClick={onRequestPrompt} disabled={sessionPaused}>Give me a prompt</button>}
    <section className="journal-history" aria-label="Journal history"><div className="journal-history-head"><h3>History</h3><label>Date<select value={dateFilter} onChange={(event) => setDateFilter(event.target.value)} data-testid="journal-date-filter"><option value="all">All dates</option>{dates.map((date) => <option key={date} value={date}>{date}</option>)}</select></label></div>{history.length === 0 ? <p className="journal-empty">Nothing saved yet.</p> : <ol className="journal-entry-list" data-testid="journal-history">{history.map((entry) => {
      const explorationStatus = explorationStatusByEntryId[entry.id] ?? 'none';
      const canExplore = entry.status === 'active' && entry.privacy === 'normal';
      return <li key={entry.id} className={`journal-entry ${entry.status === 'retracted' ? 'is-retracted' : ''}`}><div className="journal-entry-head"><time dateTime={entry.createdAt}>{entryTime(entry.createdAt)}</time><span className="journal-entry-state">{entry.status === 'retracted' ? 'Retracted' : entry.privacy === 'private' ? 'Private' : 'Active'}</span></div><p>{entry.text}</p><small>{entry.inputMode === 'speech-to-text' ? 'Dictated, then editable' : 'Typed'}{entry.sourcePrompt ? ' · prompted' : ''}{entry.reflectionIds.length || entry.adventureIds.length ? ` · ${entry.reflectionIds.length} reflection / ${entry.adventureIds.length} adventure links` : ''}</small>{entry.status === 'active' && <div className="journal-entry-actions"><button data-testid={`journal-privacy-${entry.id}`} onClick={() => onSetJournalPrivacy(entry.id, entry.privacy === 'private' ? 'normal' : 'private')}>{entry.privacy === 'private' ? 'Make normal' : 'Make private'}</button><button data-testid={`journal-retract-${entry.id}`} onClick={() => onRetractJournal(entry.id)}>Retract</button>{canExplore && explorationStatus === 'none' && <button data-testid={`journal-explore-${entry.id}`} onClick={() => onExploreLater(entry.id)}>Explore later</button>}{canExplore && explorationStatus === 'open' && <button data-testid={`journal-explore-now-${entry.id}`} onClick={() => onExploreNow(entry.id)}>Explore this</button>}{canExplore && (explorationStatus === 'open' || explorationStatus === 'seeded') && <button data-testid={`journal-stop-exploring-${entry.id}`} onClick={() => onStopExploring(entry.id)}>Don't explore this</button>}{canExplore && explorationStatus === 'seeded' && <span className="journal-exploration-state" data-testid={`journal-exploration-${entry.id}`}>Adventure ready</span>}{canExplore && explorationStatus === 'retired' && <span className="journal-exploration-state" data-testid={`journal-exploration-${entry.id}`}>Not exploring</span>}{canExplore && explorationStatus === 'resolved' && <span className="journal-exploration-state" data-testid={`journal-exploration-${entry.id}`}>Explored</span>}</div>}</li>;
    })}</ol>}</section>
    {actionBar}
  </div>;
}
