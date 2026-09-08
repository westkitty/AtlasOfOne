import { useEffect, useMemo, useRef, useState } from 'react';
import { eventsFromTurn } from './cartographer/apply';
import { createRemoteProvider, requestFinalAssessment, transcribeAudio } from './cartographer/client';
import { compileContext } from './cartographer/context';
import { compileFinalizeContext, generateLocalAssessment } from './cartographer/finalize';
import { createMockTurn, describeBossStage, describeDoor, doorInsightFrom, encounterTurnRecord, getMockPrompt } from './cartographer/mock';
import { type AIProvider, disabledProvider, playerMessageForFailure } from './cartographer/provider';
import type { CartographerTurn } from './cartographer/schema';
import { activeBossRun, activeDoorRun, availableBosses, availableDoors, bossDefinition, currentBossStage } from './game/encounters';
import { applyGameEvents, campaignReachedEndState, createInitialCampaign, xpIntoCurrentLevel } from './game/engine';
import type { CampaignState, GameEvent, SassLevel, TerritoryStatus } from './game/types';
import { deleteCampaign, loadCampaign, saveCampaign } from './persistence/db';
import { deserializeCampaign, downloadCampaign } from './persistence/transfer';
import { clearAccessSecret, getAccessHeaders, getAccessSecret, setAccessSecret } from './voice/access';
import { isAudioCaptureSupported, startAudioCapture, type ActiveAudioCapture } from './voice/capture';
import { parseVoiceCommand } from './voice/commands';
import { transitionVoiceState, voiceStateLabel } from './voice/state';
import { cancelSpeech, speakText } from './voice/synthesis';
import type { VoiceCommandType, VoiceMode, VoiceState } from './voice/types';

type Screen = 'map'|'talk'|'vault'|'me';
const GREYSON_MAP_SPRITE = '/assets/greyson/map/idle-front.png';

/** Short player-facing words for each fog-of-war state. */
const STATUS_WORD: Record<TerritoryStatus, string> = {
  fogged: 'Fogged', discovered: 'Discovered', exploring: 'Exploring', charted: 'Charted', 'deeply-charted': 'Deeply charted'
};
/** A glyph per state so the map reads without relying on colour alone. */
const STATUS_MARK: Record<TerritoryStatus, string> = {
  fogged: '▓', discovered: '○', exploring: '◔', charted: '◆', 'deeply-charted': '★'
};

/**
 * Whether a campaign is already past first-run onboarding.
 *
 * Three independent signals mean the same thing, and any one of them settles it:
 * the persisted flag, the durable local marker, or the campaign simply having
 * mapped coordinates already. A campaign with turns has demonstrably been used,
 * whatever its flag says — that is what makes a pre-onboarding-era record
 * backward compatible.
 *
 * This exists as one predicate because load-time normalization and the render
 * gate previously carried the rule separately and disagreed: the render gate
 * included `turns.length === 0`, while the load-time chain
 * `saved.onboardingCompleted ?? isCompletedLocally ?? (saved.turns.length > 0)`
 * could never reach its third operand — the first two are booleans after schema
 * normalization, and `false ?? x` is `false`. Players were sent to the right
 * screen but the flag was written back false forever. Proven in
 * `tests/browser/onboarding-continuity.test.ts`.
 */
/**
 * End-of-turn detection thresholds, kept together and named so they can be
 * reasoned about rather than scattered as magic numbers.
 *
 * Onset sits above the silence floor on purpose: the gap is hysteresis, so
 * room tone cannot flicker a turn open and shut. The silence window is long
 * enough to survive an ordinary mid-sentence pause and short enough that the
 * conversation does not feel stalled.
 */
const SPEECH_ONSET_LEVEL = 0.18;
const SILENCE_LEVEL = 0.11;
const SILENCE_HOLD_MS = 1400;
/** Safety bound. Never fabricates an answer — it returns to a listening retry. */
const MAX_LISTEN_MS = 45_000;

/** Short spoken acknowledgement for a local command, so the loop stays audible. */
function voiceCommandAcknowledgement(command: VoiceCommandType): string {
  switch (command) {
    case 'pass': return 'Passed. No penalty.';
    case 'private': return 'Private. I will not intentionally return to that dimension.';
    case 'serious': return 'Serious mode. I will keep this plain.';
    case 'help': return 'You can say pass, private, stop, serious, help, or sass. Say stop any time.';
    case 'sass': return 'Sass adjusted.';
    default: return 'Understood.';
  }
}

const hasCompletedOnboarding = (campaign: { onboardingCompleted?: boolean; turns: unknown[] }, markerSet: boolean) =>
  campaign.onboardingCompleted === true || markerSet || campaign.turns.length > 0;

