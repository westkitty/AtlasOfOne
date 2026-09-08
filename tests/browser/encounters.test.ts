import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { availableBosses, availableDoors } from '../../src/game/encounters';
import { serializeCampaign } from '../../src/persistence/transfer';
import { seededCampaign } from '../fixtures/synthetic';
import { completeOnboardingIfPresent, wakeAtlas } from './helper';
import { serveDist } from './server';

/**
 * Real-browser proof that Boss Fights and Mystery Doors are playable and that the
 * permanent controls survive inside them. A synthetic campaign is imported through
 * the app's own import path so the encounters are reachable without 40 manual turns.
 */

const DIST = join(process.cwd(), 'dist', 'client');
const SYNTHETIC = 'Synthetic position recorded for browser verification: the mapped commitment wins, and the cost is a slower decision.';

let browser: Browser;
let page: Page;
let host: { url: string; close: () => Promise<void> };
const pageErrors: string[] = [];

const xpOf = async () => Number((await page.textContent('.xp span'))!.replace(/\D/g, ''));

async function dismissNotices() {
  while (await page.isVisible('.overlay')) await page.click('.overlay button:text("Continue")');
}
async function goto(screen: string) {
  await dismissNotices();
  await page.click(`nav button:has(small:text-is("${screen}"))`);
}

/** Enter an encounter from the Map, resuming one already in progress if present. */
async function enterFromMap(offer: string) {
  await goto('Map');
  const resume = '[data-testid="resume-encounter"]';
  if (await page.isVisible(resume)) await page.click(resume);
  else await page.locator(offer).first().click();
}

/** Leave whatever encounter is running so the Map shows fresh offers again. */
async function ensureNoEncounter() {
  await goto('Map');
  if (await page.isVisible('[data-testid="resume-encounter"]')) {
    await page.click('[data-testid="resume-encounter"]');
    await page.click('[data-testid="encounter-leave"]');
    await goto('Map');
  }
}

/** Import a synthetic campaign that already has encounters available. */
async function loadSeed() {
  const seed = seededCampaign({ territories: ['identity', 'values', 'cognition'], xp: 700 });
  expect(availableBosses(seed).length).toBeGreaterThan(0);
  expect(availableDoors(seed).length).toBeGreaterThan(0);

  await goto('Me');
  await page.setInputFiles('.file input', {
    name: 'synthetic.atlas.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeCampaign(seed))
  });
  await page.waitForSelector('.toast:text-matches("imported and validated")');
  await goto('Map');
  await page.waitForSelector('[data-testid="encounter-offers"]');
  return seed;
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run `npm run build` before the browser journey').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror', (error: Error) => pageErrors.push(error.message));
  await page.goto(host.url, { waitUntil: 'load' });
  await page.waitForSelector('.shell');
  await wakeAtlas(page);
  await completeOnboardingIfPresent(page);
  await loadSeed();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('Boss Fight in the browser', () => {
  it('is offered from mapped state and opens a staged encounter', async () => {
    await goto('Map');
    await page.click('[data-testid="start-boss-values"]');
    await page.waitForSelector('[data-testid="encounter-boss"]');
    expect(await page.textContent('.eyebrow')).toBe('BOSS FIGHT');
    expect(await page.textContent('header p')).toContain('Stage 1 of 3');
    // The stage cites evidence the player already produced.
    expect(await page.locator('.evidence-list li').count()).toBeGreaterThan(0);
  });

  it('keeps every permanent control available inside the fight', async () => {
    for (const control of ['pass', 'private', 'stop', 'serious', 'help', 'sass']) {
      expect(await page.isVisible(`[data-testid="agency-${control}"]`)).toBe(true);
      expect(await page.isDisabled(`[data-testid="agency-${control}"]`)).toBe(false);
    }
    expect(await page.isVisible('[data-testid="encounter-leave"]')).toBe(true);
  });

  it('honours STOP inside the fight and resumes cleanly', async () => {
    await page.click('[data-testid="agency-stop"]');
    await page.waitForSelector('.quiet:text-matches("Session paused")');
    expect(await page.isDisabled('[data-testid="encounter-input"]')).toBe(true);
    expect(await page.isDisabled('[data-testid="encounter-submit"]')).toBe(true);
    await page.click('[data-testid="agency-stop"]');
    await expect.poll(() => page.isDisabled('[data-testid="encounter-input"]')).toBe(false);
  });

  it('lets the player step back without losing stage progress', async () => {
    await page.click('[data-testid="encounter-leave"]');
    await page.waitForSelector('.answer textarea');
    await goto('Map');
    // The offer now advertises a kept run rather than a fresh start.
    await expect.poll(() => page.textContent('[data-testid="start-boss-values"]')).toContain('Resume:');
    await expect.poll(() => page.textContent('[data-testid="start-boss-values"]')).toContain('Stage 1 of 3');
    await page.click('[data-testid="start-boss-values"]');
    await page.waitForSelector('[data-testid="encounter-boss"]');
    expect(await page.textContent('header p')).toContain('Stage 1 of 3');
  });

  it('advances stages and awards the fixed reward on completion', async () => {
    const before = await (async () => { await goto('Map'); return xpOf(); })();
    await enterFromMap('[data-testid="start-boss-values"]');
    await page.waitForSelector('[data-testid="encounter-boss"]');

    await page.fill('[data-testid="encounter-input"]', SYNTHETIC);
    await page.click('[data-testid="encounter-submit"]');
    await expect.poll(() => page.textContent('header p')).toContain('Stage 2 of 3');

    // PASS resolves a stage at no cost and never traps the player.
    await page.click('[data-testid="agency-pass"]');
    await expect.poll(() => page.textContent('header p')).toContain('Stage 3 of 3');
    await page.click('[data-testid="agency-pass"]');

    await page.waitForSelector('.answer textarea');
    await goto('Map');
    // stage answer (5 + 3 developed) + the boss-values fixed reward of 40
    await expect.poll(xpOf).toBe(before + 8 + 40);
    await goto('Vault');
    await expect.poll(() => page.textContent('.screen')).toContain('Held the Line');
  });

  it('does not offer a resolved Boss Fight again', async () => {
    await goto('Map');
    expect(await page.isVisible('[data-testid="start-boss-values"]')).toBe(false);
  });
});

