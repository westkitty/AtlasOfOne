import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, wakeAtlas } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const JOURNAL_TEXT = 'synthetic-i00-journal-canary-never-copy-this';
let browser: Browser;
let host: { url: string; close: () => Promise<void> };

const readCampaign = (page: Page) => page.evaluate(() => new Promise<any>((resolve) => {
  const request = indexedDB.open('atlas-of-one');
  request.onsuccess = () => {
    const get = request.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
    get.onsuccess = () => resolve(get.result?.state ?? null);
  };
}));

async function openBlankJournal(page: Page) {
  await page.click('[data-testid="enter-encounter"]');
  await page.waitForSelector('[data-testid="convo"]');
  expect(await page.isVisible('[data-testid="answer-input"]')).toBe(true);
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run a production build before I00 browser proof').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => { await browser?.close(); await host?.close(); });

describe('I00 Journal -> gap -> explicit AdventureSeed integration', () => {
  it('requires two explicit player actions, creates exactly one seed, persists it, and preserves retirement authority', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let turnRequests = 0;
    await page.route('**/api/health', (route: Route) => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cartographer: 'disabled', model: null })
    }));
    await page.route('**/api/turn', (route: Route) => { turnRequests += 1; return route.abort(); });

    await page.goto(host.url, { waitUntil: 'load' });
    await completeOnboardingIfPresent(page);
    await openBlankJournal(page);

    await page.fill('[data-testid="answer-input"]', JOURNAL_TEXT);
    await page.click('[data-testid="save-journal"]');
    await expect.poll(async () => (await readCampaign(page)).journalEntries.length).toBe(1);
    const saved = await readCampaign(page);
    const entry = saved.journalEntries[0];
    const protectedKeys = ['xp', 'level', 'turns', 'evidence', 'territories', 'quests', 'achievements', 'mapFragments', 'bossRuns', 'doorRuns', 'worldJourney', 'adventureRuns'];
    expect(saved.knowledgeGaps).toEqual([]);
    expect(saved.adventureSeeds).toEqual([]);
    expect(turnRequests).toBe(0);

    const exploreLater = page.locator(`[data-testid="journal-explore-${entry.id}"]`);
    await exploreLater.waitFor({ state: 'visible' });
    expect((await exploreLater.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await exploreLater.click();
    await expect.poll(async () => (await readCampaign(page)).knowledgeGaps[0]?.status).toBe('open');
    const marked = await readCampaign(page);
    expect(marked.adventureSeeds).toEqual([]);
    expect(marked.knowledgeGaps[0]).toMatchObject({
      kind: 'curiosity', priority: 100, sourceJournalEntryIds: [entry.id], sourceEvidenceIds: [], status: 'open'
    });
    expect(marked.journalEntries[0]).toEqual(saved.journalEntries[0]);
    for (const key of protectedKeys) expect(marked[key]).toEqual(saved[key]);
    expect(turnRequests).toBe(0);

    const exploreNow = page.locator(`[data-testid="journal-explore-now-${entry.id}"]`);
    const stopExploring = page.locator(`[data-testid="journal-stop-exploring-${entry.id}"]`);
    await exploreNow.waitFor({ state: 'visible' });
    await stopExploring.waitFor({ state: 'visible' });
    expect((await exploreNow.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    expect((await stopExploring.boundingBox())?.height).toBeGreaterThanOrEqual(44);

    // Two synchronous clicks prove the integration path cannot duplicate a seed.
    await exploreNow.evaluate((node) => {
      (node as HTMLButtonElement).click();
      (node as HTMLButtonElement).click();
    });
    await expect.poll(async () => (await readCampaign(page)).adventureSeeds.length).toBe(1);
    await expect.poll(async () => (await readCampaign(page)).knowledgeGaps[0]?.status).toBe('seeded');

    const seeded = await readCampaign(page);
    expect(seeded.adventureSeeds).toHaveLength(1);
    expect(seeded.adventureSeeds[0]).toMatchObject({
      sourceGapIds: [marked.knowledgeGaps[0].id], kind: 'exploration-expedition',
      learningTarget: 'reflection-eligible', status: 'available'
    });
    expect(seeded.adventureSeeds[0].premise).toContain('An adventure is waiting in');
    expect(seeded.adventureSeeds[0].premise).not.toContain(JOURNAL_TEXT);
    expect(seeded.journalEntries[0]).toEqual(saved.journalEntries[0]);
    for (const key of protectedKeys) expect(seeded[key]).toEqual(saved[key]);
    expect(turnRequests).toBe(0);
    expect(await page.locator(`[data-testid="journal-explore-now-${entry.id}"]`).count()).toBe(0);
    expect(await page.textContent(`[data-testid="journal-exploration-${entry.id}"]`)).toContain('Adventure ready');
    await expect.poll(() => page.textContent('.convo-reply')).toContain('Adventure ready');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="world"]');
    await openBlankJournal(page);
    const reloaded = await readCampaign(page);
    expect(reloaded.adventureSeeds).toHaveLength(1);
    expect(reloaded.adventureSeeds[0].status).toBe('available');
    expect(reloaded.knowledgeGaps[0].status).toBe('seeded');
    expect(await page.textContent(`[data-testid="journal-exploration-${entry.id}"]`)).toContain('Adventure ready');

    const stopAfterReload = page.locator(`[data-testid="journal-stop-exploring-${entry.id}"]`);
    await stopAfterReload.click();
    await expect.poll(async () => (await readCampaign(page)).knowledgeGaps[0]?.status).toBe('retired');
    await expect.poll(async () => (await readCampaign(page)).adventureSeeds[0]?.status).toBe('retired');
    const retired = await readCampaign(page);
    expect(retired.journalEntries[0]).toEqual(saved.journalEntries[0]);
    for (const key of protectedKeys) expect(retired[key]).toEqual(saved[key]);
    expect(turnRequests).toBe(0);
    expect(await page.textContent(`[data-testid="journal-exploration-${entry.id}"]`)).toContain('Not exploring');
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    await page.context().close();
  }, 120_000);
});
