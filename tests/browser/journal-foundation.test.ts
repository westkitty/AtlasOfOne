import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, wakeAtlas } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const SYNTHETIC = 'synthetic-journal-browser-canary: a note with no question before it.';
let browser: Browser;
let host: { url: string; close: () => Promise<void> };

const readCampaign = (page: Page) => page.evaluate(() => new Promise<any>((resolve) => {
  const request = indexedDB.open('atlas-of-one');
  request.onsuccess = () => {
    const transaction = request.result.transaction('campaigns', 'readonly');
    const get = transaction.objectStore('campaigns').get('active');
    get.onsuccess = () => resolve(get.result?.state ?? null);
  };
}));

async function openBlankJournal(page: Page) {
  await page.click('[data-testid="enter-encounter"]');
  await page.waitForSelector('[data-testid="convo"]');
  expect(await page.isVisible('[data-testid="answer-input"]')).toBe(true);
  expect(await page.locator('[data-testid="prompt-question"]').count()).toBe(0);
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run a production build before this suite').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => { await browser?.close(); await host?.close(); });

describe('J00-J08 Journal foundation in the production bundle', () => {
  it('opens blank in one action, saves locally with zero progression, and survives reload', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let turnRequests = 0;
    await page.route('**/api/health', (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cartographer: 'workers-ai', model: 'synthetic-model' }) }));
    await page.route('**/api/turn', (route: Route) => { turnRequests += 1; return route.abort(); });
    await page.goto(host.url, { waitUntil: 'load' });
    await completeOnboardingIfPresent(page);
    const before = await readCampaign(page);
    await openBlankJournal(page);
    await page.fill('[data-testid="answer-input"]', SYNTHETIC);
    await page.click('[data-testid="save-journal"]');
    await expect.poll(() => page.textContent('.convo-reply')).toContain('Saved locally.');
    const saved = await readCampaign(page);
    expect(saved.journalEntries).toHaveLength(1);
    expect(saved.journalEntries[0]).toMatchObject({ text: SYNTHETIC, inputMode: 'typed', privacy: 'normal', status: 'active' });
    for (const key of ['xp', 'level', 'turns', 'evidence', 'territories', 'quests', 'achievements', 'mapFragments', 'bossRuns', 'doorRuns', 'worldJourney']) expect(saved[key]).toEqual(before[key]);
    expect(turnRequests).toBe(0);
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="world"]');
    await openBlankJournal(page);
    expect(await page.textContent('[data-testid="journal-history"]')).toContain(SYNTHETIC);
    await page.context().close();
  }, 120_000);

  it('keeps privacy/retraction visible in Journal and makes optional prompting explicit', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    let turnRequests = 0;
    await page.route('**/api/health', (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cartographer: 'workers-ai', model: 'synthetic-model' }) }));
    await page.route('**/api/turn', (route: Route) => { turnRequests += 1; return route.abort(); });
    await page.goto(host.url, { waitUntil: 'load' });
    await completeOnboardingIfPresent(page);
    await openBlankJournal(page);
    const beforePrompt = await readCampaign(page);
    await page.click('[data-testid="request-prompt"]');
    expect(await page.isVisible('[data-testid="prompt-question"]')).toBe(true);
    expect(await readCampaign(page)).toEqual(beforePrompt);
    await page.fill('[data-testid="answer-input"]', 'synthetic private journal canary');
    await page.click('[data-testid="journal-private-draft"]');
    expect(await page.isDisabled('[data-testid="submit-answer"]')).toBe(true);
    expect(await page.textContent('#journal-private-map-note')).toContain('stay local');
    expect(turnRequests).toBe(0);
    await page.click('[data-testid="save-journal"]');
    const saved = await readCampaign(page);
    expect(saved.journalEntries[0]).toMatchObject({ privacy: 'private', sourcePrompt: expect.any(String) });
    await page.locator('[data-testid^="journal-retract-"]').click();
    const retracted = await readCampaign(page);
    expect(retracted.journalEntries[0]).toMatchObject({ text: 'synthetic private journal canary', status: 'retracted' });
    expect(await page.textContent('[data-testid="journal-history"]')).toContain('Retracted');
    await page.context().close();
  }, 120_000);

  it('keeps legacy prompted mapping available as an explicit secondary path', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/api/health', (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cartographer: 'disabled', model: null }) }));
    await page.goto(host.url, { waitUntil: 'load' });
    await completeOnboardingIfPresent(page);
    await openBlankJournal(page);
    const before = await readCampaign(page);
    await page.click('[data-testid="request-prompt"]');
    await page.fill('[data-testid="answer-input"]', 'Synthetic explicit mapping answer with enough detail to exercise the existing deterministic route.');
    await page.click('[data-testid="submit-answer"]');
    await expect.poll(async () => (await readCampaign(page)).turns.length).toBe(before.turns.length + 1);
    const after = await readCampaign(page);
    expect(after.journalEntries).toHaveLength(before.journalEntries.length);
    expect(after.xp).toBeGreaterThan(before.xp);
    await page.context().close();
  }, 120_000);

  it('has no Journal horizontal overflow at 320px or 390px', async () => {
    const page = await browser.newPage({ viewport: { width: 320, height: 720 } });
    await page.goto(host.url, { waitUntil: 'load' });
    await completeOnboardingIfPresent(page);
    await openBlankJournal(page);
    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 720 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
      for (const selector of ['[data-testid="save-journal"]', '[data-testid="request-prompt"]']) {
        const box = await page.locator(selector).boundingBox();
        expect(box?.height).toBeGreaterThanOrEqual(44);
      }
    }
    await page.context().close();
  }, 120_000);
});
