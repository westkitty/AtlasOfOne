import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, openAgency } from './helper';
import { serveDist } from './server';

/**
 * Talk mode is a continuous turn-taking conversation, not voice form entry.
 *
 * The canonical loop is LISTENING -> TRANSCRIBING -> THINKING -> SPEAKING ->
 * LISTENING. The central regression here is that a second spoken turn happens
 * with NO microphone interaction between turns: if that ever needs a tap again,
 * Atlas has regressed to dictation.
 *
 * Everything drives the real production bundle and the real App path. The only
 * fakes are the browser primitives Atlas cannot get in headless Chrome —
 * `getUserMedia`, `MediaRecorder`, `AudioContext`/`AnalyserNode` and
 * `speechSynthesis` — plus the same-origin `/api/*` boundary. Amplitude is
 * driven from the test through the real analyser code path, so end-of-turn
 * detection is exercised rather than simulated.
 *
 * No credentials, no Workers AI, no neurons. Synthetic data only.
 */

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };
const MODEL_ID = '@cf/qwen/qwen3-30b-a3b-fp8';

const providerTurn = (reply: string) => ({
  reply,
  nextQuestion: 'And what does that cost you?',
  presentation: 'normal',
  evidence: [{ dimension: 'self-description', claim: 'Synthetic claim.', basis: 'explicit', strength: 2, territories: ['identity'] }],
  connections: [],
  quoteCandidates: [],
  summaryPatch: '',
  achievementCandidates: []
});

let browser: Browser;
let host: { url: string; close: () => Promise<void> };

interface VoiceSession {
  context: BrowserContext;
  page: Page;
  transcribeCount: () => number;
  turnCount: () => number;
  spoken: () => Promise<string[]>;
  /** Drive the analyser the real capture code reads from. */
  setAmplitude: (value: number) => Promise<void>;
  close: () => Promise<void>;
}

/**
 * Installs deterministic media primitives BEFORE app code runs.
 *
 * `AudioContext` is faked, not bypassed: production still creates an analyser,
 * still calls `getByteTimeDomainData`, and still computes RMS. The test only
 * chooses what the microphone "hears".
 */
