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

async function mutateCampaign(mutator: string) {
  await page.evaluate(async (code) => {
    const open = indexedDB.open('atlas-of-one');
    await new Promise<void>((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const store = open.result.transaction('campaigns', 'readwrite').objectStore('campaigns');
        const get = store.get('active');
        get.onsuccess = () => {
          const record = get.result;
          // eslint-disable-next-line no-new-func
          new Function('state', code)(record.state);
          store.put(record).onsuccess = () => resolve();
        };
      };
    });
  }, mutator);
  await page.reload({ waitUntil: 'load' });
  await wakeAtlas(page);
  await page.waitForSelector('[data-testid="world"]');
}

const evidence = (id: string, dimension: string) => `state.evidence.push({ id: '${id}', dimension: '${dimension}', claim: 'Synthetic confirmed statement ${id}.', sourceTurnIds: [], basis: 'explicit', strength: 2, territories: ['identity'], counterEvidenceIds: [], status: 'active', origin: 'player-stated' });`;

async function openRecord() {
  await page.click('[data-testid="open-menu"]');
  await page.click('[data-testid="go-character"]');
  await page.waitForSelector('[data-testid="atlas-snapshots"]');
}

describe('v2 dated Atlas Snapshots (S01/S02/S04/S05)', () => {
  it('explains why no Snapshot is available yet instead of offering a final verdict', async () => {
    await openRecord();
    expect(await page.isDisabled('[data-testid="take-snapshot"]')).toBe(true);
    expect(await page.textContent('[data-testid="snapshot-reasons"]')).toContain('confirmed in your own words');
    expect(await page.textContent('[data-testid="final-assessment-section"]')).not.toMatch(/Final Atlas Assessment/);
  });

  it('takes a first dated Snapshot, then a second one that shows what changed', async () => {
    await mutateCampaign([
      evidence('ev_a', 'self-description'), evidence('ev_b', 'temperament'), evidence('ev_c', 'strengths')
    ].join('\n'));
    await openRecord();
    await page.click('[data-testid="take-snapshot"]');
    await expect.poll(async () => (await persistedState())?.atlasSnapshots?.length ?? 0).toBe(1);
    const first = (await persistedState()).atlasSnapshots[0];
    expect(first.evidenceIds).toEqual(['ev_a', 'ev_b', 'ev_c']);
    expect(first.previousSnapshotId).toBeUndefined();
    expect(await page.locator('[data-testid="snapshot-item"]').count()).toBe(1);
    expect(await page.isDisabled('[data-testid="take-snapshot"]')).toBe(true);

    // Two days later Greyson confirms something new; the first Snapshot stays untouched.
    await mutateCampaign(`state.atlasSnapshots[0].createdAt = new Date(Date.now() - 2 * 86400000).toISOString();\n${evidence('ev_d', 'vulnerabilities')}`);
    const firstStored = (await persistedState()).atlasSnapshots[0];
    await openRecord();
    await page.click('[data-testid="take-snapshot"]');
    await expect.poll(async () => (await persistedState())?.atlasSnapshots?.length ?? 0).toBe(2);
    const after = await persistedState();
    expect(after.atlasSnapshots.find((item: any) => item.id === firstStored.id)).toEqual(firstStored);
    const second = after.atlasSnapshots.find((item: any) => item.id !== firstStored.id);
    expect(second.previousSnapshotId).toBe(firstStored.id);
    expect(await page.locator('[data-testid="snapshot-item"]').count()).toBe(2);
    expect(await page.textContent('[data-testid="snapshot-change"]')).toContain('Confirmed statements: +1');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  it('a withdrawn statement leaves history intact but is reported as withheld', async () => {
    await mutateCampaign(`state.evidence.find((e) => e.id === 'ev_d').status = 'retracted';`);
    await openRecord();
    expect(await page.locator('[data-testid="snapshot-item"]').count()).toBe(2);
    const change = await page.textContent('[data-testid="snapshot-change"]');
    expect(change).toContain('withheld');
    expect(change).toContain('Confirmed statements: +0');
  });
});
