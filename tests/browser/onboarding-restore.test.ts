import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serializeCampaign } from '../../src/persistence/transfer';
import { seededCampaign } from '../fixtures/synthetic';
import { wakeAtlas } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
let browser: Browser;
let host: { url: string; close: () => Promise<void> };

beforeAll(async () => {
  expect(existsSync(DIST), 'run a production build first').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => { await browser?.close(); await host?.close(); });

describe('UNV-023: restore before first-run onboarding', () => {
  it('a brand-new profile can restore a saved Atlas from onboarding and lands in the world, not a fresh start', async () => {
    const context = await browser.newContext({ viewport: { width: 320, height: 640 } });
    const page = await context.newPage();
    await page.goto(host.url, { waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="onboarding-step-2"]');
    const restore = page.locator('[data-testid="onboarding-restore"]');
    expect(await restore.isVisible()).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);

    const saved = { ...seededCampaign({ territories: ['identity'] }), onboardingCompleted: true };
    await restore.locator('input').setInputFiles({ name: 'synthetic.atlas.json', mimeType: 'application/json', buffer: Buffer.from(serializeCampaign(saved)) });
    await page.waitForSelector('[data-testid="onboarding-step-2"]', { state: 'detached' });
    await page.waitForSelector('[data-testid="world"]');
    await expect.poll(() => page.evaluate(() => new Promise<string | null>((resolve) => {
      const open = indexedDB.open('atlas-of-one');
      open.onsuccess = () => {
        const get = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
        get.onsuccess = () => resolve(get.result?.state?.campaignId ?? null);
      };
    }))).toBe(saved.campaignId);

    // A malformed file is rejected without leaving onboarding or losing anything.
    const fresh = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const second = await fresh.newPage();
    await second.goto(host.url, { waitUntil: 'load' });
    await wakeAtlas(second);
    await second.waitForSelector('[data-testid="onboarding-step-2"]');
    await second.locator('[data-testid="onboarding-restore"] input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"not":"an atlas"}') });
    await second.waitForSelector('.toast:text-matches("Import rejected")');
    expect(await second.locator('[data-testid="onboarding-step-2"]').isVisible()).toBe(true);
    await fresh.close();
    await context.close();
  }, 120_000);
});
