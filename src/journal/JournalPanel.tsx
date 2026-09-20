import type { ReactNode } from 'react';
import { sanctuaryFor } from '../world/sanctuaries';
import { voiceStateLabel } from '../voice/state';
import type { SassLevel, TerritoryState } from '../game/types';
import type { MockPrompt } from '../cartographer/mock';
import type { VoiceMode, VoiceState } from '../voice/types';

const GREYSON_PORTRAITS = {
  neutral: '/assets/atlas/v3/greyson/portrait-neutral.png', serious: '/assets/atlas/v3/greyson/portrait-serious.png',
  warm: '/assets/atlas/v3/greyson/portrait-warm.png', wry: '/assets/atlas/v3/greyson/portrait-wry.png'
} as const;

export interface JournalPanelProps {
  activeTerritory: TerritoryState; prompt: MockPrompt; promptOverride: { kind: 'deeper' | 'reroll'; prompt: MockPrompt } | null;
  reply: string; answer: string; sessionPaused: boolean; quiet: boolean; sass: SassLevel; bannersLength: number;
  voiceMode: VoiceMode; voiceState: VoiceState; isSubmitting: boolean; micLevel: number; micMeterLive: boolean;
  onAnswerChange: (answer: string) => void; onClose: () => void; onModeChange: (mode: VoiceMode) => void; onSubmit: () => void;
  onStartRecording: () => void; onStopRecording: () => void; onCancelVoice: () => void; actionBar: ReactNode;
}

export function JournalPanel(props: JournalPanelProps) {
  const { activeTerritory, prompt, promptOverride, reply, answer, sessionPaused, quiet, sass, bannersLength, voiceMode, voiceState, isSubmitting, micLevel, micMeterLive, onAnswerChange, onClose, onModeChange, onSubmit, onStartRecording, onStopRecording, onCancelVoice, actionBar } = props;
  const activeSanctuary = sanctuaryFor(activeTerritory.id);
  return <div className="convo" data-testid="convo">
    <button className="convo-close" data-testid="leave-encounter" aria-label="Back to the map" onClick={onClose}><span aria-hidden="true">▾</span></button>
    <div className="convo-header"><div className="convo-portrait" aria-hidden="true"><img src={quiet ? GREYSON_PORTRAITS.serious : (sass === 'risks-understood' ? GREYSON_PORTRAITS.wry : (bannersLength > 0 ? GREYSON_PORTRAITS.warm : GREYSON_PORTRAITS.neutral))} alt="Greyson" draggable={false} /></div><div className="convo-meta"><div className="convo-sanctuary" data-testid="convo-sanctuary"><span className="convo-sanctuary-glyph" aria-hidden="true">{activeSanctuary.glyph}</span><strong className="convo-sanctuary-name">{activeSanctuary.name}</strong><span className="convo-sanctuary-atmosphere">· {activeSanctuary.atmosphere}</span></div><p className="convo-speaker">The Cartographer{quiet && <span className="chip">quiet</span>}</p><small className="convo-dimension" data-testid="prompt-dimension">Evidence dimension: {prompt.dimension}{promptOverride ? ` · ${promptOverride.kind === 'deeper' ? 'going deeper' : 'reframed'}` : ''}</small></div></div>
    {reply && <p className="convo-reply" role="status">{reply}</p>}
    <h2 className="convo-question" data-testid="prompt-question">{prompt.question}</h2>
    {sessionPaused && <p className="convo-paused">Session paused. Your Atlas is safe.</p>}
    {voiceMode === 'type' ? <div className="composer"><label className="answer">Your answer<textarea rows={2} value={answer} onChange={(e) => onAnswerChange(e.target.value)} disabled={sessionPaused} data-testid="answer-input" placeholder="Say it however it comes out." /></label><div className="composer-send"><button className="link-btn" data-testid="mode-talk" onClick={() => onModeChange('talk')}>Speak instead</button><button className="primary" data-testid="submit-answer" onClick={onSubmit} disabled={!answer.trim() || sessionPaused || isSubmitting}>{isSubmitting ? 'Mapping coordinate...' : 'Map this answer'}</button></div></div> : <div className="voice-card" data-testid="voice-card"><span className={`voice-badge ${voiceState}`} data-testid="voice-status">{voiceState === 'idle' && isSubmitting ? 'The Cartographer is thinking...' : voiceStateLabel(voiceState)}</span>{voiceState === 'idle' && !isSubmitting && <button className="mic-btn" data-testid="mic-button" aria-label="Start listening" onClick={onStartRecording} disabled={sessionPaused}>🎙</button>}{voiceState === 'listening' && <><div className={`mic-visualizer${micMeterLive ? '' : ' is-static'}`} data-testid="mic-visualizer" data-level={Math.round(micLevel * 100)} data-metering={micMeterLive ? 'live' : 'unavailable'} role="img" aria-label={micMeterLive ? 'Microphone is live and listening' : 'Microphone is recording'}>{[0.55, 0.8, 1, 0.8, 0.55].map((weight, index) => <span key={index} className="mic-bar" style={{ transform: `scaleY(${(0.18 + micLevel * weight * 0.82).toFixed(3)})` }} />)}</div><button className="mic-btn is-listening" data-testid="mic-stop" aria-label="Done speaking" onClick={onStopRecording}>◼</button><div className="voice-actions"><button className="primary" data-testid="voice-submit-done" onClick={onStopRecording}>Done speaking</button><button data-testid="voice-cancel" onClick={onCancelVoice}>Cancel</button></div></>}{(voiceState === 'requesting-permission' || voiceState === 'transcribing') && <div className="voice-actions"><button data-testid="voice-cancel" onClick={onCancelVoice}>Cancel</button></div>}{voiceState === 'error' && <div className="voice-actions"><button className="primary" data-testid="voice-retry" onClick={onStartRecording}>Try again</button><button data-testid="voice-fallback-type" onClick={() => onModeChange('type')}>Switch to typing</button></div>}<button className="link-btn" data-testid="mode-type" onClick={() => onModeChange('type')}>Type instead</button></div>}
    {actionBar}
  </div>;
}
