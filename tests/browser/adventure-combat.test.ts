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
  const gap: KnowledgeGap = {
    id: 'gap-browser-combat', kind: 'underexplored', territoryIds: ['identity'], dimensionIds: ['self-description'],
    sourceEvidenceIds: [], sourceJournalEntryIds: [], summary: 'BROWSER_COMBAT_GAP_CANARY', status: 'open', priority: 90
  };
  const prepared: CampaignState = { ...createInitialCampaign(), onboardingCompleted: true, activeTerritory: 'identity', knowledgeGaps: [gap] };
  const request = buildGapSeedRequest(prepared);
  if (!request) throw new Error('Synthetic request missing.');
  const at = () => '2026-09-26T10:00:00.000Z';
  const seeded = materializeAdventureSeed(prepared, request, 'BROWSER_COMBAT_PREMISE_CANARY', { now: at });
  const started = startAdventureRun(seeded, seeded.adventureSeeds[0].id, { now: at });
  return enterAdventureTemplate(started, started.adventureRuns[0].id, LOCAL_FALLBACK_ADVENTURE_TEMPLATE, { now: at });
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
    };
  }), serializeCampaign(state));
}

const readCampaign = (page: Page) => page.evaluate(() => new Promise<any>((resolve) => {
  const request = indexedDB.open('atlas-of-one');
  request.onsuccess = () => {
    const get = request.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
    get.onsuccess = () => resolve(get.result?.state ?? null);
  };
}));

async function waitForStored(page: Page, predicate: (state: any) => boolean) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const stored = await readCampaign(page);
    if (stored && predicate(stored)) return stored;
    await page.waitForTimeout(100);
  }
  throw new Error('Stored campaign never reached the expected state.');
}

const beat = (page: Page) => page.getAttribute('[data-testid="fallback-adventure"]', 'data-beat');
/** "Visible" is not enough: the element must be the topmost thing at its own centre. */
const onTop = (page: Page, selector: string) => page.evaluate((sel) => {
  const node = document.querySelector(sel);
  if (!node) return false;
  const box = node.getBoundingClientRect();
  const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
  return Boolean(hit && (hit === node || node.contains(hit)));
}, selector);
const overflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