async function newVoiceSession(options: { analyser?: boolean; transcripts?: string[]; speechMs?: number } = {}): Promise<VoiceSession> {
  const withAnalyser = options.analyser ?? true;
  const speechMs = options.speechMs ?? 120;
  const transcripts = options.transcripts ?? ['I slow down and ask what an option costs.', 'I usually revisit it the next morning.'];
  const context = await browser.newContext({ viewport: PHONE });
  const page = await context.newPage();

  let transcribeCount = 0;
  let turnCount = 0;

  await page.addInitScript(
    ({ analyserEnabled, speechDurationMs }) => {
      (window as any).__spoken = [];
      (window as any).__amplitude = 0;
      // Transitions can be shorter than a poll interval, so record them all.
      // Installed defensively: this runs at document-start, before <html> may
      // exist, and it must never prevent the media stubs below from installing.
      (window as any).__voiceStates = [];
      const recordVoiceState = () => {
        const el = document.querySelector('[data-testid="voice-status"]');
        if (!el) return;
        const name = el.className.replace('voice-badge', '').trim();
        const seen = (window as any).__voiceStates as string[];
        if (name && seen[seen.length - 1] !== name) seen.push(name);
      };
      const installVoiceRecorder = () => {
        try {
          new MutationObserver(recordVoiceState).observe(document.documentElement, {
            subtree: true, childList: true, attributes: true, attributeFilter: ['class']
          });
        } catch { /* observer unavailable; the interval below still samples */ }
      };
      if (document.documentElement) installVoiceRecorder();
      else document.addEventListener('DOMContentLoaded', installVoiceRecorder);
      setInterval(recordVoiceState, 20);

      class FakeRecorder {
        state = 'inactive';
        ondataavailable: ((e: { data: Blob }) => void) | null = null;
        onstop: (() => void) | null = null;
        onerror: (() => void) | null = null;
        static isTypeSupported() { return true; }
        constructor(_s: unknown, _o?: unknown) {}
        start() { this.state = 'recording'; }
        stop() {
          this.state = 'inactive';
          this.ondataavailable?.({ data: new Blob([new Uint8Array(512)], { type: 'audio/webm' }) });
          this.onstop?.();
        }
      }
      (window as any).MediaRecorder = FakeRecorder;
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) }
      });

      if (analyserEnabled) {
        class FakeAnalyser {
          fftSize = 1024;
          smoothingTimeConstant = 0.6;
          getByteTimeDomainData(target: Uint8Array) {
            // A square wave at the requested amplitude: RMS is exactly the
            // amplitude, so the production curve is exercised honestly.
            const amp = Math.max(0, Math.min(1, (window as any).__amplitude));
            const swing = Math.round(amp * 127);
            for (let i = 0; i < target.length; i += 1) target[i] = 128 + (i % 2 === 0 ? swing : -swing);
          }
          disconnect() {}
        }
        (window as any).AudioContext = class {
          createAnalyser() { return new FakeAnalyser(); }
          createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
          close() { return Promise.resolve(); }
        };
      } else {
        delete (window as any).AudioContext;
        delete (window as any).webkitAudioContext;
      }

      // Speech synthesis that records what was said and completes promptly.
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { configurable: true, writable: true, value: class {
        text: string;
        lang = 'en-US';
        rate = 1; volume = 1; pitch = 1;
        onend: (() => void) | null = null;
        onerror: (() => void) | null = null;
        constructor(text: string) { this.text = text; }
      } });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          cancel() {},
          speak(u: any) {
            (window as any).__spoken.push(u.text);
            // Asynchronous, so SPEAKING is a state Atlas genuinely rests in.
            setTimeout(() => u.onend?.(), speechDurationMs);
          }
        }
      });
    },
    { analyserEnabled: withAnalyser, speechDurationMs: speechMs }
  );

  await page.route('**/api/health', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, service: 'atlas-of-one', cartographer: 'workers-ai', model: MODEL_ID }) })
  );
  await page.route('**/api/transcribe', (route: Route) => {
    const text = transcripts[Math.min(transcribeCount, transcripts.length - 1)];
    transcribeCount += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text, modelId: '@cf/openai/whisper-tiny-en' }) });
  });
  await page.route('**/api/turn', (route: Route) => {
    turnCount += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, turn: providerTurn(`Synthetic reply ${turnCount}.`), modelId: MODEL_ID, repaired: false })
    });
  });

  await page.goto(host.url, { waitUntil: 'load' });
  await page.waitForSelector('.shell');
  await completeOnboardingIfPresent(page);
  await page.waitForTimeout(400);
  await page.click('nav button:has(small:text-is("Talk"))');
  await page.waitForSelector('[data-testid="mode-talk"]');
  // The single deliberate activation that starts the spoken conversation.
  await page.click('[data-testid="mode-talk"]');

  return {
    context,
    page,
    transcribeCount: () => transcribeCount,
    turnCount: () => turnCount,
    spoken: () => page.evaluate(() => (window as any).__spoken as string[]),
    setAmplitude: (value: number) => page.evaluate((v) => { (window as any).__amplitude = v; }, value),
    close: () => context.close()
  };
}

const voiceState = (page: Page) => page.getAttribute('[data-testid="voice-status"]', 'class');
/** Wait for a state Atlas currently rests in. */
const waitForState = (page: Page, name: string, timeout = 20_000) =>
  page.waitForFunction((n) => document.querySelector('[data-testid="voice-status"]')?.className.includes(n), name, { timeout });
/** Wait for a state Atlas passed THROUGH, which may be shorter than a poll. */
const waitForVisited = (page: Page, name: string, timeout = 20_000) =>
  page.waitForFunction((n) => ((window as any).__voiceStates as string[]).includes(n), name, { timeout });
const visited = (page: Page) => page.evaluate(() => (window as any).__voiceStates as string[]);

/** Speak, then fall silent long enough for end-of-turn detection to fire. */
async function speakThenFallSilent(session: VoiceSession) {
  await session.setAmplitude(0.7);
  await session.page.waitForTimeout(400);
  // Room tone, not a whisper: real silence sits far below the speech floor.
  await session.setAmplitude(0.002);
}

/** Deterministic completion signal: wait for the request the turn produces. */
const waitForCount = async (get: () => number, target: number, page: Page, timeout = 25_000) => {
  const deadline = Date.now() + timeout;
  while (get() < target) {
    if (Date.now() > deadline) throw new Error(`expected count ${target}, saw ${get()}`);
    await page.waitForTimeout(100);
  }
};

