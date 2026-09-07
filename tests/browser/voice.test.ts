import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };

let browser: Browser;
let page: Page;
let host: { url: string; close: () => Promise<void> };
const pageErrors: string[] = [];

beforeAll(async () => {
  expect(existsSync(DIST), 'run `npm run build` before browser tests').toBe(true);
  host = await serveDist(DIST);

  browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  page = await browser.newPage({ viewport: PHONE });
  page.on('pageerror', (err) => pageErrors.push(err.message));
  await page.goto(host.url, { waitUntil: 'networkidle' });
});

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('browser voice mode and access gate', () => {
  it('loads cleanly and navigates to Talk screen', async () => {
    await page.click('nav button:has(small:text-is("Talk"))');
    await page.waitForSelector('.screen .screen-title');
    expect(await page.textContent('.screen-title')).toMatch(/the cartographer/i);
  });

  it('provides Type and Talk mode tabs with >=44px touch targets', async () => {
    const typeBtn = page.locator('[data-testid="mode-type"]');
    const talkBtn = page.locator('[data-testid="mode-talk"]');

    expect(await typeBtn.isVisible()).toBe(true);
    expect(await talkBtn.isVisible()).toBe(true);

    const typeBox = await typeBtn.boundingBox();
    const talkBox = await talkBtn.boundingBox();
    expect(typeBox?.height).toBeGreaterThanOrEqual(44);
    expect(talkBox?.height).toBeGreaterThanOrEqual(44);
  });

  it('switches to Talk mode and presents the voice interaction surface', async () => {
    await page.click('[data-testid="mode-talk"]');
    await page.waitForSelector('[data-testid="voice-card"]');

    const statusBadge = page.locator('[data-testid="voice-status"]');
    expect(await statusBadge.isVisible()).toBe(true);
    expect(await statusBadge.textContent()).toBe('Ready');

    const micBtn = page.locator('[data-testid="mic-button"]');
    expect(await micBtn.isVisible()).toBe(true);
    const micBox = await micBtn.boundingBox();
    expect(micBox?.width).toBeGreaterThanOrEqual(44);
    expect(micBox?.height).toBeGreaterThanOrEqual(44);
  });

  it('keeps all permanent agency controls available in voice mode', async () => {
    const agency = page.locator('[data-testid="agency"]');
    expect(await agency.isVisible()).toBe(true);

    for (const testId of ['agency-pass', 'agency-private', 'agency-stop', 'agency-serious', 'agency-help', 'agency-sass']) {
      const btn = page.locator(`[data-testid="${testId}"]`);
      expect(await btn.isVisible()).toBe(true);
      const box = await btn.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
  });

  it('has zero horizontal overflow on voice Talk screen at 320px viewport', async () => {
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.setViewportSize(PHONE);
  });

  it('manages access secret in Me screen', async () => {
    await page.click('nav button:has(small:text-is("Me"))');
    await page.waitForSelector('[data-testid="access-secret-input"]');

    const input = page.locator('[data-testid="access-secret-input"]');
    const saveBtn = page.locator('[data-testid="save-access-secret"]');

    await input.fill('playwright-test-token');
    await saveBtn.click();

    const toast = page.locator('.toast');
    await toast.waitFor({ state: 'visible' });
    expect(await toast.textContent()).toMatch(/access code saved/i);

    const clearBtn = page.locator('[data-testid="clear-access-secret"]');
    expect(await clearBtn.isVisible()).toBe(true);
    await clearBtn.click();
    await toast.waitFor({ state: 'visible' });
    expect(await toast.textContent()).toMatch(/access code cleared/i);
  });

  it('switches back to Type mode seamlessly', async () => {
    await page.click('nav button:has(small:text-is("Talk"))');
    await page.click('[data-testid="mode-type"]');
    await page.waitForSelector('[data-testid="answer-input"]');
    expect(await page.locator('[data-testid="answer-input"]').isVisible()).toBe(true);
  });

  it('executes without any uncaught page errors', () => {
    expect(pageErrors).toEqual([]);
  });
});