describe('Mystery Door in the browser', () => {
  it('opens a cross-territory crossing built from earned evidence', async () => {
    await ensureNoEncounter();
    await page.locator('[data-testid^="open-door_"]').first().click();
    await page.waitForSelector('[data-testid="encounter-door"]');
    expect(await page.textContent('.eyebrow')).toBe('MYSTERY DOOR');
    expect(await page.locator('.evidence-list li').count()).toBeGreaterThan(0);
    expect(await page.textContent('.encounter h2')).toContain('Two mapped regions touch here');
  });

  it('keeps every permanent control available inside the door', async () => {
    for (const control of ['pass', 'private', 'stop', 'serious', 'help', 'sass']) {
      expect(await page.isVisible(`[data-testid="agency-${control}"]`)).toBe(true);
      expect(await page.isDisabled(`[data-testid="agency-${control}"]`)).toBe(false);
    }
  });

  it('can be closed and reopened without penalty', async () => {
    await goto('Map');
    const before = await xpOf();
    await enterFromMap('[data-testid^="open-door_"]');
    await page.waitForSelector('[data-testid="encounter-door"]');
    await page.click('[data-testid="encounter-leave"]');
    await page.waitForSelector('.answer textarea');
    await goto('Map');
    expect(await xpOf()).toBe(before);
    expect(await page.locator('[data-testid^="open-door_"]').count()).toBeGreaterThan(0);
  });

  it('awards its fixed reward and records a crossing insight on completion', async () => {
    await goto('Map');
    const before = await xpOf();
    await enterFromMap('[data-testid^="open-door_"]');
    await page.waitForSelector('[data-testid="encounter-door"]');
    await page.fill('[data-testid="encounter-input"]', SYNTHETIC);
    await page.click('[data-testid="encounter-submit"]');

    await page.waitForSelector('.answer textarea');
    await goto('Map');
    // crossing answer (5 + 3 developed) + the fixed door reward of 20
    await expect.poll(xpOf).toBe(before + 8 + 20);
    await goto('Vault');
    await expect.poll(() => page.textContent('.screen')).toContain('Crossing:');
    await expect.poll(() => page.textContent('.screen')).toContain('Door Opener');
  });

  it('survives a reload with encounter results intact', async () => {
    await goto('Map');
    const before = await xpOf();
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('.map');
    await expect.poll(xpOf).toBe(before);
    expect(await page.isVisible('[data-testid="start-boss-values"]')).toBe(false);
  });

  it('stays laid out and controllable inside a Door at a 320px viewport', async () => {
    await ensureNoEncounter();
    await page.setViewportSize({ width: 320, height: 640 });
    await page.locator('[data-testid^="open-door_"]').first().click();
    await page.waitForSelector('[data-testid="encounter-door"]');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, 'no horizontal overflow in a Door at 320px').toBeLessThanOrEqual(0);

    // The long crossing question must not spill past the viewport edge.
    const questionOverflow = await page.evaluate(() => {
      const h2 = document.querySelector('.encounter h2') as HTMLElement;
      return h2.getBoundingClientRect().right - document.documentElement.clientWidth;
    });
    expect(questionOverflow).toBeLessThanOrEqual(0);

    // Permanent controls remain usable inside the encounter at this width.
    for (const control of ['pass', 'private', 'stop', 'serious', 'help', 'sass']) {
      const box = (await page.locator(`[data-testid="agency-${control}"]`).boundingBox())!;
      expect(box.height, `${control} height`).toBeGreaterThanOrEqual(44);
    }

    // Scrolled to the end, the leave control clears the fixed bottom nav.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const leave = (await page.locator('[data-testid="encounter-leave"]').boundingBox())!;
    const navBox = (await page.locator('nav').boundingBox())!;
    expect(leave.y + leave.height).toBeLessThanOrEqual(navBox.y + 1);

    await page.click('[data-testid="encounter-leave"]');
    await page.setViewportSize({ width: 390, height: 844 });
  });

  it('raises no unhandled page errors across the encounter flows', () => {
    expect(pageErrors).toEqual([]);
  });
});
