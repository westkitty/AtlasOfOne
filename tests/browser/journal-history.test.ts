import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, wakeAtlas } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 640 };

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

async function waitForPersistedState(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await persistedState()) return;
    await page.waitForTimeout(50);
  }
  throw new Error('Timed out waiting for the active Atlas campaign to persist.');
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
  await waitForPersistedState();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('v2 Journal history and optional prompt (J06/J08)', () => {
  it('saves with no prompt by default, then with an explicitly chosen prompt', async () => {
    const beforeTurnRequests = turnRequests;
    await page.click('[data-testid="open-journal"]');
    await page.waitForSelector('[data-testid="journal-composer"]');
    expect(await page.locator('[data-testid="journal-prompt-text"]').count()).toBe(0);

    await page.fill('[data-testid="journal-entry-input"]', 'Synthetic unprompted entry.');
    await page.click('[data-testid="journal-save"]');
    await expect.poll(async () => (await persistedState())?.journalEntries?.length ?? 0).toBe(1);
    expect('sourcePrompt' in (await persistedState()).journalEntries[0]).toBe(false);

    await page.click('[data-testid="open-journal"]');
    await page.click('[data-testid="journal-prompt-request"]');
    const first = await page.textContent('[data-testid="journal-prompt-text"]');
    await page.click('[data-testid="journal-prompt-next"]');
    const chosen = await page.textContent('[data-testid="journal-prompt-text"]');
    expect(chosen).not.toBe(first);
    await page.fill('[data-testid="journal-entry-input"]', 'Synthetic prompted entry.');
    await page.click('[data-testid="journal-save"]');
    await expect.poll(async () => (await persistedState())?.journalEntries?.length ?? 0).toBe(2);
    const prompted = (await persistedState()).journalEntries.find((item: any) => item.text === 'Synthetic prompted entry.');
    expect(prompted.sourcePrompt).toBe(chosen);
    expect(turnRequests).toBe(beforeTurnRequests);
  });

  it('dismissing a prompt saves without sourcePrompt', async () => {
    await page.click('[data-testid="open-journal"]');
    await page.click('[data-testid="journal-prompt-request"]');
    await page.click('[data-testid="journal-prompt-dismiss"]');
    await page.fill('[data-testid="journal-entry-input"]', 'Synthetic dismissed-prompt entry.');
    await page.click('[data-testid="journal-save"]');
    await expect.poll(async () => (await persistedState())?.journalEntries?.length ?? 0).toBe(3);
    const saved = (await persistedState()).journalEntries.find((item: any) => item.text === 'Synthetic dismissed-prompt entry.');
    expect('sourcePrompt' in saved).toBe(false);
  });

  it('navigates days and changes privacy of an older entry from history', async () => {
    // Backdate the first entry by two days so history has two day groups.
    await page.evaluate(async () => {
      const open = indexedDB.open('atlas-of-one');
      await new Promise<void>((resolve, reject) => {
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const store = open.result.transaction('campaigns', 'readwrite').objectStore('campaigns');
          const get = store.get('active');
          get.onsuccess = () => {
            const record = get.result;
            const target = record.state.journalEntries.find((item: any) => item.text === 'Synthetic unprompted entry.');
            target.createdAt = new Date(Date.now() - 2 * 86_400_000).toISOString();
            store.put(record).onsuccess = () => resolve();
          };
        };
      });
    });
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="world"]');

    await page.click('[data-testid="open-journal"]');
    await page.click('[data-testid="journal-history-open"]');
    await page.waitForSelector('[data-testid="journal-history"]');
    expect(await page.isDisabled('[data-testid="journal-history-newer"]')).toBe(true);
    expect(await page.locator('[data-testid="journal-history-entry"]').count()).toBe(2);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    await page.click('[data-testid="journal-history-older"]');
    expect(await page.locator('[data-testid="journal-history-entry"]').count()).toBe(1);
    expect(await page.isDisabled('[data-testid="journal-history-older"]')).toBe(true);

    await page.click('[data-testid="journal-history-entry"] button');
    await page.click('[data-testid="journal-history-private"]');
    await expect.poll(async () => {
      const state = await persistedState();
      return state.journalEntries.find((item: any) => item.text === 'Synthetic unprompted entry.')?.privacy;
    }).toBe('private');
    expect(await page.textContent('[data-testid="journal-history-status"]')).toContain('Private');

    await page.click('[data-testid="journal-history-retract"]');
    await expect.poll(async () => {
      const state = await persistedState();
      return state.journalEntries.find((item: any) => item.text === 'Synthetic unprompted entry.')?.status;
    }).toBe('retracted');

    const others = (await persistedState()).journalEntries.filter((item: any) => item.text !== 'Synthetic unprompted entry.');
    expect(others.every((item: any) => item.privacy === 'normal' && item.status === 'active')).toBe(true);

    await page.click('[data-testid="journal-history-back"]');
    expect(await page.isVisible('[data-testid="journal-entry-input"]')).toBe(true);
  });
});
