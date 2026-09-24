import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };
const TRANSCRIPT = 'Synthetic dictated Journal sentence.';

let browser: Browser;
let context: BrowserContext;
let page: Page;
let host: { url: string; close: () => Promise<void> };
let transcribeCount = 0;
let turnCount = 0;

async function persistedState() {
  return page.evaluate(async () => {
    const open = indexedDB.open('atlas-of-one');
    return new Promise<any>((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const request = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result?.state ?? null);
      };
    });
  });
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run npm run build first').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: PHONE });
  page = await context.newPage();

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
  });

  await page.route('**/api/health', (route: Route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, service: 'atlas-of-one', cartographer: 'disabled', model: null }) })
  );
  await page.route('**/api/transcribe', (route: Route) => {
    transcribeCount += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: TRANSCRIPT, modelId: '@cf/openai/whisper-tiny-en' }) });
  });
  page.on('request', (request) => {
    try {
      if (new URL(request.url()).pathname === '/api/turn') turnCount += 1;
    } catch {
      // Ignore browser internals.
    }
  });

  await page.goto(host.url, { waitUntil: 'load' });
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases?.() ?? [];
    for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
  });
  await page.reload({ waitUntil: 'load' });
  await completeOnboardingIfPresent(page);
  await page.waitForSelector('[data-testid="world"]');
}, 120_000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await host?.close();
});

describe('J04 Journal STT input', () => {
  it('puts one transcript into the same editable Journal draft without saving or submitting it', async () => {
    const before = await persistedState();
    await page.click('[data-testid="open-journal"]');
    await page.fill('[data-testid="journal-entry-input"]', 'Typed prefix.');

    await page.click('[data-testid="journal-dictate"]');
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="journal-dictation-status"]')?.textContent?.includes('Listening')
    );
    await page.click('[data-testid="journal-dictation-done"]');

    await expect.poll(() => transcribeCount).toBe(1);
    await expect.poll(async () => page.inputValue('[data-testid="journal-entry-input"]'))
      .toBe(`Typed prefix. ${TRANSCRIPT}`);

    expect((await persistedState()).journalEntries).toEqual(before.journalEntries);
    expect((await persistedState()).xp).toBe(before.xp);
    expect((await persistedState()).turns).toEqual(before.turns);
    expect(turnCount).toBe(0);
    expect(await page.isVisible('[data-testid="journal-save"]')).toBe(true);
  });

  it('keeps the transcript editable and saves explicitly as speech-to-text origin', async () => {
    await page.fill('[data-testid="journal-entry-input"]', 'Edited final Journal text.');
    const before = await persistedState();

    await page.click('[data-testid="journal-save"]');
    await page.locator('[data-testid="journal-composer"]').waitFor({ state: 'detached' });

    await expect.poll(async () => (await persistedState())?.journalEntries?.length ?? 0)
      .toBe((before.journalEntries?.length ?? 0) + 1);

    const after = await persistedState();
    const saved = after.journalEntries[after.journalEntries.length - 1];
    expect(saved.text).toBe('Edited final Journal text.');
    expect(saved.inputMode).toBe('speech-to-text');
    expect(after.xp).toBe(before.xp);
    expect(after.turns).toEqual(before.turns);
    expect(turnCount).toBe(0);
  });

  it('invalidates permission work when Journal closes before microphone acquisition finishes', async () => {
    await page.click('[data-testid="open-journal"]');
    await page.fill('[data-testid="journal-entry-input"]', 'Permission-race draft.');

    await page.evaluate(() => {
      const mediaDevices = navigator.mediaDevices as MediaDevices & { __atlasOriginalGetUserMedia?: typeof navigator.mediaDevices.getUserMedia };
      mediaDevices.__atlasOriginalGetUserMedia = mediaDevices.getUserMedia.bind(mediaDevices);
      mediaDevices.getUserMedia = (() =>
        new Promise<MediaStream>((resolve) => {
          window.setTimeout(() => {
            resolve({ getTracks: () => [{ stop() {} }] } as unknown as MediaStream);
          }, 250);
        })) as typeof navigator.mediaDevices.getUserMedia;
    });

    const beforeTranscribe = transcribeCount;
    await page.click('[data-testid="journal-dictate"]');
    await page.click('[data-testid="journal-close"]');
    await page.waitForTimeout(450);

    await page.evaluate(() => {
      const mediaDevices = navigator.mediaDevices as MediaDevices & { __atlasOriginalGetUserMedia?: typeof navigator.mediaDevices.getUserMedia };
      if (mediaDevices.__atlasOriginalGetUserMedia) {
        mediaDevices.getUserMedia = mediaDevices.__atlasOriginalGetUserMedia;
        delete mediaDevices.__atlasOriginalGetUserMedia;
      }
    });

    expect(transcribeCount).toBe(beforeTranscribe);
    await page.click('[data-testid="open-journal"]');
    expect(await page.inputValue('[data-testid="journal-entry-input"]')).toBe('Permission-race draft.');
    expect(await page.locator('[data-testid="journal-mic-visualizer"]').count()).toBe(0);

    // Leave the shared browser fixture in its map state for the next test.
    await page.click('[data-testid="journal-close"]');
  });

  it('cancels Journal dictation on close so a stale transcript cannot land later', async () => {
    await page.click('[data-testid="open-journal"]');
    await page.fill('[data-testid="journal-entry-input"]', 'Keep this draft.');

    await page.unroute('**/api/transcribe');
    await page.route('**/api/transcribe', async (route: Route) => {
      transcribeCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 350));
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, text: 'STALE TRANSCRIPT', modelId: '@cf/openai/whisper-tiny-en' }) });
    });

    await page.click('[data-testid="journal-dictate"]');
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="journal-dictation-status"]')?.textContent?.includes('Listening')
    );
    await page.click('[data-testid="journal-dictation-done"]');
    await page.waitForFunction(() =>
      document.querySelector('[data-testid="journal-dictation-status"]')?.textContent?.includes('Transcribing')
    );
    await page.click('[data-testid="journal-close"]');
    await page.waitForTimeout(500);

    await page.click('[data-testid="open-journal"]');
    expect(await page.inputValue('[data-testid="journal-entry-input"]')).toBe('Keep this draft.');
  });
});
