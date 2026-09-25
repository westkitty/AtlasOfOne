import { existsSync, readFileSync } from 'node:fs';
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

const SLICE_KEYS = ['journalEntries', 'knowledgeGaps', 'adventureSeeds', 'adventureRuns', 'adventureActions',
  'adventureObservations', 'activeCombat', 'reflections', 'evidence', 'atlasSnapshots', 'xp', 'campaignId'];
const pick = (state: any) => Object.fromEntries(SLICE_KEYS.map((key) => [key, state[key]]));

async function openRecord() {
  await page.click('[data-testid="open-menu"]');
  await page.click('[data-testid="go-character"]');
  await page.waitForSelector('[data-testid="atlas-snapshots"]');
}

describe('v2 whole-slice reload / export / delete / import (I08)', () => {
  it('an in-progress adventure and encounter survive reload, export, delete and import intact', async () => {
    await page.click('[data-testid="open-journal"]');
    await page.fill('[data-testid="journal-entry-input"]', 'Synthetic I08 entry.');
    await page.click('[data-testid="journal-save"]');
    await expect.poll(async () => (await persistedState())?.journalEntries?.length ?? 0).toBe(1);

    await page.click('[data-testid="open-journal"]');
    await page.click('[data-testid="journal-history-open"]');
    await page.click('[data-testid="journal-history-entry"] button');
    await page.click('[data-testid="journal-explore"]');
    await page.click('[data-testid="journal-explore-place"][data-territory="identity"]');
    await page.locator('[data-testid="adventure-start"]').first().click();
    for (let i = 0; i < 6 && !(await page.locator('[data-testid="adventure-combat"]').count()); i += 1) {
      await page.locator('[data-testid="adventure-option"]').first().click();
    }
    await page.waitForSelector('[data-testid="adventure-combat"]');
    await expect.poll(async () => Boolean((await persistedState())?.activeCombat)).toBe(true);
    const midCombat = pick(await persistedState());

    // Full reload: the encounter is still there.
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="open-adventure"]');
    expect(pick(await persistedState())).toEqual(midCombat);
    await page.click('[data-testid="open-adventure"]');
    await page.waitForSelector('[data-testid="adventure-combat"]');
    await page.click('[data-testid="adventure-close"]');

    // Export -> delete -> import.
    await openRecord();
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:text("Export Atlas")');
    const download = await downloadPromise;
    const exported = readFileSync((await download.path())!);
    expect(pick(JSON.parse(exported.toString('utf8')))).toEqual(midCombat);

    await page.click('button:text("Delete local Atlas")');
    await page.click('button:text-is("Delete everything")');
    await page.waitForTimeout(300);
    const afterDelete = await persistedState();
    if (afterDelete) expect(afterDelete.adventureRuns ?? []).toEqual([]);

    await page.reload({ waitUntil: 'load' });
    await completeOnboardingIfPresent(page);
    await page.waitForSelector('[data-testid="world"]');
    await openRecord();
    await page.setInputFiles('.file input', { name: 'slice.atlas.json', mimeType: 'application/json', buffer: exported });
    await page.waitForSelector('.toast:text-matches("imported and validated")');
    await expect.poll(async () => (await persistedState())?.campaignId).toBe(midCombat.campaignId);
    expect(pick(await persistedState())).toEqual(midCombat);

    // The restored encounter is playable to the end of the adventure.
    await page.goto(host.url, { waitUntil: 'load' });
    await wakeAtlas(page);
    await page.click('[data-testid="open-adventure"]');
    for (let step = 0; step < 30; step += 1) {
      if (await page.locator('[data-testid="adventure-outcome"]').count()) break;
      if (await page.locator('[data-testid="adventure-combat"]').count()) {
        await page.locator('[data-testid="adventure-combat"] .cp-verb:not([disabled])').first().click();
        const option = page.locator('[data-testid="adventure-combat"] .cp-option:not([disabled])').first();
        if (await option.count()) await option.click();
      } else {
        await page.locator('[data-testid="adventure-option"]').first().click();
      }
      await page.waitForTimeout(30);
    }
    await expect.poll(async () => (await persistedState())?.adventureRuns?.[0]?.status).toBe('complete');
  });
});
