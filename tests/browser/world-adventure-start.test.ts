import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, wakeAtlas } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const JOURNAL_TEXT = 'synthetic-i01-world-adventure-canary-never-copy-this';
let browser: Browser;
let host: { url: string; close: () => Promise<void> };

const readCampaign = (page: Page) => page.evaluate(() => new Promise<any>((resolve) => {
  const request = indexedDB.open('atlas-of-one');
  request.onsuccess = () => {
    const get = request.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
    get.onsuccess = () => resolve(get.result?.state ?? null);
  };
}));

const center = (box: { x: number; y: number; width: number; height: number }) => ({
  x: box.x + box.width / 2,
  y: box.y + box.height / 2
});

async function moveTowardAdventureMarker(page: Page) {
  const action = page.locator('[data-testid="interact-action-btn"]');
  const marker = page.locator('[data-testid="adventure-world-marker"]').first();
  const avatar = page.locator('[data-testid="world-greyson"]');

  for (let step = 0; step < 32; step += 1) {
    if ((await action.locator('.btn-label').textContent())?.trim() === 'Start') return;
    const markerBox = await marker.boundingBox();
    const avatarBox = await avatar.boundingBox();
    if (!markerBox || !avatarBox) throw new Error('I01 marker/avatar geometry unavailable.');
    const target = center(markerBox);
    const player = center(avatarBox);
    const dx = target.x - player.x;
    const dy = target.y - player.y;
    const direction = Math.abs(dx) >= Math.abs(dy)
      ? (dx >= 0 ? 'right' : 'left')
      : (dy >= 0 ? 'down' : 'up');
    const control = page.locator(`[data-testid="dpad-${direction}"]`);
    await control.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch' });
    await page.waitForTimeout(180);
    await control.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch' });
    await page.waitForTimeout(40);
  }
  throw new Error('Greyson never reached the Adventure marker interaction radius in 32 bounded movement bursts.');
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run a production build before I01 browser proof').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => { await browser?.close(); await host?.close(); });

describe('I01 seed -> physical Worldwalker marker -> explicit Adventure start', () => {
  it('creates a seed through real Journal UI, physically reaches its marker, starts one run, and shows the local hook', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let turnRequests = 0;
    await page.route('**/api/health', (route: Route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, cartographer: 'disabled', model: null })
    }));
    await page.route('**/api/turn', (route: Route) => { turnRequests += 1; return route.abort(); });

    await page.goto(host.url, { waitUntil: 'load' });
    await completeOnboardingIfPresent(page);
    await page.click('[data-testid="enter-encounter"]');
    await page.waitForSelector('[data-testid="convo"]');

    await page.fill('[data-testid="answer-input"]', JOURNAL_TEXT);
    await page.click('[data-testid="save-journal"]');
    await expect.poll(async () => (await readCampaign(page)).journalEntries.length).toBe(1);
    const saved = await readCampaign(page);
    const entry = saved.journalEntries[0];

    await page.click(`[data-testid="journal-explore-${entry.id}"]`);
    await expect.poll(async () => (await readCampaign(page)).knowledgeGaps[0]?.status).toBe('open');
    await page.click(`[data-testid="journal-explore-now-${entry.id}"]`);
    await expect.poll(async () => (await readCampaign(page)).adventureSeeds.length).toBe(1);
    const seeded = await readCampaign(page);
    expect(seeded.adventureSeeds[0]).toMatchObject({
      kind: 'exploration-expedition',
      learningTarget: 'reflection-eligible',
      status: 'available'
    });
    expect(seeded.adventureRuns).toEqual([]);
    expect(turnRequests).toBe(0);

    await page.click('[data-testid="leave-encounter"]');
    await page.waitForSelector('[data-testid="world"]');
    const marker = page.locator('[data-testid="adventure-world-marker"]');
    await marker.waitFor({ state: 'visible' });
    expect(await marker.count()).toBe(1);
    expect(await marker.getAttribute('data-marker-kind')).toBe('adventure');
    expect(await marker.locator('[data-testid="world-marker-adventure"]').getAttribute('aria-label')).toBe('Adventure opportunity');
    const worldTextBefore = await page.textContent('[data-testid="world-stage"]');
    expect(worldTextBefore).not.toContain(JOURNAL_TEXT);
    expect(worldTextBefore).not.toContain(seeded.adventureSeeds[0].premise);
    expect((await readCampaign(page)).adventureRuns).toEqual([]);

    await moveTowardAdventureMarker(page);
    const action = page.locator('[data-testid="interact-action-btn"]');
    expect((await action.locator('.btn-label').textContent())?.trim()).toBe('Start');
    expect(await action.getAttribute('aria-label')).toBe('Interact with Adventure opportunity');

    const reached = await readCampaign(page);
    const protectedBeforeStart = {
      xp: reached.xp,
      level: reached.level,
      turns: reached.turns,
      evidence: reached.evidence,
      reflections: reached.reflections,
      contradictions: reached.contradictions,
      worldJourney: reached.worldJourney,
      bossRuns: reached.bossRuns,
      doorRuns: reached.doorRuns
    };

    // Two explicit activations in the same task prove A01's one-active-run guard.
    await action.evaluate((node) => {
      (node as HTMLButtonElement).click();
      (node as HTMLButtonElement).click();
    });
    await expect.poll(async () => (await readCampaign(page)).adventureRuns.length).toBe(1);
    await expect.poll(async () => (await readCampaign(page)).adventureSeeds[0]?.status).toBe('started');
    await expect.poll(() => marker.count()).toBe(0);

    const started = await readCampaign(page);
    expect(started.adventureRuns).toHaveLength(1);
    expect(started.adventureRuns[0]).toMatchObject({
      seedId: seeded.adventureSeeds[0].id,
      status: 'active',
      currentBeatId: 'local-fallback-investigation:hook'
    });
    expect(started.adventureSeeds[0].status).toBe('started');
    expect(started.xp).toBe(protectedBeforeStart.xp);
    expect(started.level).toBe(protectedBeforeStart.level);
    expect(started.turns).toEqual(protectedBeforeStart.turns);
    expect(started.evidence).toEqual(protectedBeforeStart.evidence);
    expect(started.reflections).toEqual(protectedBeforeStart.reflections);
    expect(started.contradictions).toEqual(protectedBeforeStart.contradictions);
    expect(started.worldJourney).toEqual(protectedBeforeStart.worldJourney);
    expect(started.bossRuns).toEqual(protectedBeforeStart.bossRuns);
    expect(started.doorRuns).toEqual(protectedBeforeStart.doorRuns);
    expect(turnRequests).toBe(0);

    const fallback = page.locator('[data-testid="fallback-adventure"]');
    await fallback.waitFor({ state: 'visible' });
    expect(await page.textContent('[data-testid="fallback-adventure-title"]')).toContain('A small mystery refuses to stay small.');
    const fallbackText = await fallback.textContent();
    expect(fallbackText).not.toContain(JOURNAL_TEXT);
    expect(fallbackText).not.toContain(seeded.adventureSeeds[0].premise);
    expect(fallbackText).toContain('A fictional choice is not evidence about you.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="world"]');
    const reloaded = await readCampaign(page);
    expect(reloaded.adventureSeeds[0].status).toBe('started');
    expect(reloaded.adventureRuns).toHaveLength(1);
    expect(reloaded.adventureRuns[0]).toMatchObject({ status: 'active', currentBeatId: 'local-fallback-investigation:hook' });
    expect(await page.locator('[data-testid="adventure-world-marker"]').count()).toBe(0);
    await page.locator('[data-testid="fallback-adventure"]').waitFor({ state: 'visible' });
    expect(turnRequests).toBe(0);

    await page.context().close();
  }, 120_000);
});
