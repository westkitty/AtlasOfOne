import type { ReactNode } from 'react';
import type { Sanctuary } from '../world/sanctuaries';
import type { VoiceMode, VoiceState } from '../voice/types';

export interface JournalPanelProps {
  sanctuary: Sanctuary;
  portraitSrc: string;
  quiet: boolean;
  presentationLabel: string;
  dimension: string;
  dimensionSuffix: string;
  reply: string;
  question: string;
  paused: boolean;
  voiceMode: VoiceMode;
  voiceState: VoiceState;
  voiceStatusLabel: string;
  answer: string;
  isSubmitting: boolean;
  micMeterLive: boolean;
  micLevel: number;
  actions: ReactNode;
  onClose: () => void;
  onAnswerChange: (value: string) => void;
  onUseTalk: () => void;
  onSubmit: () => void;
  onStartDictation: () => void;
  onStopDictation: () => void;
  onCancelVoice: () => void;
  onRetryVoice: () => void;
  onUseType: () => void;
}

/**
 * Journal-facing interaction shell.
 *
 * This component owns presentation only. It emits player intent through callbacks
 * and receives already-derived state. It does not compile provider context,
 * create GameEvents, persist campaign data, or own speech-to-text lifecycle.
 */
export function JournalPanel({
  sanctuary,
  portraitSrc,
  quiet,
  presentationLabel,
  dimension,
  dimensionSuffix,
  reply,
  question,
  paused,
  voiceMode,
  voiceState,
  voiceStatusLabel,
  answer,
  isSubmitting,
  micMeterLive,
  micLevel,
  actions,
  onClose,
  onAnswerChange,
  onUseTalk,
  onSubmit,
  onStartDictation,
  onStopDictation,
  onCancelVoice,
  onRetryVoice,
  onUseType
}: JournalPanelProps) {
  return (
    <div className="convo" data-testid="convo">
      <button className="convo-close" data-testid="leave-encounter" aria-label="Back to the map" onClick={onClose}>
        <span aria-hidden="true">▾</span>
      </button>

      <div className="convo-header">
        <div className="convo-portrait" aria-hidden="true">
          <img src={portraitSrc} alt="Greyson" draggable={false} />
        </div>
        <div className="convo-meta">
          <div className="convo-sanctuary" data-testid="convo-sanctuary">
            <span className="convo-sanctuary-glyph" aria-hidden="true">{sanctuary.glyph}</span>
            <strong className="convo-sanctuary-name">{sanctuary.name}</strong>
            <span className="convo-sanctuary-atmosphere">· {sanctuary.atmosphere}</span>
          </div>
          <p className="convo-speaker">The Cartographer{quiet && <span className="chip">{presentationLabel}</span>}</p>
          <small className="convo-dimension" data-testid="prompt-dimension">Evidence dimension: {dimension}{dimensionSuffix}</small>
        </div>
      </div>

      {reply && <p className="convo-reply" role="status">{reply}</p>}
      <h2 className="convo-question" data-testid="prompt-question">{question}</h2>
      {paused && <p className="convo-paused">Session paused. Your Atlas is safe.</p>}

      {voiceMode === 'type' ? (
        <div className="composer">
          <label className="answer">Your answer
            <textarea
              rows={2}
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              disabled={paused}
              data-testid="answer-input"
              placeholder="Say it however it comes out."
            />
          </label>
          <div className="composer-send">
            <button className="link-btn" data-testid="mode-talk" onClick={onUseTalk}>Speak instead</button>
            <button className="primary" data-testid="submit-answer" onClick={onSubmit} disabled={!answer.trim() || paused || isSubmitting}>
              {isSubmitting ? 'Mapping coordinate...' : 'Map this answer'}
            </button>
          </div>
        </div>
      ) : (
        <div className="voice-card" data-testid="voice-card">
          <span className={`voice-badge ${voiceState}`} data-testid="voice-status">{voiceStatusLabel}</span>
          {voiceState === 'idle' && (
            <button className="mic-btn" data-testid="mic-button" aria-label="Start dictation" onClick={onStartDictation} disabled={paused}>
              🎙
            </button>
          )}
          {voiceState === 'listening' && (
            <>
              <div
                className={`mic-visualizer${micMeterLive ? '' : ' is-static'}`}
                data-testid="mic-visualizer"
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
              <button className="mic-btn is-listening" data-testid="mic-stop" aria-label="Done speaking" onClick={onStopDictation}>
                ◼
              </button>
              <div className="voice-actions">
                <button className="primary" data-testid="voice-submit-done" onClick={onStopDictation}>Done speaking</button>
                <button data-testid="voice-cancel" onClick={onCancelVoice}>Cancel</button>
              </div>
            </>
          )}
          {voiceState === 'requesting-permission' && (
            <div className="voice-actions">
              <button data-testid="voice-cancel" onClick={onCancelVoice}>Cancel</button>
            </div>
          )}
          {voiceState === 'transcribing' && (
            <div className="voice-actions">
              <button data-testid="voice-cancel" onClick={onCancelVoice}>Cancel</button>
            </div>
          )}
          {voiceState === 'error' && (
            <div className="voice-actions">
              <button className="primary" data-testid="voice-retry" onClick={onRetryVoice}>Try again</button>
              <button data-testid="voice-fallback-type" onClick={onUseType}>Switch to typing</button>
            </div>
          )}
          <button className="link-btn" data-testid="mode-type" onClick={onUseType}>Type instead</button>
        </div>
      )}

      {actions}
    </div>
  );
}
