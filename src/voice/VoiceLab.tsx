import { useEffect, useMemo, useState } from 'react';
import { cancelSpeech, speakText } from './synthesis';
import { availableVoices, forgetResolvedVoice, getVoicePreference, loadVoices, resolveVoice, scoreVoice, setVoicePreference } from './voices';

/**
 * Development-only voice audition surface.
 *
 * Reached at `?voice-lab=1` and never rendered in ordinary play. Tests can
 * prove which voice the resolver picks; they cannot tell anyone whether it
 * sounds good, so this exists to let a person listen to the real voices on
 * their own device and choose.
 *
 * The samples are Cartographer-shaped but synthetic. No real campaign content.
 */

const SAMPLES = [
  { id: 'short', label: 'Short question', text: 'What does loyalty have to cost before it stops being owed?' },
  {
    id: 'long',
    label: 'Long question',
    text: 'You have mapped two things that pull against each other: the belief that fairness is about power rather than treatment, and the instinct to protect whoever has least of it. When those two collide in an ordinary week, which one actually wins, and what decides it?'
  },
  { id: 'dry', label: 'Dry / sass', text: 'Coordinate logged. The map has, regrettably, learned something.' },
  { id: 'quiet', label: 'Serious / quiet', text: 'Understood. I will keep this plain, and treat that as a coordinate rather than a performance.', quiet: true }
];

export function VoiceLab() {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [preference, setPreference] = useState<string | null>(() => getVoicePreference());
  const [rate, setRate] = useState(1);
  const [speaking, setSpeaking] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    void loadVoices().then((loaded) => { if (live) setVoices(loaded); });
    return () => { live = false; cancelSpeech(); };
  }, []);

  const english = useMemo(() => availableVoices(), [voices.length]);
  const automatic = useMemo(() => resolveVoice(voices, null), [voices]);
  const active = useMemo(() => resolveVoice(voices, preference), [voices, preference]);

  const play = (voiceURI: string, sample: typeof SAMPLES[number]) => {
    const voice = voices.find((item) => item.voiceURI === voiceURI) ?? null;
    setSpeaking(`${voiceURI}:${sample.id}`);
    speakText(sample.text, {
      voice,
      quiet: Boolean(sample.quiet),
      rate: sample.quiet ? rate * 0.92 : rate,
      onEnd: () => setSpeaking(null),
      onError: () => setSpeaking(null)
    });
  };

  const choose = (voiceURI: string | null) => {
    setVoicePreference(voiceURI);
    forgetResolvedVoice();
    setPreference(voiceURI);
  };

  return <div className="lab" data-testid="voice-lab">
    <header className="lab-head">
      <span className="eyebrow">DEVELOPMENT · VOICE LAB</span>
      <h1>What the Cartographer sounds like</h1>
      <p>
        {english.length} usable English {english.length === 1 ? 'voice' : 'voices'} on this device, best first.
        Automatic pick: <strong>{automatic?.name ?? 'none available'}</strong>.
        {preference && <> Your choice: <strong>{active?.name ?? 'no longer installed'}</strong>.</>}
      </p>
      <p className="lab-note">
        Not part of the game. Nothing here is sent anywhere, and the samples are synthetic.
        If macOS offers you a Premium or Enhanced voice under Spoken Content, install it and it will be picked automatically.
      </p>
      <label className="lab-rate">
        Rate {rate.toFixed(2)}
        <input type="range" min="0.7" max="1.3" step="0.01" value={rate} onChange={(event) => setRate(Number(event.target.value))} />
      </label>
      <div className="lab-actions">
        <button onClick={() => { cancelSpeech(); setSpeaking(null); }}>Stop</button>
        <button onClick={() => choose(null)} disabled={!preference}>Use automatic</button>
      </div>
    </header>

    {english.length === 0 && <p className="empty">This browser reports no speech voices at all, so Atlas will stay silent in Talk mode. Typing is unaffected.</p>}

    <ol className="lab-list">
      {english.map((voice) => {
        const isAuto = automatic?.voiceURI === voice.voiceURI;
        const isChosen = preference === voice.voiceURI;
        return <li key={voice.voiceURI} className={`lab-voice${isChosen ? ' is-chosen' : ''}`} data-testid={`lab-voice-${voice.voiceURI}`}>
          <div className="lab-voice-head">
            <strong>{voice.name}</strong>
            <span className="lab-tags">
              <em>{voice.lang}</em>
              {voice.localService ? <em>offline</em> : <em>network</em>}
              <em>score {scoreVoice(voice)}</em>
              {isAuto && <em className="is-auto">automatic pick</em>}
            </span>
          </div>
          <div className="lab-samples">
            {SAMPLES.map((sample) => <button
              key={sample.id}
              className={speaking === `${voice.voiceURI}:${sample.id}` ? 'is-speaking' : ''}
              onClick={() => play(voice.voiceURI, sample)}
            >{sample.label}</button>)}
            <button className="lab-choose" onClick={() => choose(voice.voiceURI)} disabled={isChosen}>
              {isChosen ? 'Chosen' : 'Use this voice'}
            </button>
          </div>
        </li>;
      })}
    </ol>
  </div>;
}
