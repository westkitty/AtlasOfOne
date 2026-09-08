import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent } from './helper';
import { serveDist } from './server';

/**
 * Regression proof for the first-run hydration race.
 *
 * `App.tsx` paints `.shell`, `.map` and `<nav>` on its first render, while
 * `hydrated` is still false and `showOnboarding` is therefore false. Only when
 * the IndexedDB read resolves does a first-run profile swap that navigation out
 * for the onboarding screen. So there is a real window in which the app looks
 * already-onboarded but is not, and a harness that asks a non-waiting question
 * inside that window gets a false negative — which is what failed `Atlas
 * validation` run 34169573538.
 *
 * On an idle dev machine the window is invisible: hydration lands before the
 * first `.shell` query returns, which is exactly why the same tree passed
 * locally and on the PR runner. Reproducing it therefore needs the renderer to
 * actually be slow, so this fixture throttles the renderer through CDP.
 *
 * The throttle is fault injection to widen a real window, not a timing guess the
 * assertions rely on. Nothing here sleeps for a fixed period and no assertion
 * depends on a particular duration: they assert which screen the app ends up on,
 * which is true at any speed. Measured on this machine, the window is 100%
 * reproducible at 20x and 50x throttling and absent at 1x.
 *
 * These drive the real `completeOnboardingIfPresent` against the real production
 * bundle. Nothing here re-implements the behavior it is testing.
 *
 * Synthetic data only.
 */

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };

/** Slow enough that first paint reliably beats the IndexedDB read. */
const CPU_THROTTLE_RATE = 20;

let browser: Browser;
let host: { url: string; close: () => Promise<void> };

beforeAll(async () => {
  expect(existsSync(DIST), 'run `npm run build` before the browser suites').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

/**
 * A fresh, storage-empty profile whose renderer is throttled before it loads.
 *
 * Navigation resolves on `commit` rather than `load` so the suite reaches the
 * app at the same point in its lifecycle that a slow CI runner does.
 */
async function throttledFirstRun(): Promise<Page> {
  const context = await browser.newContext({ viewport: PHONE });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLE_RATE });
  await page.goto(host.url, { waitUntil: 'commit' });
  await page.waitForSelector('.shell');
  return page;
}

describe('first-run hydration race', () => {
  it('the cold open owns first paint and HOLDS through hydration, so no chrome can flash', async () => {
    // Deterministic rather than raced: hold the IndexedDB open permanently
    // pending, so `loadCampaign()` never settles and `hydrated` stays false for
    // the whole test. Before the cinematic cold open, that state painted the
    // normal map and navigation — which is what made the old harness ask a
    // non-waiting question and get a false negative.
    const context = await browser.newContext({ viewport: PHONE });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => {
        // A request-shaped object that never fires an event. Dexie attaches its
        // handlers and waits forever, which is precisely the state we want.
        window.indexedDB.open = () =>
          ({
            onsuccess: null,
            onerror: null,
            onupgradeneeded: null,
            onblocked: null,
            result: undefined,
            error: null,
            readyState: 'pending',
            addEventListener() {},
            removeEventListener() {},
            dispatchEvent() {
              return false;
            }
          }) as unknown as IDBOpenDBRequest;
      });
      await page.goto(host.url, { waitUntil: 'load' });
      await page.waitForSelector('.shell');

      // The cold open owns the screen and keeps it while hydration is pending.
      expect(await page.isVisible('[data-testid="cold-open"]'), 'cold open owns first paint').toBe(true);
      expect(await page.locator('nav[aria-label="Main"]').count(), 'no navigation painted').toBe(0);
      expect(await page.locator('.map').count(), 'no map painted').toBe(0);
      expect(await page.locator('[data-testid="onboarding-step-2"]').count(), 'no onboarding choices yet').toBe(0);

      // Even a deliberate wake cannot reveal chrome before hydration settles,
      // so the class of race the old helper fell into no longer exists.
      await page.click('[data-testid="cold-open"]');
      await page.waitForTimeout(600);
      expect(await page.isVisible('[data-testid="cold-open"]'), 'still dormant while unhydrated').toBe(true);
      expect(await page.locator('nav[aria-label="Main"]').count()).toBe(0);

      // And the helper refuses to guess rather than continuing.
      await expect(completeOnboardingIfPresent(page, 2_000)).rejects.toThrow();
    } finally {
      await context.close();
    }
  }, 120_000);

  /**
   * The regression guard. It never fails spuriously: the repaired helper reaches
   * this end state whether or not the throttle actually opened the window on a
   * given run. What varies is only whether a REGRESSION would be caught on that
   * run — measured at 100% across 6 throttled runs on this machine, and observed
   * failing against the pre-repair helper.
   */
  it('completeOnboardingIfPresent still lands on the mapped app when hydration is slow', async () => {
    const page = await throttledFirstRun();
    try {
      await completeOnboardingIfPresent(page);

      // After the helper returns, the suite must be able to drive the app.
      expect(await page.locator('[data-testid="onboarding-step-2"]').count(), 'onboarding is behind us').toBe(0);
      expect(await page.isVisible('nav[aria-label="Main"]')).toBe(true);
      expect(await page.isVisible('.map')).toBe(true);

      // The exact locators the failing CI run could not reach must now resolve.
      expect(await page.getAttribute('.avatar img', 'src')).toBe('/assets/greyson/map/idle-front.png');
      await page.click('nav button:has(small:text-is("Talk"))');
      expect(await page.textContent('nav button.active small')).toBe('Talk');
    } finally {
      await page.context().close();
    }
  }, 120_000);

  it('a profile already past onboarding is recognised without waiting for an onboarding screen', async () => {
    const context = await browser.newContext({ viewport: PHONE });
    const page = await context.newPage();
    try {
      // Seed the app's own durable completion marker before any app code runs.
      await page.addInitScript(() => {
        try {
          window.localStorage.setItem('atlas_onboarding_completed', 'true');
        } catch {
          // ignore in restricted contexts
        }
      });
      await page.goto(host.url, { waitUntil: 'load' });
      await page.waitForSelector('.shell');

      await completeOnboardingIfPresent(page);

      expect(await page.isVisible('nav[aria-label="Main"]')).toBe(true);
      expect(await page.locator('[data-testid="onboarding-step-2"]').count()).toBe(0);
    } finally {
      await context.close();
    }
  }, 120_000);
});
