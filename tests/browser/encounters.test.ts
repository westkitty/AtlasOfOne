import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { availableBosses, availableDoors } from '../../src/game/encounters';
import { serializeCampaign } from '../../src/persistence/transfer';
import { seededCampaign } from '../fixtures/synthetic';
import { completeOnboardingIfPresent, wakeAtlas, navigateTo } from './helper';
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

// The world HUD renders a level pip and a hairline, so progression is read
// from the values it is rendering from rather than a stats panel.
const xpOf = async () => Number(await page.getAttribute('[data-testid="hud-progress"]', 'data-xp'));

async function dismissNotices() {
  // Milestones are brief, non-blocking banners that clear themselves, so this
  // waits them out rather than clicking a modal away.
  if (await page.isVisible('[data-testid="milestone"]').catch(() => false)) {
    await page.locator('[data-testid="milestone"]').waitFor({ state: 'detached', timeout: 20_000 }).catch(() => undefined);
  }
}
async function goto(screen: string) {
  await dismissNotices();
  await navigateTo(page, screen);
}

/**
 * Open the menu that now holds the Boss Fight and Mystery Door offers.
 *
 * Their presentation is unchanged; the world simply owns the screen, so the
 * offers moved off it into the one menu rather than sitting in a card on the map.
 */
async function openOffers() {
  await goto('Map');
  if (!(await page.isVisible('[data-testid="menu"]'))) await page.click('[data-testid="open-menu"]');
  await page.waitForSelector('[data-testid="menu"]', { state: 'visible' });
}

/** Enter an encounter from the world, resuming one already in progress if present. */
async function enterFromMap(offer: string) {
  await goto('Map');
  const resume = '[data-testid="resume-encounter"]';
  if (await page.isVisible(resume)) { await page.click(resume); return; }
  await openOffers();
  await page.locator(offer).first().click();
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
  // Encounter offers live in the menu now; their presentation is unchanged.
  await page.click('[data-testid="open-menu"]');
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
    await openOffers();
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
    await openOffers();
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
    await openOffers();
    expect(await page.isVisible('[data-testid="start-boss-values"]')).toBe(false);
  });
});

describe('Mystery Door in the browser', () => {
  it('opens a cross-territory crossing built from earned evidence', async () => {
    await ensureNoEncounter();
    await openOffers();
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
    await openOffers();
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
    await page.waitForSelector('[data-testid="world"]');
    await expect.poll(xpOf).toBe(before);
    expect(await page.isVisible('[data-testid="start-boss-values"]')).toBe(false);
  });

  it('stays laid out and controllable inside a Door at a 320px viewport', async () => {
    await ensureNoEncounter();
    await page.setViewportSize({ width: 320, height: 640 });
    await openOffers();
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

    // The encounter is its own scrolling layer over the world, so scrolling to
    // the end brings the leave control fully on screen. The panel animates in,
    // so this waits for layout to settle rather than sampling mid-transition.
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    await expect.poll(async () => {
      await page.locator('[data-testid="encounter-leave"]').scrollIntoViewIfNeeded();
      const box = await page.locator('[data-testid="encounter-leave"]').boundingBox();
      return box ? box.y + box.height : Number.MAX_SAFE_INTEGER;
    }, { timeout: 5_000 }).toBeLessThanOrEqual(viewportHeight + 1);

    await page.click('[data-testid="encounter-leave"]');
    await page.setViewportSize({ width: 390, height: 844 });
  });

  it('raises no unhandled page errors across the encounter flows', () => {
    expect(pageErrors).toEqual([]);
  });
});
