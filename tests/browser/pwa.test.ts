import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };

let host: { url: string; close: () => Promise<void> };
let browser: Browser;
let page: Page;
const pageErrors: string[] = [];

const xpOf = async () => {
  await goto('Map');
  return Number((await page.textContent('.xp span'))!.replace(/\D/g, ''));
};

async function dismissNotices() {
  while (await page.isVisible('.overlay')) await page.click('.overlay button:text("Continue")');
}

async function goto(screen: string) {
  await dismissNotices();
  await page.click(`nav button:has(small:text-is("${screen}"))`);
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run `npm run build` before PWA tests').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: PHONE });
  page.on('pageerror', (error: Error) => pageErrors.push(error.message));
  await page.goto(host.url, { waitUntil: 'load' });
  await page.waitForSelector('.shell');
  await completeOnboardingIfPresent(page);
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('PWA manifest and service worker assets', () => {
  it('serves a valid web manifest with expected PWA metadata', async () => {
    const res = await fetch(`${host.url}/manifest.webmanifest`);
    expect(res.status).toBe(200);
    const manifest = await res.json() as Record<string, any>;
    expect(manifest.name).toBe('Atlas of One');
    expect(manifest.short_name).toBe('Atlas');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#10151f');
    expect(manifest.background_color).toBe('#10151f');
    expect(manifest.orientation).toBe('portrait-primary');
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);
    expect(manifest.icons[0].src).toContain('atlas.svg');
  });

  it('serves the service worker and registration scripts', async () => {
    const swRes = await fetch(`${host.url}/sw.js`);
    expect(swRes.status).toBe(200);
    const swText = await swRes.text();
    expect(swText).toContain('workbox');

    const regRes = await fetch(`${host.url}/registerSW.js`);
    expect(regRes.status).toBe(200);
  });
});

describe('Offline runtime behavior and recovery', () => {
  it('displays a clear offline status indicator when connection drops', async () => {
    await page.context().setOffline(true);
    await page.evaluate(() => window.dispatchEvent(new Event('offline')));
    await page.waitForSelector('[data-testid="offline-indicator"]');
    expect(await page.textContent('[data-testid="offline-indicator"]')).toBe('Offline');
    const toast = await page.textContent('.toast');
    expect(toast).toContain('Offline');
  });

  it('navigates screens and remains usable offline', async () => {
    // Map -> Talk
    await goto('Talk');
    await page.waitForSelector('article.prompt');
    expect(await page.isVisible('[data-testid="offline-indicator"]')).toBe(true);

    // Talk -> Vault
    await goto('Vault');
    await page.waitForSelector('.vault-section');

    // Vault -> Me
    await goto('Me');
    await page.waitForSelector('.danger-zone');

    // Return to Talk
    await goto('Talk');
    await page.waitForSelector('article.prompt');
  });

  it('accepts answers locally and persists progress without network', async () => {
    const xpBefore = await xpOf();
    await goto('Talk');
    await page.fill('.answer textarea', 'Synthetic coordinate mapped entirely while offline.');
    await page.click('button:text("Map this answer")');
    await dismissNotices();
    const xpAfter = await xpOf();
    expect(xpAfter).toBeGreaterThan(xpBefore);
  });

  it('recovers cleanly when connection returns without state loss', async () => {
    const xpBefore = await xpOf();
    await page.context().setOffline(false);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));

    await page.waitForFunction(() => !document.querySelector('[data-testid="offline-indicator"]'));
    expect(await page.locator('[data-testid="offline-indicator"]').count()).toBe(0);

    const xpAfter = await xpOf();
    expect(xpAfter).toBe(xpBefore);

    // Full page reload to prove local IndexedDB restored all offline progress
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.shell');
    const xpReloaded = await xpOf();
    expect(xpReloaded).toBe(xpBefore);
  });

  it('incurred zero uncaught page errors during offline lifecycle', () => {
    expect(pageErrors).toEqual([]);
  });
});
