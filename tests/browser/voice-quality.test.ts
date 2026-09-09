import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { serveDist } from './server';
import { completeOnboardingIfPresent, navigateTo } from './helper';

/**
 * What the Cartographer actually speaks with.
 *
 * The previous build set `utterance.lang = 'en-US'` and never touched
 * `utterance.voice`, so the browser used its own default — which on macOS is
 * the novelty voice **Albert**. This suite drives the real bundle with a
 * synthetic voice inventory and asserts which voice the app hands to the
 * synthesiser.
 *
 * It proves selection, fallback and cancellation. It cannot prove a voice
 * sounds pleasant — that is what the Voice Lab exists for, and no assertion
 * here should be read as a claim about quality.
 */

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist/client');
const PHONE = { width: 390, height: 844 };

/** A synthetic inventory shaped like the real macOS one, novelty default included. */
const INVENTORY = [
  { name: 'Albert', lang: 'en-US', localService: true, default: true },
  { name: 'Zarvox', lang: 'en-US', localService: true, default: false },
  { name: 'Bad News', lang: 'en-US', localService: true, default: false },
  { name: 'Grandma (English (United States))', lang: 'en-US', localService: true, default: false },
  { name: 'Anna', lang: 'de-DE', localService: true, default: false },
  { name: 'Daniel', lang: 'en-GB', localService: true, default: false },
  { name: 'Samantha', lang: 'en-US', localService: true, default: false }
];

let browser: Browser;
let host: { url: string; close: () => Promise<void> };

/** A page whose speech synthesiser is observable and whose voices are known. */
async function openWith(voices: typeof INVENTORY, preferredUri?: string) {
  const context: BrowserContext = await browser.newContext({ viewport: PHONE });
  const page = await context.newPage();
  await page.addInitScript(
    ({ list, preference }) => {
      (window as any).__spoken = [];
      if (preference) {
        try { window.localStorage.setItem('atlas_voice_uri', preference); } catch { /* ignore */ }
      }
      const built = list.map((voice) => ({ ...voice, voiceURI: voice.name }));
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        configurable: true,
        value: class {
          text: string; lang = ''; voice: unknown = null;
          rate = 1; volume = 1; pitch = 1;
          onend: (() => void) | null = null;
          onerror: (() => void) | null = null;
          constructor(text: string) { this.text = text; }
        }
      });
      Object.defineProperty(window, 'speechSynthesis', {
        configurable: true,
        value: {
          getVoices: () => built,
          onvoiceschanged: null,
          cancel() { (window as any).__cancels = ((window as any).__cancels ?? 0) + 1; },
          speak(utterance: any) {
            (window as any).__spoken.push({
              text: utterance.text,
              voice: (utterance.voice as { name?: string } | null)?.name ?? null,
              lang: utterance.lang,
              rate: utterance.rate,
              volume: utterance.volume,
              pitch: utterance.pitch
            });
            setTimeout(() => utterance.onend?.(), 40);
          }
        }
      });
    },
    { list: voices, preference: preferredUri ?? null }
  );
  await page.goto(host.url);
  await completeOnboardingIfPresent(page);
  return { context, page };
}

/** Start a spoken turn and return everything the app asked to have said. */
async function speakOnce(page: Page) {
  await navigateTo(page, 'Talk');
  await page.click('[data-testid="mode-talk"]');
  await page.waitForFunction(() => ((window as any).__spoken?.length ?? 0) > 0, undefined, { timeout: 15_000 });
  return page.evaluate(() => (window as any).__spoken as { text: string; voice: string | null; rate: number; volume: number; pitch: number }[]);
}

beforeAll(async () => {
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome' });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('the Cartographer speaks with a chosen voice', () => {
  it('never uses the browser default when that default is a novelty voice', async () => {
    const { context, page } = await openWith(INVENTORY);
    try {
      const spoken = await speakOnce(page);
      expect(spoken.length).toBeGreaterThan(0);
      // This is the exact regression: Albert is `default: true` in the inventory.
      expect(spoken[0].voice).not.toBe('Albert');
      expect(spoken[0].voice).not.toBe('Zarvox');
      expect(spoken[0].voice).not.toBe('Bad News');
      // It picks the best real narrator available instead.
      expect(spoken[0].voice).toBe('Samantha');
    } finally {
      await context.close();
    }
  }, 90_000);

  it('honours a stored preference, and follows the voice\'s own language', async () => {
    const { context, page } = await openWith(INVENTORY, 'Daniel');
    try {
      const spoken = await speakOnce(page);
      expect(spoken[0].voice).toBe('Daniel');
      expect(spoken[0].lang).toBe('en-GB');
    } finally {
      await context.close();
    }
  }, 90_000);

  it('falls back automatically when the preferred voice is not installed', async () => {
    const { context, page } = await openWith(INVENTORY, 'Ava (Premium)');
    try {
      expect((await speakOnce(page))[0].voice).toBe('Samantha');
    } finally {
      await context.close();
    }
  }, 90_000);

  it('still speaks, with the browser default, when the device reports no voices', async () => {
    const { context, page } = await openWith([]);
    try {
      const spoken = await speakOnce(page);
      expect(spoken.length).toBeGreaterThan(0);
      expect(spoken[0].voice).toBeNull();
      expect(spoken[0].lang).toBe('en-US');
    } finally {
      await context.close();
    }
  }, 90_000);

  it('uses the only voice available even when it is a poor one', async () => {
    const { context, page } = await openWith([INVENTORY[3]]);
    try {
      expect((await speakOnce(page))[0].voice).toContain('Grandma');
    } finally {
      await context.close();
    }
  }, 90_000);

  it('carries delivery in pace, never by bending pitch', async () => {
    const { context, page } = await openWith(INVENTORY);
    try {
      const spoken = await speakOnce(page);
      expect(spoken[0].pitch, 'pitch is left alone').toBe(1);
      expect(spoken[0].rate).toBeGreaterThan(0.85);
      expect(spoken[0].rate).toBeLessThanOrEqual(1);
    } finally {
      await context.close();
    }
  }, 90_000);

  it('STOP cancels speech and leaves the conversation recoverable', async () => {
    const { context, page } = await openWith(INVENTORY);
    try {
      await speakOnce(page);
      await page.click('[data-testid="action-more"]');
      await page.waitForSelector('[data-testid="more-sheet"]');
      await page.click('[data-testid="agency-stop"]');

      expect(await page.evaluate(() => (window as any).__cancels ?? 0)).toBeGreaterThan(0);
      // Recovery stays immediate: RESUME is promoted to the primary row.
      await page.waitForSelector('[data-testid="action-resume"]');
      await page.click('[data-testid="action-resume"]');
      expect(await page.locator('[data-testid="agency-pass"]').isVisible()).toBe(true);
    } finally {
      await context.close();
    }
  }, 90_000);
});
