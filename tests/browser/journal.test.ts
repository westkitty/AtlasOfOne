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
    await page.click('[data-testid="journal-close"]');
    await page.setViewportSize(NARROW);

    for (const id of ['open-journal', 'enter-encounter']) {
      const box = await page.locator(`[data-testid="${id}"]`).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height, `${id} height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${id} width`).toBeGreaterThanOrEqual(44);
    }

    await page.click('[data-testid="open-journal"]');
    await page.waitForSelector('[data-testid="journal-composer"]');

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

  it('same-task double save creates exactly one additional Journal entry', async () => {
    const before = await persistedState();
    const beforeXp = before.xp;
    const beforeTurns = structuredClone(before.turns);
    const beforeEvidence = structuredClone(before.evidence);
    const beforeTurnRequests = turnRequests;

    await page.click('[data-testid="open-journal"]');
    await page.fill('[data-testid="journal-entry-input"]', 'Synthetic duplicate-save guard entry.');

    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="journal-save"]') as HTMLButtonElement | null;
      if (!button) throw new Error('Journal save button missing.');
      button.click();
      button.click();
    });

    await expect.poll(async () => (await persistedState())?.journalEntries?.length ?? 0).toBe(2);
    const after = await persistedState();

    expect(after.journalEntries.filter((entry: any) => entry.text === 'Synthetic duplicate-save guard entry.')).toHaveLength(1);
    expect(after.xp).toBe(beforeXp);
    expect(after.turns).toEqual(beforeTurns);
    expect(after.evidence).toEqual(beforeEvidence);
    expect(turnRequests).toBe(beforeTurnRequests);
  });

  it('restores the saved Journal entry from IndexedDB after a full reload', async () => {
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="world"]');

    const restored = await persistedState();
    expect(restored.journalEntries).toHaveLength(2);
    expect(restored.journalEntries[0].text).toBe(SYNTHETIC_JOURNAL);

    await page.click('[data-testid="open-journal"]');
    await page.waitForSelector('[data-testid="journal-composer"]');
    expect(await page.textContent('[data-testid="journal-saved-count"]')).toContain('2 saved entries');
  });

  it('closing preserves an unsaved local draft without creating durable state', async () => {
    await page.fill('[data-testid="journal-entry-input"]', 'Unsaved synthetic draft.');
    await page.click('[data-testid="journal-close"]');
    await page.locator('[data-testid="journal-composer"]').waitFor({ state: 'detached' });

    expect((await persistedState()).journalEntries).toHaveLength(2);

    await page.click('[data-testid="open-journal"]');
    await page.waitForSelector('[data-testid="journal-composer"]');
    expect(await page.inputValue('[data-testid="journal-entry-input"]')).toBe('Unsaved synthetic draft.');
  });

  it('makes the latest entry PRIVATE then retracts it without provider/progression side effects', async () => {
    const before = await persistedState();
    const beforeTurnRequests = turnRequests;
    const latestBefore = before.journalEntries[before.journalEntries.length - 1];

    expect(await page.isVisible('[data-testid="journal-private-latest"]')).toBe(true);
    expect(await page.isVisible('[data-testid="journal-retract-latest"]')).toBe(true);

    await page.click('[data-testid="journal-private-latest"]');
    await expect.poll(async () => {
      const state = await persistedState();
      return state.journalEntries[state.journalEntries.length - 1]?.privacy;
    }).toBe('private');

    const privateState = await persistedState();
    const privateLatest = privateState.journalEntries[privateState.journalEntries.length - 1];
    expect(privateLatest.text).toBe(latestBefore.text);
    expect(privateLatest.status).toBe('active');
    expect(privateState.xp).toBe(before.xp);
    expect(privateState.turns).toEqual(before.turns);
    expect(privateState.evidence).toEqual(before.evidence);
    expect(privateState.insights).toEqual(before.insights);
    expect(turnRequests).toBe(beforeTurnRequests);
    expect(await page.textContent('[data-testid="journal-latest-status"]')).toContain('Private');
    expect(await page.isDisabled('[data-testid="journal-private-latest"]')).toBe(true);

    await page.click('[data-testid="journal-retract-latest"]');
    await expect.poll(async () => {
      const state = await persistedState();
      return state.journalEntries[state.journalEntries.length - 1]?.status;
    }).toBe('retracted');

    const retractedState = await persistedState();
    const retractedLatest = retractedState.journalEntries[retractedState.journalEntries.length - 1];
    expect(retractedLatest.text).toBe(latestBefore.text);
    expect(retractedLatest.privacy).toBe('private');
    expect(retractedState.xp).toBe(before.xp);
    expect(retractedState.turns).toEqual(before.turns);
    expect(retractedState.evidence).toEqual(before.evidence);
    expect(retractedState.insights).toEqual(before.insights);
    expect(turnRequests).toBe(beforeTurnRequests);
    expect(await page.textContent('[data-testid="journal-latest-status"]')).toContain('Retracted');
    expect(await page.isDisabled('[data-testid="journal-retract-latest"]')).toBe(true);

    // Privacy actions do not silently discard the unrelated unsaved draft.
    expect(await page.inputValue('[data-testid="journal-entry-input"]')).toBe('Unsaved synthetic draft.');
  });
});