beforeAll(async () => {
  expect(existsSync(DIST), 'run `npm run build` before the voice conversation suite').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('Talk mode is a continuous conversation', () => {
  it('1. one Talk activation speaks the current prompt and then listens on its own', async () => {
    const session = await newVoiceSession();
    try {
      const { page } = session;
      await waitForVisited(page, 'speaking');
      const spoken = await session.spoken();
      expect(spoken.length, 'Atlas states the question aloud').toBeGreaterThan(0);

      // No microphone tap: listening arrives by itself once speech completes.
      await waitForState(page, 'listening');
      expect(await voiceState(page)).toContain('listening');
      expect(session.transcribeCount(), 'nothing submitted yet').toBe(0);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('2. the visualizer is live and driven by real measured amplitude', async () => {
    const session = await newVoiceSession();
    try {
      const { page } = session;
      await waitForState(page, 'listening');
      const meter = page.locator('[data-testid="mic-visualizer"]');
      expect(await meter.count(), 'listening shows the meter').toBe(1);
      expect(await meter.getAttribute('data-metering')).toBe('live');

      await session.setAmplitude(0.02);
      await page.waitForTimeout(350);
      const quiet = Number(await meter.getAttribute('data-level'));

      await session.setAmplitude(0.85);
      await page.waitForTimeout(350);
      const loud = Number(await meter.getAttribute('data-level'));

      expect(loud, 'louder audio reads higher').toBeGreaterThan(quiet + 15);
      expect(quiet, 'silence does not look loud').toBeLessThan(30);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('3. a turn ends on sustained silence, not before speech and not on a short pause', async () => {
    const session = await newVoiceSession();
    try {
      const { page } = session;
      await waitForState(page, 'listening');

      // Silence before speech must never submit.
      await session.setAmplitude(0.002);
      await page.waitForTimeout(1800);
      expect(await voiceState(page), 'still listening through pre-speech silence').toContain('listening');
      expect(session.transcribeCount()).toBe(0);

      // Speech, then a SHORT pause, then more speech: one continuous turn.
      await session.setAmplitude(0.7);
      await page.waitForTimeout(300);
      await session.setAmplitude(0.002);
      await page.waitForTimeout(700);
      expect(await voiceState(page), 'a short pause does not end the turn').toContain('listening');
      await session.setAmplitude(0.7);
      await page.waitForTimeout(300);

      // Sustained silence ends it, exactly once.
      await session.setAmplitude(0.002);
      await waitForCount(session.transcribeCount, 1, page);
      await waitForCount(session.turnCount, 1, page);
      await page.waitForTimeout(600);
      expect(session.transcribeCount(), 'one transcription').toBe(1);
      expect(session.turnCount(), 'one Cartographer turn').toBe(1);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('4. THE CENTRAL REGRESSION: two spoken turns with no microphone tap between them', async () => {
    const session = await newVoiceSession();
    try {
      const { page } = session;
      await waitForState(page, 'listening');

      // --- turn one ---
      await speakThenFallSilent(session);
      await waitForCount(session.transcribeCount, 1, page);
      await waitForCount(session.turnCount, 1, page);
      // Atlas answers AND establishes what it is asking next.
      const afterFirst = await session.spoken();
      expect(afterFirst.some((line) => line.includes('Synthetic reply 1.')), 'the reply is spoken').toBe(true);

      // The microphone comes back by itself. This is the whole product claim.
      await waitForState(page, 'listening');
      expect(await page.locator('[data-testid="mic-visualizer"]').count(), 'visualizer live again').toBe(1);

      // --- turn two, with no tap in between ---
      await speakThenFallSilent(session);
      await waitForCount(session.transcribeCount, 2, page);
      await waitForCount(session.turnCount, 2, page);
      await waitForState(page, 'listening');
      await page.waitForTimeout(600);

      expect(session.transcribeCount(), 'exactly two transcriptions').toBe(2);
      expect(session.turnCount(), 'exactly two Cartographer turns').toBe(2);

      const persisted = await page.evaluate(
        () => new Promise<string>((resolve) => {
          const open = indexedDB.open('atlas-of-one');
          open.onsuccess = () => {
            const r = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
            r.onsuccess = () => resolve(JSON.stringify(r.result?.state ?? null));
          };
        })
      );
      const state = JSON.parse(persisted);
      expect(state.turns.length, 'two committed answers').toBe(2);
      expect(state.evidence.length, 'evidence recorded once per answer').toBe(2);
      // Deterministic engine XP, awarded once per accepted answer and no more.
      expect(state.xp, 'progression advanced').toBeGreaterThan(0);
      expect(state.turns.filter((t: any) => t.retracted).length).toBe(0);
    } finally {
      await session.close();
    }
  }, 180_000);

  it('5. manual Done remains available and keeps the conversation going', async () => {
    const session = await newVoiceSession();
    try {
      const { page } = session;
      await waitForState(page, 'listening');
      await session.setAmplitude(0.6);
      await page.waitForTimeout(200);
      await page.click('[data-testid="voice-submit-done"]');
      await waitForVisited(page, 'transcribing');
      expect(session.transcribeCount()).toBe(1);
      // And the loop continues without a tap.
      await waitForState(page, 'listening');
    } finally {
      await session.close();
    }
  }, 120_000);

  it('6. STOP ends the conversation and never reopens the microphone', async () => {
    const session = await newVoiceSession();
    try {
      const { page } = session;
      await waitForState(page, 'listening');
      await openAgency(page);
      await page.click('[data-testid="agency-stop"]');
      await page.waitForTimeout(2500);
      expect(await voiceState(page), 'not listening after STOP').not.toContain('listening');
      expect(session.transcribeCount(), 'nothing submitted by stopping').toBe(0);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('7. switching to Type ends the loop and no stale callback can restart it', async () => {
    const session = await newVoiceSession();
    try {
      const { page } = session;
      await waitForState(page, 'listening');
      await session.setAmplitude(0.7);
      await page.waitForTimeout(250);
      // Leave voice mode mid-turn, then let everything in flight resolve.
      await page.click('[data-testid="mode-type"]');
      await page.waitForTimeout(3000);

      expect(await page.locator('[data-testid="mic-visualizer"]').count(), 'meter gone').toBe(0);
      expect(await page.isVisible('[data-testid="answer-input"]'), 'typing usable').toBe(true);
      expect(session.turnCount(), 'no stale transcription submitted a turn').toBe(0);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('8. Cancel stops the conversation without an automatic restart', async () => {
    const session = await newVoiceSession();
    try {
      const { page } = session;
      await waitForState(page, 'listening');
      await page.click('[data-testid="voice-cancel"]');
      await page.waitForTimeout(2500);
      expect(await voiceState(page), 'idle after cancel').toContain('idle');
      expect(await page.locator('[data-testid="mic-visualizer"]').count()).toBe(0);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('9. the player can interrupt the Cartographer and take the turn immediately', async () => {
    // A long opening utterance gives a real window to barge into.
    const session = await newVoiceSession({ speechMs: 6_000 });
    try {
      const { page } = session;
      // Atlas is mid-sentence, stating the question.
      await waitForState(page, 'speaking');
      const interrupt = page.locator('[data-testid="voice-interrupt"]');
      await interrupt.waitFor({ state: 'visible', timeout: 10_000 });
      await interrupt.click();

      // Speech stops, the microphone opens at once, and the conversation lives.
      await waitForState(page, 'listening');
      expect(await page.locator('[data-testid="mic-visualizer"]').count(), 'listening again at once').toBe(1);

      // And it is still a conversation: a spoken turn completes normally.
      await speakThenFallSilent(session);
      await waitForCount(session.transcribeCount, 1, page);
      await waitForCount(session.turnCount, 1, page);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('10. a spoken PRIVATE command stays local and the conversation continues', async () => {
    const session = await newVoiceSession({ transcripts: ['private'] });
    try {
      const { page } = session;
      await waitForState(page, 'listening');
      await speakThenFallSilent(session);
      await waitForCount(session.transcribeCount, 1, page);
      await page.waitForTimeout(700);

      expect(session.turnCount(), 'the command never reached the Cartographer').toBe(0);
      const persisted = await page.evaluate(
        () => new Promise<string>((resolve) => {
          const open = indexedDB.open('atlas-of-one');
          open.onsuccess = () => {
            const r = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
            r.onsuccess = () => resolve(JSON.stringify(r.result?.state ?? null));
          };
        })
      );
      const state = JSON.parse(persisted);
      expect(state.privateTopics.length, 'the dimension was closed').toBeGreaterThan(0);
      expect(state.xp, 'a command awards nothing').toBe(0);

      // And the conversation carries on to a safe next prompt.
      await waitForState(page, 'listening');
    } finally {
      await session.close();
    }
  }, 120_000);

  it('11. turn-taking still works when audio analysis is unavailable', async () => {
    const session = await newVoiceSession({ analyser: false });
    try {
      const { page } = session;
      await waitForState(page, 'listening');
      const meter = page.locator('[data-testid="mic-visualizer"]');
      expect(await meter.count(), 'a truthful recording indicator remains').toBe(1);
      expect(await meter.getAttribute('data-metering'), 'and it does not claim to measure').toBe('unavailable');

      // Without analysis there is no automatic end-of-turn, so manual Done is
      // the fallback — and it still completes a whole conversational turn.
      await page.click('[data-testid="voice-submit-done"]');
      await waitForVisited(page, 'transcribing');
      expect(session.transcribeCount()).toBe(1);
      await waitForVisited(page, 'speaking');
    } finally {
      await session.close();
    }
  }, 120_000);
});
