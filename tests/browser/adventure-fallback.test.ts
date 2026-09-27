import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { KnowledgeGap } from '../../src/contracts';
import { LOCAL_FALLBACK_ADVENTURE_TEMPLATE } from '../../src/adventure/fallback';
import { enterAdventureTemplate } from '../../src/adventure/runtime';
import { startAdventureRun } from '../../src/adventure/runs';
import { materializeAdventureSeed } from '../../src/adventure/seeds';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { buildGapSeedRequest } from '../../src/knowledge/seed-request';
import { serializeCampaign } from '../../src/persistence/transfer';
import { completeOnboardingIfPresent, wakeAtlas } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
let browser: Browser;
let host: { url: string; close: () => Promise<void> };

function preparedCampaign(): CampaignState {
  const initial = createInitialCampaign();
  const gap: KnowledgeGap = {
    id: 'gap-browser-fallback', kind: 'underexplored', territoryIds: ['identity'], dimensionIds: ['self-description'],
    sourceEvidenceIds: [], sourceJournalEntryIds: [], summary: 'BROWSER_PRIVATE_GAP_CANARY', status: 'open', priority: 90
  };
  const prepared: CampaignState = {
    ...initial,
    onboardingCompleted: true,
    activeTerritory: 'identity',
    knowledgeGaps: [gap],
    journalEntries: [{
      id: 'journal-browser-private', createdAt: '2026-09-21T12:00:00.000Z', text: 'BROWSER_PRIVATE_JOURNAL_CANARY',
      inputMode: 'typed', privacy: 'private', status: 'active', reflectionIds: [], adventureIds: []
    }]
  };
  const request = buildGapSeedRequest(prepared);
  if (!request) throw new Error('Synthetic browser request missing.');
  const seeded = materializeAdventureSeed(prepared, request, 'BROWSER_PRIVATE_PREMISE_CANARY', { now: () => '2026-09-21T13:00:00.000Z' });
  const seed = seeded.adventureSeeds[0];
  if (!seed) throw new Error('Synthetic browser seed missing.');
  const started = startAdventureRun(seeded, seed.id, { now: () => '2026-09-21T13:30:00.000Z' });
  const run = started.adventureRuns[0];
  if (!run) throw new Error('Synthetic browser run missing.');
  return enterAdventureTemplate(started, run.id, LOCAL_FALLBACK_ADVENTURE_TEMPLATE, { now: () => '2026-09-21T14:00:00.000Z' });
}

async function seedCampaign(page: Page, state: CampaignState) {
  await page.evaluate((raw) => new Promise<void>((resolve, reject) => {
    const request = indexedDB.open('atlas-of-one');
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('campaigns')) request.result.createObjectStore('campaigns', { keyPath: 'key' });
    };
    request.onsuccess = () => {
      const tx = request.result.transaction('campaigns', 'readwrite');
      tx.objectStore('campaigns').put({ key: 'active', state: JSON.parse(raw) });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    };
    request.onerror = () => reject(request.error);
  }), serializeCampaign(state));
}

const readCampaign = (page: Page) => page.evaluate(() => new Promise<any>((resolve) => {
  const request = indexedDB.open('atlas-of-one');
  request.onsuccess = () => {
    const get = request.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
    get.onsuccess = () => resolve(get.result?.state ?? null);
  };
}));

beforeAll(async () => {
  expect(existsSync(DIST), 'run a production build before A06 browser proof').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => { await browser?.close(); await host?.close(); });

describe('A06 local fallback Adventure in the production bundle', () => {
  it('renders one private-safe local scene while provider-disabled/offline and mutates no Adventure authority', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let turnRequests = 0;
    await page.route('**/api/health', (route: Route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, cartographer: 'disabled', model: null })
    }));
    await page.route('**/api/turn', (route: Route) => { turnRequests += 1; return route.abort(); });

    await page.goto(host.url, { waitUntil: 'load' });
    await page.waitForSelector('.shell');
    await completeOnboardingIfPresent(page);
    const prepared = preparedCampaign();
    await seedCampaign(page, prepared);
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="world"]');
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));

    const card = page.locator('[data-testid="fallback-adventure"]');
    await card.waitFor({ state: 'visible' });
    expect(await page.textContent('[data-testid="fallback-adventure-title"]')).toContain('mystery');
    // Occlusion, not just CSS visibility: the card must be above the fixed world.
    expect(await page.evaluate(() => {
      const node = document.querySelector('[data-testid="fallback-adventure-title"]')!;
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return Boolean(hit && (hit === node || node.contains(hit)));
    })).toBe(true);
    const body = await page.textContent('[data-testid="fallback-adventure-body"]');
    expect(body).toContain('actually in front of you');
    const cardText = await card.textContent();
    expect(cardText).toContain('Runs on this device');
    expect(cardText).toContain('not evidence about you');
    expect(cardText).not.toContain('BROWSER_PRIVATE_GAP_CANARY');
    expect(cardText).not.toContain('BROWSER_PRIVATE_JOURNAL_CANARY');
    expect(cardText).not.toContain('BROWSER_PRIVATE_PREMISE_CANARY');
    expect(turnRequests).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    const stored = await readCampaign(page);
    expect(stored.adventureSeeds).toEqual(JSON.parse(serializeCampaign(prepared)).adventureSeeds);
    expect(stored.adventureRuns).toEqual(JSON.parse(serializeCampaign(prepared)).adventureRuns);
    expect(stored.xp).toBe(prepared.xp);

    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="fallback-adventure"]');
    expect(await page.textContent('[data-testid="fallback-adventure-title"]')).toContain('mystery');
    expect(turnRequests).toBe(0);

    await page.context().close();
  }, 120_000);
});