export default function App() {
  const [state, setState] = useState<CampaignState>(() => createInitialCampaign());
  const [hydrated, setHydrated] = useState(false);
  const [screen, setScreen] = useState<Screen>('map');
  const [reply, setReply] = useState('');
  const [answer, setAnswer] = useState('');
  const [message, setMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  /**
   * Session-level cinematic state. Atlas opens dormant on EVERY launch — new
   * campaign, returning campaign, reload alike — and the interface only appears
   * once the person has deliberately woken it. This never enters CampaignState,
   * awards nothing, and is not persisted: reopening Atlas is a cold open again.
   */
  const [awake, setAwake] = useState(false);
  const [waking, setWaking] = useState(false);
  /** Smoothed 0..1 microphone loudness while capture is live. Never persisted. */
  const [micLevel, setMicLevel] = useState(0);
  const [micMeterLive, setMicMeterLive] = useState(false);
  const unsubscribeLevel = useRef<(() => void) | null>(null);
  /**
   * Talk is a conversation, not a recorder.
   *
   * `voiceState` says what the machinery is doing right now; `conversationActive`
   * says whether Atlas should keep taking turns. A transient operation ending —
   * a synthesis finishing, a transcription returning — never ends the
   * conversation. Only an explicit lifecycle event does: Cancel, STOP, a switch
   * to Type, an import, an unrecoverable failure, or unmount.
   *
   * Both a ref and state: the ref is the lifecycle authority because it mutates
   * synchronously and a stale callback must not be able to reopen a microphone
   * (DEC-029); the state exists so the UI can render.
   */
  const conversationActive = useRef(false);
  const [conversing, setConversing] = useState(false);
  /**
   * Generation token. Every conversation start/stop bumps it, and every async
   * continuation captures the value it began with. A callback from an obsolete
   * cycle compares unequal and does nothing at all.
   */
  const conversationId = useRef(0);
  /** Reply awaiting speech, spoken together with the next prompt by an effect. */
  const [pendingReply, setPendingReply] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine);
  // Async concurrency and request lifecycle guards
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const currentRequestId = useRef(0);
  /**
   * Synchronous mutual exclusion for provider submissions.
   *
   * `isSubmitting` is React state, so it is read from the render closure and does
   * not update until the next render. Two clicks dispatched in the SAME browser
   * task therefore both observe `false` and both start a request — proven against
   * the real button in `tests/browser/concurrency.test.ts`. Deduplicating the
   * response afterwards is not enough: the second request has already been sent,
   * which is duplicate provider work and duplicate neuron spend.
   *
   * A ref mutates synchronously, so it is the only thing here that can actually
   * exclude. `isSubmitting` is kept for presentation.
   */
  const submitInFlight = useRef(false);
  /**
   * Same-task exclusion for encounter submissions.
   *
   * `submitEncounter` is deliberately NOT shaped like `submitViaProvider`. Its
   * deterministic state application is synchronous and its provider enrichment is
   * non-authoritative and fire-and-forget, so a lock held until the enrichment
   * response returned would block the next legitimate Boss stage for no reason.
   *
   * What must be excluded is narrower: a second click dispatched inside the SAME
   * browser task, before React rerenders and before the closure-read
   * `isSubmitting` can possibly be true. Releasing in a `finally` would not do
   * that — the release would run synchronously, still inside the same task, and
   * the second click would sail straight through.
   *
   * So the release is scheduled on the microtask boundary. Microtasks drain after
   * the current task and before any later user event, which is exactly the window
   * that needs covering: the duplicate tap is excluded, and the next real tap —
   * necessarily a separate task — is not.
   */
  const encounterInFlight = useRef(false);
  const pendingCaptureCancelled = useRef(false);
  // Voice state machine & access code state
  const [voiceMode, setVoiceMode] = useState<VoiceMode>('type');
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [activeCapture, setActiveCapture] = useState<ActiveAudioCapture | null>(null);
  const [accessSecretInput, setAccessSecretInput] = useState(() => getAccessSecret() ?? '');

  // Minimal canonical onboarding state
  const [onboardingStep, setOnboardingStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [onboardingSass, setOnboardingSass] = useState<SassLevel>('medium');
  const [onboardingMode, setOnboardingMode] = useState<VoiceMode>('type');

  // The Cartographer runs on its deterministic local script unless the Worker
  // reports a live provider. Nothing here holds a credential or a model id.
  const [provider, setProvider] = useState<AIProvider>(disabledProvider);
  const prompt = useMemo(() => getMockPrompt(state), [state]);
  /**
   * The Final Atlas is an end-state artifact. Deciding availability here keeps
   * it on the engine's deterministic authority rather than on a feeling about
   * how much has been said.
   */
  const campaignEnded = campaignReachedEndState(state);
  const chartedTerritories = state.territories.filter((t) => t.status === 'charted' || t.status === 'deeply-charted').length;
  const dispatch = (...events: GameEvent[]) => setState((current) => applyGameEvents(current, events));

  useEffect(() => {
    let live = true;
    void loadCampaign()
      .then((saved) => {
        if (live && saved) {
          const isCompletedLocally = typeof window !== 'undefined' && window.localStorage?.getItem('atlas_onboarding_completed') === 'true';
          const onboardingCompleted = hasCompletedOnboarding(saved, isCompletedLocally);
          setState({ ...saved, onboardingCompleted });
          if (saved.settings.voiceMode === 'talk') setVoiceMode('talk');
        }
      })
      .catch(() => setMessage('Local save could not be read.'))
      .finally(() => { if (live) setHydrated(true); });
    return () => { live = false; };
  }, []);
  useEffect(() => { if (hydrated) void saveCampaign(state).catch(() => setMessage('Automatic save failed. Export before leaving.')); }, [state, hydrated]);
  useEffect(() => { document.documentElement.dataset.reducedMotion = String(state.settings.reducedMotion); }, [state.settings.reducedMotion]);
  // No live audio context may outlive the component.
  useEffect(() => () => { conversationActive.current = false; conversationId.current += 1; unsubscribeLevel.current?.(); unsubscribeLevel.current = null; }, []);
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setMessage('Back online. Local progress preserved.');
    };
    const handleOffline = () => {
      setIsOffline(true);
      setMessage('Offline — local map and campaign progress preserved.');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  // Reset voice actions on navigation or unmount
  useEffect(() => {
    cancelSpeech();
    if (activeCapture) {
      activeCapture.abort();
      setActiveCapture(null);
    }
    setVoiceState('idle');
  }, [screen]);

  // One probe at startup. A missing or disabled Worker simply leaves the offline
  // script in place; it is never an error the player has to see.
  useEffect(() => {
    let live = true;
    void fetch('/api/health')
      .then((response) => (response.ok ? response.json() : null))
      .then((health) => { if (live && health?.cartographer === 'workers-ai') setProvider(() => createRemoteProvider({ headers: getAccessHeaders })); })
      .catch(() => undefined);
    return () => { live = false; };
  }, []);
  // Toasts are transient status, not a panel: clear them after a few seconds.
  useEffect(() => { if (!message) return; const timer = window.setTimeout(() => setMessage(''), 6000); return () => window.clearTimeout(timer); }, [message]);

  /**
   * Turn a Cartographer proposal into deterministic events. This is the ONLY
   * path from model output into campaign state, and it can emit exactly three
   * event types — none of which carries XP, a level, an unlock or a completion.
   */
  const commitTurn = (turn: CartographerTurn, text: string, providerId: string, turnPrompt = prompt) => {
    setIsSubmitting(false);
    setState((current) => {
      if (current.sessionStatus === 'paused' || current.privateTopics.includes(turnPrompt.dimension)) {
        return current;
      }
      return applyGameEvents(current, eventsFromTurn(turnPrompt, text, turn, providerId));
    });
    setReply(turn.reply); setAnswer('');
    if (voiceMode === 'talk' && conversationActive.current) {
      // The effect below speaks the reply together with whatever Atlas is asking
      // next, so the player never has to read the screen to know their cue.
      setVoiceState('thinking');
      setPendingReply(turn.reply);
    } else if (voiceMode === 'talk') {
      setVoiceState('speaking');
      speakText(turn.reply, {
        quiet: state.presentation === 'quiet',
        onEnd: () => setVoiceState('idle'),
        onError: () => setVoiceState('idle')
      });
    } else {
      setVoiceState('idle');
    }
  };

  /**
   * A provider failure must never cost the player their answer, so the
   * deterministic local turn is committed either way and the degraded state is
   * named in Atlas's own words.
   */
  const submitViaProvider = async (text: string, turnPrompt = prompt) => {
    const reqId = ++currentRequestId.current;
    setIsSubmitting(true);
    try {
      const context = compileContext(state, { territoryId: turnPrompt.territoryId, dimension: turnPrompt.dimension, question: turnPrompt.question }, text);
      const result = await provider.turn(context);
      if (reqId !== currentRequestId.current) return;
      if (result.ok) { commitTurn(result.turn, text, `workers-ai:${result.modelId}`, turnPrompt); return; }
      setMessage(playerMessageForFailure(result.failure.code));
      commitTurn(createMockTurn(state, turnPrompt, text), text, 'mock', turnPrompt);
    } catch {
      if (reqId === currentRequestId.current) {
        commitTurn(createMockTurn(state, turnPrompt, text), text, 'mock', turnPrompt);
      }
    } finally {
      // Released on every path — success, typed failure, throw, or a response
      // that arrived after an import invalidated it — so Atlas is never stranded.
      submitInFlight.current = false;
      if (reqId === currentRequestId.current) {
        setIsSubmitting(false);
      }
    }
  };

  /**
   * The conversational half of a turn: say what happened, establish what is
   * being asked next, then hand the microphone back — with no tap in between.
   *
   * `prompt` is derived from the freshly committed state, so the question spoken
   * here is the real next question. It is only appended when the reply does not
   * already contain it, so Atlas never asks the same thing twice in one breath.
   */
  useEffect(() => {
    if (pendingReply === null) return;
    if (!conversationActive.current || voiceMode !== 'talk') { setPendingReply(null); return; }
    const generation = conversationId.current;
    const question = prompt.question.trim();
    const spoken = pendingReply.includes(question) || !question ? pendingReply : `${pendingReply} ${question}`;
    setPendingReply(null);
    setVoiceState('speaking');
    speakText(spoken, {
      quiet: state.presentation === 'quiet',
      onEnd: () => {
        // A finished utterance does not end a conversation.
        if (conversationActive.current && generation === conversationId.current) void beginListeningTurn(generation);
        else setVoiceState('idle');
      },
      onError: () => {
        if (conversationActive.current && generation === conversationId.current) void beginListeningTurn(generation);
        else setVoiceState('idle');
      }
    });
    // Speech is driven by the reply arriving; re-running on other state would
    // interrupt an utterance mid-sentence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingReply]);

  /**
   * Start a spoken conversation. This is the ONE deliberate action: Atlas states
   * the current question aloud and then listens on its own.
   */
  const startConversation = () => {
    conversationActive.current = true;
    conversationId.current += 1;
    const generation = conversationId.current;
    setConversing(true);
    void generation;
    setPendingReply(prompt.question);
  };

  const submitText = (text: string) => {
    if (!text.trim() || state.sessionStatus === 'paused' || isSubmitting || submitInFlight.current) return;
    if (isOffline || provider.id === 'disabled') { commitTurn(createMockTurn(state, prompt, text), text, 'mock', prompt); return; }
    // Claimed synchronously, before the first await, so a second click in the
    // same task sees it.
    submitInFlight.current = true;
    void submitViaProvider(text, prompt);
  };

  const submit = () => submitText(answer);

  const toggleVoiceMode = (mode: VoiceMode) => {
    if (mode === voiceMode) return;
    // Whichever direction, the current loop stops first and every in-flight
    // continuation is invalidated, so a late transcription or a finishing
    // utterance can never submit or reopen the microphone (BUG-004).
    pendingCaptureCancelled.current = true;
    endConversation();
    stopLevelMeter();
    cancelSpeech();
    if (activeCapture) {
      activeCapture.abort();
      setActiveCapture(null);
    }
    setVoiceState('idle');
    setVoiceMode(mode);
    // Choosing Talk is the single deliberate act that starts the conversation.
    if (mode === 'talk') startConversation();
  };

  /**
   * Open one listening turn.
   *
   * The player finishes by simply stopping talking: the analyser feeding the
   * visualizer also drives end-of-turn detection, so no cloud VAD exists and no
   * audio is transmitted to decide when someone stopped. Silence before speech
   * never submits — Atlas just keeps listening.
   */
  const beginListeningTurn = async (generation = conversationId.current) => {
    if (state.sessionStatus === 'paused' || isSubmitting) return;
    if (generation !== conversationId.current) return;
    cancelSpeech();
    pendingCaptureCancelled.current = false;
    setVoiceState('requesting-permission');
    try {
      const capture = await startAudioCapture();
      if (generation !== conversationId.current) { capture.abort(); return; }
      setActiveCapture(capture);
      stopLevelMeter();

      let speechStarted = false;
      let lastLoudAt = Date.now();
      const openedAt = Date.now();
      let closed = false;
      const closeTurn = () => {
        if (closed || generation !== conversationId.current) return;
        closed = true;
        void stopRecordingAndProcess(capture, generation);
      };

      if (capture.levelMonitoringAvailable) {
        unsubscribeLevel.current = capture.subscribeLevel((level) => {
          setMicLevel(level);
          const now = Date.now();
          if (level >= SPEECH_ONSET_LEVEL) { speechStarted = true; lastLoudAt = now; }
          else if (level >= SILENCE_LEVEL && speechStarted) { lastLoudAt = now; }
          if (speechStarted && now - lastLoudAt >= SILENCE_HOLD_MS) closeTurn();
          // Safety bound: stop the microphone, but never invent an answer.
          else if (!speechStarted && now - openedAt >= MAX_LISTEN_MS) closeTurn();
        });
        setMicMeterLive(true);
      }
      setVoiceState('listening');
    } catch {
      endConversation();
      setVoiceState('error');
      setMessage('Microphone permission denied or recording unsupported. You can type below.');
    }
  };

  /** Manual entry point kept for retry and for the visible recording affordance. */
  const startRecording = async () => {
    conversationActive.current = true;
    conversationId.current += 1;
    setConversing(true);
    await beginListeningTurn(conversationId.current);
  };

  /**
   * Close the current spoken turn and process it.
   *
   * `capture` is passed in rather than read from state so an automatic
   * end-of-turn cannot race a re-render, and `generation` is checked at every
   * await boundary so an obsolete cycle can never submit or resume.
   */
  const stopRecordingAndProcess = async (explicit?: ActiveAudioCapture, generation = conversationId.current) => {
    const capture = explicit ?? activeCapture;
    if (!capture) return;
    setActiveCapture(null);
    stopLevelMeter();
    setVoiceState('transcribing');
    pendingCaptureCancelled.current = false;
    const stale = () => pendingCaptureCancelled.current || generation !== conversationId.current;
    try {
      const blob = await capture.stop();
      if (stale()) { setVoiceState('idle'); return; }
      const res = await transcribeAudio(blob, { headers: getAccessHeaders });
      if (stale()) { setVoiceState('idle'); return; }
      if (!res.ok) {
        // A failure must not strand the conversation in a dead state.
        setVoiceState('error');
        setMessage(res.message);
        return;
      }
      const text = res.text.trim();
      if (!text) {
        // Never fabricate a turn. Keep listening if the conversation is running.
        setMessage('No speech detected. Still listening.');
        if (conversationActive.current && generation === conversationId.current) { void beginListeningTurn(generation); return; }
        setVoiceState('idle');
        return;
      }
      const command = parseVoiceCommand(text);
      if (command) {
        // Local commands never reach the Cartographer and never award progress.
        executeVoiceCommand(command.type);
        if (command.type !== 'stop' && conversationActive.current && generation === conversationId.current) {
          setPendingReply(voiceCommandAcknowledgement(command.type));
          return;
        }
        setVoiceState('idle');
        return;
      }
      setAnswer(text);
      setVoiceState('thinking');
      submitText(text);
    } catch {
      setVoiceState('error');
      setMessage('Audio processing failed. You can type below.');
    }
  };


  /** Stops observing microphone level and clears the meter. Safe to call twice. */
  const stopLevelMeter = () => {
    unsubscribeLevel.current?.();
    unsubscribeLevel.current = null;
    setMicMeterLive(false);
    setMicLevel(0);
  };

  /**
   * Ends the conversational loop. Bumping the generation invalidates every
   * in-flight continuation, so nothing can reopen the microphone afterwards.
   */
  const endConversation = () => {
    conversationActive.current = false;
    conversationId.current += 1;
    setConversing(false);
    setPendingReply(null);
  };

  const cancelVoice = () => {
    endConversation();
    stopLevelMeter();
    pendingCaptureCancelled.current = true;
    if (activeCapture) {
      activeCapture.abort();
      setActiveCapture(null);
    }
    cancelSpeech();
    setVoiceState('idle');
  };

  const executeVoiceCommand = (cmd: VoiceCommandType) => {
    switch (cmd) {
      case 'pass':
        setReply('Passed. No penalty.');
        break;
      case 'private':
        dispatch({ type: 'PRIVATE_TOPIC_ADDED', topic: prompt.dimension });
        setReply('Private. I will not intentionally return to that dimension.');
        break;
      case 'stop':
        // Ends the conversation outright: no automatic reopen after a pause.
        cancelVoice();
        dispatch({ type: 'SESSION_SET', status: 'paused' });
        break;
      case 'serious':
        dispatch({ type: 'PRESENTATION_SET', mode: 'quiet' });
        setReply('Serious mode. Plain language; no fanfare.');
        break;
      case 'help':
        setMessage('PASS skips. PRIVATE closes a topic for good. STOP pauses. SERIOUS drops the fanfare. SASS re-tunes the Cartographer. None of these cost you anything.');
        break;
      case 'sass-low':
        dispatch({ type: 'SASS_SET', sass: 'low' });
        setMessage('Sass set to low.');
        break;
      case 'sass-medium':
        dispatch({ type: 'SASS_SET', sass: 'medium' });
        setMessage('Sass set to medium.');
        break;
      case 'sass-risks':
        dispatch({ type: 'SASS_SET', sass: 'risks-understood' });
        setMessage('Sass set to "I understand the risks".');
        break;
    }
  };

  const bossRun = activeBossRun(state);
  const bossStage = currentBossStage(bossRun);
  const doorRun = activeDoorRun(state);
  const territoryLabels = Object.fromEntries(state.territories.map((item) => [item.id, item.label]));
  const encounter = bossRun && bossStage
    ? { kind: 'boss' as const, heading: bossDefinition(bossRun.bossId)?.label ?? 'Boss Fight', step: `Stage ${bossRun.stages.indexOf(bossStage) + 1} of ${bossRun.stages.length}`, dimension: bossStage.dimensions[0], ...describeBossStage(state, bossStage) }
    : doorRun
      ? { kind: 'door' as const, heading: 'Mystery Door', step: 'One crossing', dimension: doorRun.dimensions[0], ...describeDoor(state, doorRun, territoryLabels) }
      : null;

  /**
   * Inside an encounter the model gets strictly less than its usual authority: it
   * supplies reply wording only, and never any part of the dispatched events.
   */
  const enrichEncounterReply = (text: string, dimension: string, question: string, territoryId: string, kind: 'boss' | 'door') => {
    if (isOffline || provider.id === 'disabled') return;
    const context = compileContext(state, { territoryId, dimension, question }, text, {
      kind: kind === 'boss' ? 'boss-stage' : 'door',
      encounter: { kind, heading: encounter?.heading ?? '', step: encounter?.step ?? '', evidenceClaims: encounter?.evidenceClaims ?? [] }
    });
    void provider.turn(context).then((result) => { if (result.ok) setReply(result.turn.reply); }).catch(() => undefined);
  };

  const submitEncounter = () => {
    if (!encounter || !answer.trim() || state.sessionStatus === 'paused' || isSubmitting || encounterInFlight.current) return;
    encounterInFlight.current = true;
    setIsSubmitting(true);
    try {
      const submitted = answer;
      if (encounter.kind === 'boss' && bossRun) {
        dispatch({ type: 'BOSS_STAGE_ANSWERED', turn: encounterTurnRecord(bossRun.territoryId, encounter.dimension, encounter.question, answer) });
        setReply('Logged. The map does not get to soften that one for you.');
      } else if (doorRun) {
        const wording = describeDoor(state, doorRun, territoryLabels);
        dispatch({ type: 'DOOR_ANSWERED', turn: encounterTurnRecord(doorRun.territoryIds[0], encounter.dimension, wording.question, answer), insight: doorInsightFrom(doorRun, wording) });
        setReply('The crossing is recorded as a hypothesis, not a verdict.');
      }
      setAnswer('');
      enrichEncounterReply(submitted, encounter.dimension, encounter.question, encounter.kind === 'boss' && bossRun ? bossRun.territoryId : (doorRun?.territoryIds[0] ?? state.activeTerritory), encounter.kind);
    } finally {
      // Released at the task boundary, never synchronously here — see the ref's
      // comment. Scheduled from `finally` so a throw cannot strand the encounter.
      queueMicrotask(() => { encounterInFlight.current = false; });
      setIsSubmitting(false);
    }
  };

  const generateAssessment = async () => {
    if (isFinalizing || !campaignEnded) return;
    setIsFinalizing(true);
    setMessage('Synthesizing holistic character assessment...');
    try {
      if (isOffline || provider.id === 'disabled') {
        const local = generateLocalAssessment(state);
        dispatch({ type: 'FINAL_ASSESSMENT_SET', assessment: local });
        setMessage('Final Atlas assessment generated locally.');
        return;
      }
      const context = compileFinalizeContext(state);
      const result = await requestFinalAssessment(context, { headers: getAccessHeaders });
      if (result.ok) {
        dispatch({ type: 'FINAL_ASSESSMENT_SET', assessment: result.assessment });
        setMessage('Final Atlas assessment generated.');
      } else {
        setMessage(`Cloud synthesis unavailable (${result.message}). Generating with local synthesizer.`);
        const local = generateLocalAssessment(state);
        dispatch({ type: 'FINAL_ASSESSMENT_SET', assessment: local });
      }
    } catch {
      const local = generateLocalAssessment(state);
      dispatch({ type: 'FINAL_ASSESSMENT_SET', assessment: local });
      setMessage('Generated via local fallback.');
    } finally {
      setIsFinalizing(false);
    }
  };

  const leaveEncounter = () => { dispatch(encounter?.kind === 'boss' ? { type: 'BOSS_WITHDRAWN' } : { type: 'DOOR_CLOSED' }); setReply('Stepped back. Nothing was lost.'); setAnswer(''); };

  const xp = xpIntoCurrentLevel(state);
  const atMaxLevel = state.level >= 8;
  const xpPercent = Math.max(0, Math.min(100, (xp.current / xp.required) * 100));
  const openBosses = availableBosses(state);
  const openDoors = availableDoors(state);
  const activeTerritory = state.territories.find((item) => item.id === state.activeTerritory) ?? state.territories[0];
  const activeRemaining = activeTerritory.requiredDimensions.length - activeTerritory.coveredDimensions.length;
  const quest = state.quests.find((item) => item.id === state.activeQuest);
  const notices = state.presentation === 'normal' ? state.presentationQueue : [];
  const quiet = state.presentation === 'quiet';

  // Level and XP shown as one unit so progress is legible on Map and Me.
  const renderProgress = () => <div className="xp">
    <div className="xp-head">
      <span>XP {state.xp}</span>
      <b className="level">L{state.level}</b>
      <span className="xp-into">{atMaxLevel ? 'Highest level reached' : `${xp.current} / ${xp.required} to L${state.level + 1}`}</span>
    </div>
    <div className="xp-track"><i style={{ width: `${atMaxLevel ? 100 : xpPercent}%` }} /></div>
  </div>;

  // The six permanent controls. They are rendered identically for ordinary
  // encounters, Boss Fights and Mystery Doors, and never depend on progression.
  // PRIVATE / STOP / SERIOUS carry a steadier "protective" style; PASS / HELP /
  // SASS are quieter utilities. All stay >=44px and always visible.
  const renderAgency = (onPass: () => void, privateDimension: string) => <div className="agency" data-testid="agency" role="group" aria-label="Always-available controls">
    <button className="agency-util" data-testid="agency-pass" onClick={onPass}>PASS</button>
    <button className="agency-protect" data-testid="agency-private" onClick={()=>{dispatch({type:'PRIVATE_TOPIC_ADDED',topic:privateDimension});setReply('Private. I will not intentionally return to that dimension.');}}>PRIVATE</button>
    <button className={`agency-protect${state.sessionStatus==='paused'?' is-active':''}`} data-testid="agency-stop" aria-pressed={state.sessionStatus==='paused'} onClick={()=>{const pausing=state.sessionStatus!=='paused';if(pausing)cancelVoice();dispatch({type:'SESSION_SET',status:pausing?'paused':'active'});}}>{state.sessionStatus==='paused'?'RESUME':'STOP'}</button>
    <button className={`agency-protect${quiet?' is-active':''}`} data-testid="agency-serious" aria-pressed={quiet} onClick={()=>{dispatch({type:'PRESENTATION_SET',mode:'quiet'});setReply('Serious mode. Plain language; no fanfare.');}}>SERIOUS</button>
    <button className="agency-util" data-testid="agency-help" onClick={()=>setMessage('PASS skips. PRIVATE closes a topic for good. STOP pauses. SERIOUS drops the fanfare. SASS re-tunes the Cartographer. None of these cost you anything.')}>HELP</button>
    <button className="agency-util" data-testid="agency-sass" onClick={()=>dispatch({type:'SASS_SET',sass:state.settings.sass==='low'?'medium':state.settings.sass==='medium'?'risks-understood':'low'})}>SASS</button>
  </div>;

  const renderEncounter = () => encounter && <section className="screen encounter-screen" data-testid={`encounter-${encounter.kind}`}>
    <div className="eyebrow">{encounter.kind==='boss'?'BOSS FIGHT':'MYSTERY DOOR'}</div>
    <header>
      <div>
        <h1 className="screen-title">{encounter.kind==='door' ? encounter.title : encounter.heading}</h1>
        <p>{encounter.step}{encounter.kind==='boss' ? ' · your own mapped positions, put under load' : ' · optional to open, safe to close'}</p>
      </div>
      {quiet && <span className="chip">{state.presentation}</span>}
      {isOffline && <span className="chip offline" data-testid="offline-indicator">Offline</span>}
    </header>
    {encounter.kind==='boss' && bossRun && <ol className="stage-track" aria-label={`Boss Fight progress: ${encounter.step}`}>
      {bossRun.stages.map((stage, index) => {
        const current = bossRun.stages.indexOf(bossStage!) === index;
        const cleared = stage.outcome !== 'pending';
        return <li key={stage.id} className={cleared?'done':current?'now':'next'} aria-current={current?'step':undefined}><span aria-hidden="true">{cleared?'✓':index+1}</span></li>;
      })}
    </ol>}
    {encounter.kind==='door' && doorRun && <div className="crossing" aria-hidden="true">
      <span>{territoryLabels[doorRun.territoryIds[0]] ?? doorRun.territoryIds[0]}</span><i>⟷</i><span>{territoryLabels[doorRun.territoryIds[1]] ?? doorRun.territoryIds[1]}</span>
    </div>}
    <article className={`card encounter ${encounter.kind}`}>
      {reply && <p className="reply" role="status">{reply}</p>}
      <h2>{encounter.question}</h2>
      {encounter.evidenceClaims.length>0 && <><p className="evidence-caption">From evidence you already mapped</p><ul className="evidence-list">{encounter.evidenceClaims.map((claim,index)=><li key={index}>{claim}</li>)}</ul></>}
      <small>Dimension: {encounter.dimension}</small>
    </article>
    {state.sessionStatus==='paused' && <div className="quiet">Session paused. Your Atlas is safe.</div>}
    <label className="answer">Your position<textarea rows={4} value={answer} onChange={(e)=>setAnswer(e.target.value)} disabled={state.sessionStatus==='paused'} data-testid="encounter-input" /></label>
    <button className="primary full" data-testid="encounter-submit" onClick={submitEncounter} disabled={!answer.trim()||state.sessionStatus==='paused'}>{encounter.kind==='boss'?'Hold this position':'Walk through'}</button>
    <button className="full leave" data-testid="encounter-leave" onClick={leaveEncounter}>{encounter.kind==='boss'?'Step back for now':'Close the door for now'}</button>
    <p className="safe-note">PASS clears {encounter.kind==='boss'?'a stage':'this crossing'} at no cost. Stepping back keeps every point you have earned.</p>
    {renderAgency(()=>{dispatch(encounter.kind==='boss'?{type:'BOSS_STAGE_PASSED'}:{type:'DOOR_CLOSED'});setReply('Passed. No penalty, no cost.');setAnswer('');}, encounter.dimension)}
  </section>;

  const renderMap = () => <section className="screen">
    <div className="eyebrow">THE GREYSON MAP</div>
    <header><div><h1>Atlas of One</h1><p>One person. More territory than a questionnaire can survive.</p></div>{isOffline && <span className="chip offline" data-testid="offline-indicator">Offline</span>}</header>
    {renderProgress()}
    <article className="quest-card">
      <b aria-hidden="true">◆</b>
      <div>
        <span className="eyebrow">CURRENT QUEST</span>
        <strong>{quest?.label ?? 'Every territory charted'}</strong>
        {quest
          ? <><small>{quest.description}</small><div className="quest-track"><i style={{width:`${Math.min(100,(quest.progress/quest.target)*100)}%`}} /></div><small className="quest-count">{quest.progress} / {quest.target}</small></>
          : <small>Nothing outstanding. Open an encounter, or keep mapping.</small>}
      </div>
    </article>
    <div className="map">
      <div className="map-here">
        <div className="avatar"><img src={GREYSON_MAP_SPRITE} alt="Greyson map avatar" draggable={false}/></div>
        <div><span className="eyebrow">YOU ARE HERE</span><strong>{activeTerritory.label}</strong><small>{STATUS_WORD[activeTerritory.status]}</small></div>
      </div>
      <div className="territory-grid">
        {state.territories.map((territory) => <button key={territory.id} className={`territory t-${territory.status}${territory.id===state.activeTerritory?' active':''}`} aria-current={territory.id===state.activeTerritory?'true':undefined} onClick={() => dispatch({type:'ACTIVE_TERRITORY_SET',territoryId:territory.id})}>
          <span className="t-mark" aria-hidden="true">{STATUS_MARK[territory.status]}</span>
          <strong>{territory.label}</strong>
          <small>{STATUS_WORD[territory.status]} · {territory.coveredDimensions.length}/{territory.requiredDimensions.length}</small>
        </button>)}
      </div>
    </div>
    <article className="card current-territory">
      <span className="eyebrow">CURRENT TERRITORY</span>
      <h2>{activeTerritory.label}</h2>
      <p>{activeTerritory.coveredDimensions.length} of {activeTerritory.requiredDimensions.length} dimensions mapped{activeRemaining>0?` · ${activeRemaining} to go`:' · fully charted'}.</p>
      <button className="primary" onClick={() => setScreen('talk')}>{activeTerritory.coveredDimensions.length===0?'Start mapping':'Continue encounter'}</button>
    </article>
    {(openBosses.length>0||openDoors.length>0||encounter)&&<article className="card encounters" data-testid="encounter-offers">
      <span className="eyebrow">OPEN ENCOUNTERS</span>
      <p>Earned from territory you have already mapped. All optional.</p>
      {encounter&&<button className="primary full" data-testid="resume-encounter" onClick={()=>setScreen('talk')}>Resume {encounter.kind==='door'?encounter.title:encounter.heading}</button>}
      {!encounter&&openBosses.map((boss)=>{const run=state.bossRuns.find((item)=>item.bossId===boss.id&&item.status==='active');const done=run?run.stages.filter((stage)=>stage.outcome!=='pending').length:0;return <button key={boss.id} className="offer boss" data-testid={`start-${boss.id}`} onClick={()=>{dispatch({type:'BOSS_STARTED',bossId:boss.id});setReply('');setScreen('talk');}}><span className="offer-tag" aria-hidden="true">▲ BOSS</span><strong>{run?'Resume: ':''}{boss.label}</strong><small>{run?`Stage ${done+1} of ${run.stages.length} · progress kept`:boss.description}</small></button>;})}
      {!encounter&&openDoors.slice(0,3).map((door)=><button key={door.doorId} className="offer door" data-testid={`open-${door.doorId}`} onClick={()=>{dispatch({type:'DOOR_OPENED',doorId:door.doorId});setReply('');setScreen('talk');}}><span className="offer-tag" aria-hidden="true">◈ DOOR</span><strong>{territoryLabels[door.territoryIds[0]]} × {territoryLabels[door.territoryIds[1]]}</strong><small>What connects these two regions that neither shows alone.</small></button>)}
    </article>}
  </section>;

  const renderTalk = () => encounter ? renderEncounter() : <section className="screen">
    <div className="eyebrow">ENCOUNTER · {activeTerritory.label.toUpperCase()}</div>
    <header><div><h1 className="screen-title">The Cartographer</h1><p>Mapping {activeTerritory.label.toLowerCase()} with you, one coordinate at a time.</p></div>{quiet && <span className="chip">{state.presentation}</span>}{isOffline && <span className="chip offline" data-testid="offline-indicator">Offline</span>}</header>
    <article className="card prompt">{reply && <p className="reply" role="status">{reply}</p>}<h2>{prompt.question}</h2><small>Evidence dimension: {prompt.dimension}</small></article>
    {state.sessionStatus==='paused' && <div className="quiet">Session paused. Your Atlas is safe.</div>}

    <div className="mode-switch" role="tablist" aria-label="Input mode">
      <button role="tab" aria-selected={voiceMode==='type'} className={voiceMode==='type'?'active':''} data-testid="mode-type" onClick={()=>toggleVoiceMode('type')}>Type</button>
      <button role="tab" aria-selected={voiceMode==='talk'} className={voiceMode==='talk'?'active':''} data-testid="mode-talk" onClick={()=>toggleVoiceMode('talk')}>Talk</button>
    </div>

    {voiceMode==='type' ? (
      <>
        <label className="answer">Your coordinate<textarea rows={4} value={answer} onChange={(e)=>setAnswer(e.target.value)} disabled={state.sessionStatus==='paused'} data-testid="answer-input" /></label>
        <button className="primary full" onClick={submit} disabled={!answer.trim()||state.sessionStatus==='paused'||isSubmitting}>{isSubmitting ? 'Mapping coordinate...' : 'Map this answer'}</button>
      </>
    ) : (
      <div className="voice-card" data-testid="voice-card">
        <span className={`voice-badge ${voiceState}`} data-testid="voice-status">{voiceStateLabel(voiceState)}</span>
        {voiceState === 'idle' && (
          <button className="mic-btn" data-testid="mic-button" aria-label="Start the conversation" onClick={startConversation} disabled={state.sessionStatus==='paused'}>
            🎙
          </button>
        )}
        {voiceState === 'listening' && (
          <>
            {/* Live recording feedback. Present whenever capture is live, so
                silence still reads as "the microphone is on"; the bars grow with
                measured amplitude when there is something to hear. */}
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
            <button className="mic-btn is-listening" data-testid="mic-stop" aria-label="Done speaking" onClick={() => void stopRecordingAndProcess()}>
              ◼
            </button>
            <div className="voice-actions">
              <button className="primary" data-testid="voice-submit-done" onClick={() => void stopRecordingAndProcess()}>Done speaking</button>
              <button data-testid="voice-cancel" onClick={cancelVoice}>Cancel</button>
            </div>
          </>
        )}
        {voiceState === 'requesting-permission' && (
          <div className="voice-actions">
            <button data-testid="voice-cancel" onClick={cancelVoice}>Cancel</button>
          </div>
        )}
        {(voiceState === 'transcribing' || voiceState === 'thinking') && (
          <div className="voice-actions">
            <button data-testid="voice-cancel" onClick={cancelVoice}>Cancel</button>
          </div>
        )}
        {voiceState === 'speaking' && (
          <div className="voice-actions">
            {/* Barge-in: the player takes the floor without waiting for the
                Cartographer to finish, and the conversation stays alive. This
                used to cancel the whole voice session, which is not what
                interrupting someone means. */}
            <button
              data-testid="voice-interrupt"
              onClick={() => { cancelSpeech(); if (conversationActive.current) void beginListeningTurn(conversationId.current); else cancelVoice(); }}
            >
              Interrupt
            </button>
            <button data-testid="voice-cancel-speaking" onClick={cancelVoice}>Cancel</button>
          </div>
        )}
        {voiceState === 'error' && (
          <div className="voice-actions">
            <button className="primary" data-testid="voice-retry" onClick={startRecording}>Try again</button>
            <button data-testid="voice-fallback-type" onClick={()=>toggleVoiceMode('type')}>Switch to typing</button>
          </div>
        )}
      </div>
    )}

    {renderAgency(()=>setReply('Passed. No penalty.'), prompt.dimension)}
  </section>;

  const fragmentCount = state.territories.filter((t)=>state.mapFragments.some((f)=>f.territoryId===t.id)).length;
  const unlockedAchievements = state.achievements.filter((a)=>a.unlockedAt);
  const pendingInsights = state.insights.filter((i)=>i.status==='pending');
  /**
   * Substantive answers, newest first, so a player can find and take back
   * something they said. Retracted answers stay listed and labelled: the
   * Product Specification requires that retraction invalidate derived evidence
   * while history remains visible, so this hides nothing.
   */
  const recordedAnswers = state.turns.filter((turn) => turn.substantive).slice().reverse();

  const renderVault = () => <section className="screen">
    <div className="eyebrow">LOCAL EVIDENCE VAULT</div>
    <h1>Vault</h1>
    <p>Evidence, fragments, contradictions, and things the map is not allowed to pretend it knows.</p>

    <section className="vault-section">
      <h2>Insight Cards <span className="count">{state.insights.length}</span></h2>
      {state.insights.length===0
        ? <div className="empty">No insight cards yet. They arrive as hypotheses once the map has something to guess with.</div>
        : <>
          {pendingInsights.length>0 && <p className="section-note">{pendingInsights.length} waiting on your call.</p>}
          {state.insights.slice().reverse().map((insight)=><article className={`card insight${insight.status==='pending'?' is-pending':''}`} key={insight.id}>
            <span className="eyebrow">{insight.confidence.toUpperCase()} · {insight.status}</span>
            <h3>{insight.title}</h3>
            <p>{insight.summary}</p>
            {insight.status==='pending'&&<div className="row"><button className="ok" onClick={()=>dispatch({type:'INSIGHT_CONFIRMED',insightId:insight.id})}>Accurate</button><button onClick={()=>dispatch({type:'INSIGHT_REJECTED',insightId:insight.id})}>Not me</button></div>}
          </article>)}
        </>}
    </section>

    <section className="vault-section">
      <h2>Fragments <span className="count">{fragmentCount} / {state.territories.length}</span></h2>
      <div className="fragment-grid">{state.territories.map((t)=>{const has=state.mapFragments.some((f)=>f.territoryId===t.id);return <div key={t.id} className={has?'has':'missing'}><b aria-hidden="true">{has?'◆':'◇'}</b><small>{t.label}</small><small className="frag-state">{has?'Charted':'Not yet'}</small></div>;})}</div>
    </section>

    {state.contradictions.length>0 && <section className="vault-section">
      <h2>Contradictions <span className="count">{state.contradictions.length}</span></h2>
      {state.contradictions.map((c)=><article className="card" key={c.id}><h3>{c.claim}</h3><small>{c.status}</small></article>)}
    </section>}

    <section className="vault-section">
      <h2>Recorded answers <span className="count">{recordedAnswers.length}</span></h2>
      {recordedAnswers.length===0
        ? <div className="empty">Nothing recorded yet. Answers show up here once you have mapped a coordinate.</div>
        : <>
          <p className="section-note">Taking an answer back keeps it in your history and retires the evidence drawn from it. Nothing is deleted and no progress is punished.</p>
          {recordedAnswers.map((turn)=><article className="card" key={turn.id} data-testid={`answer-${turn.id}`}>
            <span className="eyebrow">{turn.dimension.toUpperCase()}{turn.retracted?' · TAKEN BACK':''}</span>
            <h3>{turn.question}</h3>
            <p>{turn.answer.length>180?`${turn.answer.slice(0,180)}…`:turn.answer}</p>
            {turn.retracted
              ? <small>Taken back. Kept in history; its evidence is retired.</small>
              : <button data-testid={`retract-${turn.id}`} onClick={()=>{dispatch({type:'ANSWER_RETRACTED',turnId:turn.id});setMessage('Answer taken back. The evidence drawn from it is retired.');}}>Take this back</button>}
          </article>)}
        </>}
    </section>

    <section className="vault-section">
      <h2>Achievements <span className="count">{unlockedAchievements.length} / {state.achievements.length}</span></h2>
      {unlockedAchievements.length===0
        ? <div className="empty">Nothing unlocked yet. Keep mapping.</div>
        : unlockedAchievements.map((a)=><article className="quest-card compact" key={a.id}><b aria-hidden="true">✦</b><div><strong>{a.label}</strong><small>{a.description}</small></div></article>)}
    </section>
  </section>;

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      currentRequestId.current++;
      pendingCaptureCancelled.current = true;
      cancelSpeech();
      if (activeCapture) {
        activeCapture.abort();
        setActiveCapture(null);
      }
      setVoiceState('idle');
      endConversation();
      stopLevelMeter();
      submitInFlight.current = false;
      setIsSubmitting(false);
      setState(deserializeCampaign(await file.text()));
      setMessage('Atlas imported and validated.');
      setScreen('map');
    } catch (error) {
      setMessage(error instanceof Error ? `Import rejected: ${error.message}` : 'Import rejected.');
    }
  };

  const renderMe = () => <section className="screen">
    <div className="eyebrow">CHARACTER RECORD</div>
    <div className="profile"><div className="portrait"><img src={GREYSON_MAP_SPRITE} alt="Greyson character avatar" draggable={false}/></div><div><h1>Greyson</h1><p>{state.player.pronouns}</p></div></div>
    {renderProgress()}
    <div className="stats">
      <div><b>{state.evidence.filter((e)=>e.status==='active').length}</b><small>Evidence</small></div>
      <div><b>{state.insights.filter((i)=>i.status==='confirmed').length}</b><small>Confirmed insights</small></div>
      <div><b>{state.mapFragments.length}</b><small>Fragments</small></div>
      <div><b>{state.unlocks.filter((u)=>u.unlockedAt).length}</b><small>Unlocks</small></div>
    </div>

    <article className="card assessment-section" data-testid="final-assessment-section">
      <div className="assessment-head">
        <div>
          <h2>Final Atlas Assessment</h2>
          <p className="settings-note">Holistic synthesis of mapped coordinates, values, contradictions, and open questions.</p>
        </div>
        <div className="assessment-actions no-print">
          {campaignEnded && (
            <button className="primary" data-testid="synthesize-assessment-btn" onClick={generateAssessment} disabled={isFinalizing}>
              {isFinalizing ? 'Synthesizing...' : state.finalAssessment ? 'Re-synthesize Atlas' : 'Synthesize Final Atlas'}
            </button>
          )}
          {state.finalAssessment && (
            <button className="print-btn" data-testid="print-assessment-btn" onClick={() => window.print()}>
              Print / Save as PDF
            </button>
          )}
        </div>
      </div>

      {!campaignEnded && (
        <div className="empty" data-testid="assessment-locked">
          The final Atlas is written once the map is finished. {chartedTerritories} of {state.territories.length} territories are charted so far — keep mapping, and it will be waiting.
        </div>
      )}

      {state.finalAssessment && (
        <div className="assessment-body" data-testid="assessment-content">
          <div className="assessment-meta">
            <span className="chip">Generated {new Date(state.finalAssessment.generatedAt).toLocaleDateString()}</span>
            <span className="chip">Provider: {state.finalAssessment.provider}</span>
          </div>

          <blockquote className="who-is-greyson" data-testid="who-is-greyson">
            <h3>Who is Greyson?</h3>
            <p>{state.finalAssessment.whoIsGreyson}</p>
          </blockquote>

          <div className="domain-grid">
            {[
              state.finalAssessment.temperament,
              state.finalAssessment.valuesAndMorals,
              state.finalAssessment.politicalAndIdeology,
              state.finalAssessment.relationshipsAndSocial,
              state.finalAssessment.cognitiveStyle,
              state.finalAssessment.interestsAndPreferences,
              state.finalAssessment.fearsAndHopes,
              state.finalAssessment.idealFutureAndAmbition
            ].map((domain) => (
              <div key={domain.title} className="domain-card">
                <h4>{domain.title}</h4>
                <p className="domain-summary">{domain.summary}</p>
                <div className="epistemic-group">
                  <strong className="epistemic-label evidence-label">Established Evidence</strong>
                  <ul className="claim-list">
                    {domain.establishedEvidence.map((ev, idx) => <li key={idx}>{ev}</li>)}
                  </ul>
                </div>
                <div className="epistemic-group">
                  <strong className="epistemic-label inference-label">Supported Inferences</strong>
                  <ul className="hypothesis-list">
                    {domain.supportedInferences.map((inf, idx) => (
                      <li key={idx}>
                        <span>{inf.hypothesis}</span>
                        <small className={`conf-badge ${inf.confidence}`}>{inf.confidence}</small>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="epistemic-group">
                  <strong className="epistemic-label uncertainty-label">Open Uncertainty</strong>
                  <ul className="uncertainty-list">
                    {domain.openQuestionsAndUncertainty.map((uq, idx) => <li key={idx}>{uq}</li>)}
                  </ul>
                </div>
              </div>
            ))}
          </div>

          {state.finalAssessment.contradictionsAndTensions.length > 0 && (
            <div className="assessment-subblock">
              <h3>Contradictions & Tensions</h3>
              <div className="tensions-list">
                {state.finalAssessment.contradictionsAndTensions.map((t, idx) => (
                  <div key={idx} className="tension-card">
                    <b>{t.tension}</b>
                    <small>Status: {t.status}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.finalAssessment.frameworkEstimates.length > 0 && (
            <div className="assessment-subblock">
              <h3>Personality Framework Estimates</h3>
              <div className="framework-list">
                {state.finalAssessment.frameworkEstimates.map((f, idx) => (
                  <div key={idx} className="framework-card">
                    <strong>{f.framework}</strong>
                    <p>{f.estimate}</p>
                    <small className="framework-caveat">{f.caveat}</small>
                  </div>
                ))}
              </div>
            </div>
          )}

          {state.finalAssessment.representativeQuotes.length > 0 && (
            <div className="assessment-subblock">
              <h3>Representative Words</h3>
              <ul className="quotes-list">
                {state.finalAssessment.representativeQuotes.map((q, idx) => <li key={idx}>{q}</li>)}
              </ul>
            </div>
          )}

          {state.finalAssessment.openQuestions.length > 0 && (
            <div className="assessment-subblock">
              <h3>Open Horizon Questions</h3>
              <ul className="open-questions-list">
                {state.finalAssessment.openQuestions.map((oq, idx) => <li key={idx}>{oq}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>

    <article className="card settings"><h2>Cartographer</h2><label>Sass<select value={state.settings.sass} onChange={(e)=>dispatch({type:'SASS_SET',sass:e.target.value as SassLevel})}><option value="low">Low</option><option value="medium">Medium</option><option value="risks-understood">I Understand the Risks</option></select></label><label>Reduced motion<input type="checkbox" checked={state.settings.reducedMotion} onChange={(e)=>setState((s)=>({...s,settings:{...s.settings,reducedMotion:e.target.checked}}))}/></label></article>
    <article className="card settings"><h2>Your Atlas</h2><p className="settings-note">Everything lives on this device. Export a copy before you switch phones or clear data.</p><button onClick={()=>downloadCampaign(state)}>Export Atlas</button><label className="file">Import Atlas<input type="file" accept="application/json,.json,.atlas" onChange={(e)=>void importFile(e.target.files?.[0])}/></label></article>
    <article className="card settings access-section">
      <h2>Cartographer Access Code</h2>
      <p className="settings-note">Worker secret protecting cloud inference. Stored locally on this device only.</p>
      <div className="access-row">
        <input
          type="password"
          placeholder="Access secret..."
          value={accessSecretInput}
          onChange={(e)=>setAccessSecretInput(e.target.value)}
          aria-label="Cartographer access secret"
          data-testid="access-secret-input"
        />
        <button className="primary" data-testid="save-access-secret" onClick={()=>{
          setAccessSecret(accessSecretInput);
          setMessage('Access code saved.');
        }}>Save</button>
        {accessSecretInput && <button data-testid="clear-access-secret" onClick={()=>{
          clearAccessSecret();
          setAccessSecretInput('');
          setMessage('Access code cleared.');
        }}>Clear</button>}
      </div>
    </article>
    <article className="card danger-zone">
      <h2>Danger zone</h2>
      <p className="settings-note">Deleting wipes this device's Atlas for good. Export first if you want to keep it.</p>
      {confirmDelete
        ? <div className="row"><button className="danger" onClick={()=>void deleteCampaign().then(()=>{setState(createInitialCampaign());setConfirmDelete(false);setOnboardingStep(1);})}>Delete everything</button><button onClick={()=>setConfirmDelete(false)}>Keep it</button></div>
        : <button className="danger" onClick={()=>setConfirmDelete(true)}>Delete local Atlas</button>}
    </article>
    <article className="empty reveal"><span className="eyebrow">LEVEL 8 REVEAL</span><h2>Detailed character turnaround</h2><p>{atMaxLevel ? 'You have reached the level that unlocks it. The full canonical turnaround lands in a later pass.' : 'The canonical Greyson turnaround is reserved for the Level 8 reveal.'}</p></article>
  </section>;

  const handleOnboardingStart = () => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('atlas_onboarding_completed', 'true');
      }
    } catch {
      // Ignore localStorage errors
    }
    dispatch({
      type: 'ONBOARDING_COMPLETED',
      sass: onboardingSass,
      voiceMode: onboardingMode === 'talk' ? 'talk' : 'text'
    });
    setVoiceMode(onboardingMode);
    setScreen('map');
  };

  const renderOnboarding = () => (
    <section className="onboarding-screen">
      {onboardingStep === 2 && (
        <article className="card onboarding-card" data-testid="onboarding-step-2">
          <span className="eyebrow">STEP 1 OF 3</span>
          <h2>Cartographer Sass</h2>
          <p className="onboarding-desc">
            Choose how direct or sharp the Cartographer should be. You can adjust this anytime in settings.
          </p>
          <div className="onboarding-choices">
            <button
              type="button"
              className={`onboarding-choice ${onboardingSass === 'low' ? 'active' : ''}`}
              data-testid="onboarding-sass-low"
              aria-pressed={onboardingSass === 'low'}
              onClick={() => setOnboardingSass('low')}
            >
              <strong>Low</strong>
              <span>Gentle and measured guidance.</span>
            </button>
            <button
              type="button"
              className={`onboarding-choice ${onboardingSass === 'medium' ? 'active' : ''}`}
              data-testid="onboarding-sass-medium"
              aria-pressed={onboardingSass === 'medium'}
              onClick={() => setOnboardingSass('medium')}
            >
              <strong>Medium</strong>
              <span>Balanced with a light playful edge.</span>
            </button>
            <button
              type="button"
              className={`onboarding-choice ${onboardingSass === 'risks-understood' ? 'active' : ''}`}
              data-testid="onboarding-sass-risks"
              aria-pressed={onboardingSass === 'risks-understood'}
              onClick={() => setOnboardingSass('risks-understood')}
            >
              <strong>I Understand the Risks</strong>
              <span>Full unfiltered candor and challenge.</span>
            </button>
          </div>
          <div className="onboarding-actions">
            <button
              className="primary"
              data-testid="onboarding-next-sass"
              onClick={() => setOnboardingStep(3)}
            >
              Next
            </button>
          </div>
        </article>
      )}

      {onboardingStep === 3 && (
        <article className="card onboarding-card" data-testid="onboarding-step-3">
          <span className="eyebrow">STEP 2 OF 3</span>
          <h2>Interaction Mode</h2>
          <p className="onboarding-desc">
            Choose how you would like to explore. You can switch freely between voice and typing anytime on the Talk screen.
          </p>
          <div className="onboarding-choices">
            <button
              type="button"
              className={`onboarding-choice ${onboardingMode === 'talk' ? 'active' : ''}`}
              data-testid="onboarding-mode-talk"
              aria-pressed={onboardingMode === 'talk'}
              onClick={() => setOnboardingMode('talk')}
            >
              <strong>Talk</strong>
              <span>Spoken conversation via microphone and speech synthesis.</span>
            </button>
            <button
              type="button"
              className={`onboarding-choice ${onboardingMode === 'type' ? 'active' : ''}`}
              data-testid="onboarding-mode-type"
              aria-pressed={onboardingMode === 'type'}
              onClick={() => setOnboardingMode('type')}
            >
              <strong>Type</strong>
              <span>Written conversation via standard keyboard input.</span>
            </button>
          </div>
          <div className="onboarding-actions">
            <button
              className="primary"
              data-testid="onboarding-next-mode"
              onClick={() => setOnboardingStep(4)}
            >
              Next
            </button>
          </div>
        </article>
      )}

      {onboardingStep === 4 && (
        <article className="card onboarding-card" data-testid="onboarding-step-4">
          <span className="eyebrow">STEP 3 OF 3</span>
          <h2>Permanent Controls</h2>
          <p className="onboarding-desc">
            You are always in control. These commands are permanently available at every step and never cost XP or progress:
          </p>
          <ul className="onboarding-agency-list">
            <li>
              <strong>Pass</strong>
              <span>Skip any question without penalty or forced explanation.</span>
            </li>
            <li>
              <strong>Private</strong>
              <span>Mark the topic private. It is never revisited and never leaves your device.</span>
            </li>
            <li>
              <strong>Stop</strong>
              <span>Pause the session immediately. Nothing advances until you resume.</span>
            </li>
            <li>
              <strong>Serious</strong>
              <span>Enter quiet, respectful mode. Celebratory effects are instantly suppressed.</span>
            </li>
          </ul>
          <p className="onboarding-subnote">
            Help and Sass adjustments are also always available in the action bar.
          </p>
          <div className="onboarding-actions">
            <button
              className="primary"
              data-testid="onboarding-next-agency"
              onClick={() => setOnboardingStep(5)}
            >
              Next
            </button>
          </div>
        </article>
      )}

      {onboardingStep === 5 && (
        <article className="card onboarding-card" data-testid="onboarding-step-5">
          <span className="eyebrow">EXPEDITION READY</span>
          <h2>Start Your Expedition</h2>
          <p className="onboarding-desc">
            Your map begins in the territory of Identity. Take your time, explore at your own pace, and chart what feels true.
          </p>
          <div className="onboarding-actions">
            <button
              className="primary"
              data-testid="onboarding-start"
              onClick={handleOnboardingStart}
            >
              Start
            </button>
          </div>
        </article>
      )}
    </section>
  );

  const isCompletedLocally = typeof window !== 'undefined' && window.localStorage?.getItem('atlas_onboarding_completed') === 'true';
  const showOnboarding = hydrated && !hasCompletedOnboarding(state, isCompletedLocally);

  /**
   * Wake Atlas. This IS the canonical "Begin" step, so a first-run campaign
   * moves straight to the sass choice rather than being asked to begin twice.
   */
  const wake = () => {
    if (awake) return;
    setOnboardingStep((step) => (step === 1 ? 2 : step));
    setWaking(true);
    setAwake(true);
    window.setTimeout(() => setWaking(false), 400);
  };

  /**
   * The cold open owns first paint and holds until hydration has settled, so
   * the interface is never briefly painted and then replaced. The application
   * tree is not rendered at all underneath — there is nothing to focus, tab to
   * or click through.
   */
  if (!awake || !hydrated) {
    return <div className="shell cold-open">
      <div className="cold-open-scene">
        <span className="cold-open-mark" aria-hidden="true" />
        <h1 className="cold-open-title">Atlas of One</h1>
        <p className="cold-open-sub">The Greyson Map</p>
        <p className="cold-open-hint">Touch anywhere to begin</p>
      </div>
      {/* The whole viewport is the activation surface, so nothing reads as a
          conventional button while still being a real, focusable, named one. */}
      <button
        type="button"
        className="cold-open-surface"
        data-testid="cold-open"
        aria-label="Wake Atlas of One and begin"
        onClick={wake}
      />
    </div>;
  }

  return <div className={`shell${waking ? ' is-waking' : ''}`}>
    {message&&<div className="toast" role="status">{message}<button aria-label="Dismiss" onClick={()=>setMessage('')}>×</button></div>}
    {showOnboarding ? (
      renderOnboarding()
    ) : (
      <>
        {notices.length>0&&<div className="overlay"><article className="unlock"><span className="eyebrow">MAP UPDATED</span><h2>{notices[0].title}</h2><p>{notices[0].detail}</p><button className="primary" onClick={()=>dispatch({type:'PRESENTATION_QUEUE_CLEARED'})}>Continue</button></article></div>}
        {screen==='map'?renderMap():screen==='talk'?renderTalk():screen==='vault'?renderVault():renderMe()}
        <nav aria-label="Main">{(['map','talk','vault','me'] as Screen[]).map((item)=><button key={item} className={screen===item?'active':''} aria-current={screen===item?'page':undefined} onClick={()=>setScreen(item)}><span aria-hidden="true">{item==='map'?'⌖':item==='talk'?'◉':item==='vault'?'▤':'☗'}</span><small>{item==='me'?'Me':item[0].toUpperCase()+item.slice(1)}</small></button>)}</nav>
      </>
    )}
  </div>;
}
