import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, wakeAtlas } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const NORMAL_TEXT = 'synthetic-k06-normal-journal-canary';
const PRIVATE_TEXT = 'synthetic-k06-private-journal-canary';
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
  expect(existsSync(DIST), 'run a production build before K06 browser proof').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => { await browser?.close(); await host?.close(); });

describe('K06 explicit Explore later retirement in the production bundle', () => {
  it('opts a Journal entry in, retires that exact path, and persists player authority across reload', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let turnRequests = 0;
    await page.route('**/api/health', (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cartographer: 'disabled', model: null }) }));
    await page.route('**/api/turn', (route: Route) => { turnRequests += 1; return route.abort(); });
    await page.goto(host.url, { waitUntil: 'load' });
    await completeOnboardingIfPresent(page);
    await openBlankJournal(page);

    await page.fill('[data-testid="answer-input"]', NORMAL_TEXT);
    await page.click('[data-testid="save-journal"]');
    await expect.poll(async () => (await readCampaign(page)).journalEntries.length).toBe(1);
    const beforeExplore = await readCampaign(page);
    const normalEntry = beforeExplore.journalEntries[0];
    const progressionKeys = ['xp', 'level', 'turns', 'evidence', 'territories', 'quests', 'achievements', 'mapFragments', 'bossRuns', 'doorRuns', 'worldJourney'];

    const explore = page.locator(`[data-testid="journal-explore-${normalEntry.id}"]`);
    await explore.waitFor({ state: 'visible' });
    const exploreBox = await explore.boundingBox();
    expect(exploreBox?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await explore.click();
    await expect.poll(async () => (await readCampaign(page)).knowledgeGaps.length).toBe(1);

    const explored = await readCampaign(page);
    const curiosity = explored.knowledgeGaps[0];
    expect(curiosity).toMatchObject({ kind: 'curiosity', status: 'open', priority: 100, sourceJournalEntryIds: [normalEntry.id] });
    expect(curiosity.sourceEvidenceIds).toEqual([]);
    expect(explored.journalEntries[0]).toEqual(beforeExplore.journalEntries[0]);
    for (const key of progressionKeys) expect(explored[key]).toEqual(beforeExplore[key]);
    expect(turnRequests).toBe(0);
    await expect.poll(() => page.textContent('.convo-reply')).toContain('Saved for later exploration.');

    const stopExploring = page.locator(`[data-testid="journal-stop-exploring-${normalEntry.id}"]`);
    await stopExploring.waitFor({ state: 'visible' });
    expect((await stopExploring.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await stopExploring.click();
    await expect.poll(async () => (await readCampaign(page)).knowledgeGaps[0]?.status).toBe('retired');

    const retired = await readCampaign(page);
    expect(retired.knowledgeGaps[0]).toMatchObject({ id: curiosity.id, status: 'retired', priority: 100, sourceJournalEntryIds: [normalEntry.id] });
    expect(retired.journalEntries[0]).toEqual(beforeExplore.journalEntries[0]);
    for (const key of progressionKeys) expect(retired[key]).toEqual(beforeExplore[key]);
    expect(turnRequests).toBe(0);
    await expect.poll(() => page.textContent('.convo-reply')).toContain('The entry stays in your journal.');
    expect(await page.textContent(`[data-testid="journal-exploration-${normalEntry.id}"]`)).toContain('Not exploring');
    expect(await page.locator(`[data-testid="journal-explore-${normalEntry.id}"]`).count()).toBe(0);
    expect(await page.locator(`[data-testid="journal-stop-exploring-${normalEntry.id}"]`).count()).toBe(0);

    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="world"]');
    await openBlankJournal(page);
    expect((await readCampaign(page)).knowledgeGaps[0].status).toBe('retired');
    expect(await page.textContent(`[data-testid="journal-exploration-${normalEntry.id}"]`)).toContain('Not exploring');

    await page.fill('[data-testid="answer-input"]', PRIVATE_TEXT);
    await page.click('[data-testid="journal-private-draft"]');
    await page.click('[data-testid="save-journal"]');
    await expect.poll(async () => (await readCampaign(page)).journalEntries.length).toBe(2);
    const withPrivate = await readCampaign(page);
    const privateEntry = withPrivate.journalEntries.find((entry: any) => entry.text === PRIVATE_TEXT);
    expect(privateEntry).toMatchObject({ privacy: 'private', status: 'active' });
    expect(await page.locator(`[data-testid="journal-explore-${privateEntry.id}"]`).count()).toBe(0);
    expect(await page.locator(`[data-testid="journal-stop-exploring-${privateEntry.id}"]`).count()).toBe(0);
    expect(turnRequests).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    await page.context().close();
  }, 120_000);
});
