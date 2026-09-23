import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, navigateTo } from './helper';
import { serveDist } from './server';

/**
 * STT-only browser contract.
 *
 * Speech is an input convenience, never an output channel. The real production
 * bundle must capture one dictation turn, transcribe it, return editable text,
 * and wait for explicit submission. Atlas never speaks and never reopens the
 * microphone because a response arrived.
 */

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };
const MODEL_ID = '@cf/qwen/qwen3-30b-a3b-fp8';

function collectFiles(dir: string, extensions: readonly string[]): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectFiles(full, extensions);
    return extensions.some((ext) => entry.name.endsWith(ext)) ? [full] : [];
  });
}

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

interface DictationSession {
  context: BrowserContext;
  page: Page;
  transcribeCount: () => number;
  turnCount: () => number;
  close: () => Promise<void>;
}

async function newDictationSession(transcript = 'I slow down and ask what an option costs.'): Promise<DictationSession> {
  const context = await browser.newContext({ viewport: PHONE });
  const page = await context.newPage();
  let transcribeCount = 0;
  let turnCount = 0;

  await page.addInitScript(() => {
    class FakeRecorder {
      state = 'inactive';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;
      onerror: (() => void) | null = null;
      static isTypeSupported() { return true; }
      constructor(_stream: unknown, _options?: unknown) {}
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

    class FakeAnalyser {
      fftSize = 1024;
      smoothingTimeConstant = 0.6;
      getByteTimeDomainData(target: Uint8Array) { target.fill(128); }
      disconnect() {}
    }
    (window as any).AudioContext = class {
      createAnalyser() { return new FakeAnalyser(); }
      createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
      close() { return Promise.resolve(); }
    };

    // A forbidden TTS API should not matter even when absent.
    delete (window as any).speechSynthesis;
    delete (window as any).SpeechSynthesisUtterance;
  });

  await page.route('**/api/health', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, service: 'atlas-of-one', cartographer: 'workers-ai', model: MODEL_ID }) })
  );
  await page.route('**/api/transcribe', (route: Route) => {
    transcribeCount += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: transcript, modelId: '@cf/openai/whisper-tiny-en' }) });
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
  await navigateTo(page, 'Talk');
  await page.waitForSelector('[data-testid="mode-talk"]');

  return {
    context,
    page,
    transcribeCount: () => transcribeCount,
    turnCount: () => turnCount,
    close: () => context.close()
  };
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run `npm run build` before browser tests').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('STT-only dictation', () => {
  it('contains no assistant-TTS runtime API in production source or built JavaScript', () => {
    const sourceText = collectFiles(join(process.cwd(), 'src'), ['.ts', '.tsx', '.js', '.jsx'])
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');
    const bundleText = collectFiles(DIST, ['.js', '.mjs', '.cjs'])
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    for (const text of [sourceText, bundleText]) {
      expect(text).not.toContain('speechSynthesis');
      expect(text).not.toContain('SpeechSynthesisUtterance');
    }
  });

  it('captures one turn and returns editable text without submitting it', async () => {
    const session = await newDictationSession();
    try {
      const { page } = session;
      await page.click('[data-testid="mode-talk"]');
      await page.waitForSelector('[data-testid="voice-card"]');
      await page.waitForFunction(() => document.querySelector('[data-testid="voice-status"]')?.className.includes('listening'));

      await page.click('[data-testid="voice-submit-done"]');
      await page.waitForSelector('[data-testid="answer-input"]');

      expect(session.transcribeCount()).toBe(1);
      expect(session.turnCount()).toBe(0);
      expect(await page.inputValue('[data-testid="answer-input"]')).toBe('I slow down and ask what an option costs.');
    } finally {
      await session.close();
    }
  }, 90_000);

  it('lets the player edit the transcript before explicit submission', async () => {
    const session = await newDictationSession('first draft');
    try {
      const { page } = session;
      await page.click('[data-testid="mode-talk"]');
      await page.waitForFunction(() => document.querySelector('[data-testid="voice-status"]')?.className.includes('listening'));
      await page.click('[data-testid="voice-submit-done"]');
      await page.waitForSelector('[data-testid="answer-input"]');

      await page.fill('[data-testid="answer-input"]', 'edited final answer');
      await page.click('[data-testid="submit-answer"]');
      await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('Synthetic reply'));

      expect(session.turnCount()).toBe(1);
      expect(await page.textContent('[role="status"]')).toContain('Synthetic reply 1.');
    } finally {
      await session.close();
    }
  }, 90_000);

  it('does not automatically reopen the microphone after Atlas text output', async () => {
    const session = await newDictationSession('submit me');
    try {
      const { page } = session;
      await page.click('[data-testid="mode-talk"]');
      await page.waitForFunction(() => document.querySelector('[data-testid="voice-status"]')?.className.includes('listening'));
      await page.click('[data-testid="voice-submit-done"]');
      await page.waitForSelector('[data-testid="answer-input"]');
      await page.click('[data-testid="submit-answer"]');
      await page.waitForFunction(() => document.querySelector('[role="status"]')?.textContent?.includes('Synthetic reply'));
      await page.waitForTimeout(500);

      expect(await page.locator('[data-testid="mic-visualizer"]').count()).toBe(0);
      expect(await page.locator('[data-testid="mode-talk"]').isVisible()).toBe(true);
      expect(await page.locator('[data-testid="answer-input"]').isVisible()).toBe(true);
    } finally {
      await session.close();
    }
  }, 90_000);

  it('executes spoken agency commands locally without provider submission', async () => {
    const session = await newDictationSession('stop');
    try {
      const { page } = session;
      await page.click('[data-testid="mode-talk"]');
      await page.waitForFunction(() => document.querySelector('[data-testid="voice-status"]')?.className.includes('listening'));
      await page.click('[data-testid="voice-submit-done"]');
      await page.waitForTimeout(250);

      expect(session.transcribeCount()).toBe(1);
      expect(session.turnCount()).toBe(0);
      expect(await page.locator('[data-testid="action-resume"]').count()).toBe(1);
    } finally {
      await session.close();
    }
  }, 90_000);
});
