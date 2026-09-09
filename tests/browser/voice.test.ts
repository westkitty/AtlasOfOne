import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, openAgency, navigateTo } from './helper';
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
  await completeOnboardingIfPresent(page);
});

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('browser voice mode and access gate', () => {
  it('loads cleanly and navigates to Talk screen', async () => {
    await navigateTo(page, 'Talk');
    // The conversation is a layer over the world, so the speaker is named there.
    await page.waitForSelector('.convo-speaker');
    expect(await page.textContent('.convo-speaker')).toMatch(/the cartographer/i);
  });

  it('offers the other input mode as a real touch target, in both directions', async () => {
    // Only the mode you are NOT in is offered: a tab for the mode you are
    // already using is chrome the conversation does not need.
    const talkBtn = page.locator('[data-testid="mode-talk"]');
    expect(await talkBtn.isVisible(), 'Speak instead is offered while typing').toBe(true);
    expect(await page.locator('[data-testid="mode-type"]').isVisible()).toBe(false);
    expect((await talkBtn.boundingBox())?.height).toBeGreaterThanOrEqual(44);

    await talkBtn.click();
    await page.waitForSelector('[data-testid="voice-card"]');
    const typeBtn = page.locator('[data-testid="mode-type"]');
    expect(await typeBtn.isVisible(), 'Type instead is offered while speaking').toBe(true);
    expect((await typeBtn.boundingBox())?.height).toBeGreaterThanOrEqual(44);

    await typeBtn.click();
    await page.waitForSelector('[data-testid="answer-input"]');
  });

  it('switches to Talk mode and presents a usable voice surface', async () => {
    await page.click('[data-testid="mode-talk"]');
    await page.waitForSelector('[data-testid="voice-card"]');

    // This suite runs WITHOUT synthetic media, so it deliberately proves only
    // that Talk mode is reachable and legible on a machine that may have no
    // microphone at all — the state it settles into depends on the host, and
    // asserting a particular one here would be testing the runner. The
    // conversational loop itself is proven against stubbed media primitives in
    // `voice-conversation.test.ts`.
    const statusBadge = page.locator('[data-testid="voice-status"]');
    expect(await statusBadge.isVisible()).toBe(true);
    expect((await statusBadge.textContent())?.trim()).toBeTruthy();

    // Whatever happens to the microphone, typing must remain one tap away.
    expect(await page.locator('[data-testid="mode-type"]').count()).toBe(1);
  });

  it('keeps all permanent agency controls available in voice mode', async () => {
    // PASS sits on the primary row alongside any earned game moves.
    const pass = page.locator('[data-testid="agency-pass"]');
    expect(await pass.isVisible()).toBe(true);
    expect((await pass.boundingBox())?.height).toBeGreaterThanOrEqual(44);

    // The rest are one interaction away and still never progression-gated.
    await openAgency(page);
    expect(await page.locator('[data-testid="agency"]').isVisible()).toBe(true);
    for (const testId of ['agency-private', 'agency-stop', 'agency-serious', 'agency-help', 'agency-sass']) {
      const btn = page.locator(`[data-testid="${testId}"]`);
      expect(await btn.isVisible(), testId).toBe(true);
      expect(await btn.isDisabled(), testId).toBe(false);
      const box = await btn.boundingBox();
      expect(box?.height, testId).toBeGreaterThanOrEqual(44);
    }
    await page.click('[data-testid="more-close"]');
  });

  it('has zero horizontal overflow on voice Talk screen at 320px viewport', async () => {
    await page.setViewportSize({ width: 320, height: 640 });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.setViewportSize(PHONE);
  });

  it('manages access secret in Me screen', async () => {
    await navigateTo(page, 'Me');
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
    await navigateTo(page, 'Talk');
    await page.click('[data-testid="mode-type"]');
    await page.waitForSelector('[data-testid="answer-input"]');
    expect(await page.locator('[data-testid="answer-input"]').isVisible()).toBe(true);
  });

  it('executes without any uncaught page errors', () => {
    expect(pageErrors).toEqual([]);
  });
});
