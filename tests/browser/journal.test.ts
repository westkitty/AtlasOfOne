import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, wakeAtlas } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 640 };
const SYNTHETIC_JOURNAL = '  Synthetic Journal entry.\nNothing in this fixture describes a real person.  ';

let browser: Browser;
let page: Page;
let host: { url: string; close: () => Promise<void> };
let turnRequests = 0;

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
  page = await browser.newPage({ viewport: PHONE });
  page.on('request', (request) => {
    try {
      if (new URL(request.url()).pathname === '/api/turn') turnRequests += 1;
    } catch {
      // Ignore malformed/non-URL browser internals.
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
  await browser?.close();
  await host?.close();
});

describe('v2 blank Journal user path (J02/J03)', () => {
  it('opens a blank Journal in one action while the legacy Cartographer path remains available', async () => {
    expect(await page.isVisible('[data-testid="open-journal"]')).toBe(true);
    expect(await page.isVisible('[data-testid="enter-encounter"]')).toBe(true);

    await page.click('[data-testid="open-journal"]');
    await page.waitForSelector('[data-testid="journal-composer"]');

    expect(await page.isVisible('[data-testid="journal-entry-input"]')).toBe(true);
    expect(await page.locator('[data-testid="prompt-question"]').count()).toBe(0);
    expect(await page.locator('[data-testid="prompt-dimension"]').count()).toBe(0);
    expect(await page.textContent('[data-testid="journal-composer"]')).toContain('No question required');

    const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
    expect(focused).toBe('journal-entry-input');
  });

  it('holds at 320px with real touch targets and no horizontal overflow', async () => {
    await page.setViewportSize(NARROW);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    for (const id of ['journal-close', 'journal-save']) {
      const box = await page.locator(`[data-testid="${id}"]`).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height, `${id} height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${id} width`).toBeGreaterThanOrEqual(44);
    }

    expect(await page.isDisabled('[data-testid="journal-save"]')).toBe(true);
    await page.setViewportSize(PHONE);
  });

  it('saves typed text locally without a provider call, turn, evidence, or XP', async () => {
    const before = await persistedState();
    const beforeTurnRequests = turnRequests;

    await page.fill('[data-testid="journal-entry-input"]', SYNTHETIC_JOURNAL);
    await page.click('[data-testid="journal-save"]');
    await page.locator('[data-testid="journal-composer"]').waitFor({ state: 'detached' });

    await expect.poll(async () => (await persistedState())?.journalEntries?.length ?? 0).toBe(1);
    const after = await persistedState();

    expect(after.journalEntries[0].text).toBe(SYNTHETIC_JOURNAL);
    expect(after.journalEntries[0].inputMode).toBe('typed');
    expect(after.journalEntries[0].privacy).toBe('normal');
    expect(after.journalEntries[0].status).toBe('active');
    expect('sourcePrompt' in after.journalEntries[0]).toBe(false);

    expect(after.xp).toBe(before.xp);
    expect(after.turns).toEqual(before.turns);
    expect(after.evidence).toEqual(before.evidence);
    expect(after.insights).toEqual(before.insights);
    expect(turnRequests).toBe(beforeTurnRequests);
  });

  it('restores the saved Journal entry from IndexedDB after a full reload', async () => {
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="world"]');

    const restored = await persistedState();
    expect(restored.journalEntries).toHaveLength(1);
    expect(restored.journalEntries[0].text).toBe(SYNTHETIC_JOURNAL);

    await page.click('[data-testid="open-journal"]');
    await page.waitForSelector('[data-testid="journal-composer"]');
    expect(await page.textContent('[data-testid="journal-saved-count"]')).toContain('1 saved entry');
  });

  it('closing preserves an unsaved local draft without creating durable state', async () => {
    await page.fill('[data-testid="journal-entry-input"]', 'Unsaved synthetic draft.');
    await page.click('[data-testid="journal-close"]');
    await page.locator('[data-testid="journal-composer"]').waitFor({ state: 'detached' });

    expect((await persistedState()).journalEntries).toHaveLength(1);

    await page.click('[data-testid="open-journal"]');
    await page.waitForSelector('[data-testid="journal-composer"]');
    expect(await page.inputValue('[data-testid="journal-entry-input"]')).toBe('Unsaved synthetic draft.');
  });
});