async function clickFirstEnabled(page: Page, selectors: string[]): Promise<boolean> {
  // Commands unlock after the enemy's answer settles on screen (COMBAT_SETTLE_MS).
  for (let attempt = 0; attempt < 20; attempt += 1) {
    for (const selector of selectors) {
      const button = page.locator(selector);
      if (await button.count() && await button.isEnabled()) { await button.click(); return true; }
    }
    if (!await page.locator('[data-testid="combat-panel"]').count()) return true;
    await page.waitForTimeout(100);
  }
  return false;
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run a production build before the adventure-combat browser proof').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => { await browser?.close(); await host?.close(); });

describe('I02/C13 adventure -> combat -> completion in the production bundle', () => {
  it('plays a whole adventure online with no provider call, survives reload mid-combat, refuses a double tap', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    let turnRequests = 0;
    await page.route('**/api/health', (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cartographer: 'disabled', model: null }) }));
    await page.route('**/api/turn', (route: Route) => { turnRequests += 1; return route.abort(); });

    await page.goto(host.url, { waitUntil: 'load' });
    await page.waitForSelector('.shell');
    await completeOnboardingIfPresent(page);
    const prepared = preparedCampaign();
    await seedCampaign(page, prepared);
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="fallback-adventure"]');
    expect(await beat(page)).toBe('hook');
    expect(await onTop(page, '[data-testid="adventure-continue"]')).toBe(true);
    await page.click('[data-testid="adventure-minimize"]');
    await page.waitForSelector('[data-testid="adventure-resume"]');
    expect(await onTop(page, '[data-testid="adventure-resume"]')).toBe(true);
    await page.click('[data-testid="adventure-resume"]');
    await page.waitForSelector('[data-testid="fallback-adventure"][data-beat="hook"]');

    // A double tap on Continue advances exactly one beat.
    await page.dblclick('[data-testid="adventure-continue"]');
    await page.waitForSelector('[data-testid="fallback-adventure"][data-beat="approach"]');
    await page.waitForTimeout(300);
    expect(await beat(page)).toBe('approach');

    for (const expected of ['complication', 'encounter']) {
      await page.waitForTimeout(500); // presses unlock after the settle window
      await page.click('[data-testid="adventure-continue"]');
      await page.waitForSelector(`[data-testid="fallback-adventure"][data-beat="${expected}"]`);
    }
    expect(await page.locator('[data-testid="adventure-continue"]').count()).toBe(0);
    await page.waitForSelector('[data-testid="adventure-encounter-intro"]');

    // Face it replaces Continue in the same spot, so it shares the double-tap settle window.
    await page.waitForTimeout(500);
    await page.click('[data-testid="adventure-face-encounter"]');
    await page.waitForSelector('[data-testid="combat-panel"]');
    expect(await page.locator('[data-testid="combat-intents"] li').count()).toBeGreaterThan(0);
    expect(await onTop(page, '[data-testid="combat-guard"]')).toBe(true);

    // Double tap on GUARD: exactly one player turn may resolve.
    await page.dblclick('[data-testid="combat-guard"]');
    const afterGuard = await waitForStored(page, (s) => s.activeCombatRuntime?.turn >= 1);
    await page.waitForTimeout(300);
    expect((await readCampaign(page)).activeCombatRuntime.turn).toBe(1);
    expect(afterGuard.activeCombat.round).toBe(2);

    // 320px: no horizontal overflow and >=44px command targets mid-combat.
    await page.setViewportSize({ width: 320, height: 640 });
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    const heights = await page.$$eval('.combat-commands button, .combat-options button', (nodes) => nodes.map((node) => node.getBoundingClientRect().height));
    expect(Math.min(...heights)).toBeGreaterThanOrEqual(44);
    await page.setViewportSize({ width: 390, height: 844 });

    // STOP blocks commands; RESUME restores them.
    await page.click('[data-testid="adventure-stop"]');
    await page.waitForSelector('[data-testid="combat-paused"]');
    expect(await page.isDisabled('[data-testid="combat-guard"]')).toBe(true);
    await page.click('[data-testid="adventure-stop"]');
    await page.waitForSelector('[data-testid="combat-paused"]', { state: 'detached' });
    await waitForStored(page, (s) => s.sessionStatus !== 'paused');

    // Reload mid-combat resumes the same encounter at the same round.
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="combat-panel"]');
    expect(await page.textContent('.combat-kicker')).toContain('ROUND 2');

    for (let step = 0; step < 12 && await page.locator('[data-testid="combat-panel"]').count(); step += 1) {
      const clicked = await clickFirstEnabled(page, [
        '[data-testid="combat-act-listen"]', '[data-testid="combat-act-lower-light"]',
        '[data-testid="combat-technique-interrupt-charge"]', '[data-testid="combat-technique-expose-shield"]',
        '[data-testid="combat-attack"]'
      ]);
      expect(clicked).toBe(true);
      await page.waitForTimeout(120);
    }
    await page.waitForSelector('[data-testid="adventure-outcome"]');
    expect(await beat(page)).toBe('choice');

    await page.waitForTimeout(500);
    await page.click('[data-testid="adventure-continue"]');
    await page.waitForSelector('[data-testid="fallback-adventure"][data-beat="consequence"]');
    expect(await page.textContent('[data-testid="adventure-continue"]')).toBe('Return to the world');
    await page.waitForTimeout(500);
    await page.click('[data-testid="adventure-continue"]');
    await page.waitForSelector('[data-testid="fallback-adventure"]', { state: 'detached' });

    const stored = await waitForStored(page, (s) => s.adventureRuns[0]?.status === 'complete');
    expect(stored.activeCombat).toBeNull();
    expect(stored.activeCombatRuntime).toBeNull();
    expect(stored.adventureObservations).toHaveLength(1);
    expect(stored.adventureObservations[0].status).toBe('unreflected');
    expect(stored.evidence).toEqual([]);
    expect(stored.xp).toBe(prepared.xp);
    expect(JSON.stringify(stored.adventureObservations)).not.toContain('CANARY');
    // The world remembers: a memory marker where it happened, and the Journal's Journey list.
    await page.waitForSelector('[data-testid="world-memory-marker"]');
    expect(await page.locator('[data-testid="world-memory-marker"]').count()).toBe(1);
    await page.click('[data-testid="enter-encounter"]');
    await page.waitForSelector('[data-testid="journal-journey"]');
    const journey = await page.textContent('[data-testid="journal-journey"]');
    expect(journey).toContain('Completed');
    expect(journey).toContain('not evidence about you');
    expect(journey).toContain(stored.adventureObservations[0].observation);
    expect(journey).not.toContain('CANARY');

    expect(turnRequests).toBe(0);
    expect(errors).toEqual([]);
    await page.context().close();
  }, 180_000);
});
