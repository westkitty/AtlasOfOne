import { openAgency, wakeAtlas } from './helper';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 640 };

let browser: Browser;
let page: Page;
let host: { url: string; close: () => Promise<void> };

beforeAll(async () => {
  expect(existsSync(DIST), 'run npm run build first').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: PHONE });
  await page.goto(host.url, { waitUntil: 'load' });
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases?.() ?? [];
    for (const db of dbs) {
      if (db.name) indexedDB.deleteDatabase(db.name);
    }
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.shell');
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('Phase 6 minimal canonical onboarding browser proof', () => {
  it('1. a dormant launch shows no chrome, no branding and no instruction', async () => {
    await page.waitForSelector('[data-testid="cold-open"]');
    expect(await page.isVisible('[data-testid="cold-open"]')).toBe(true);

    // Step 1 IS the wake. Nothing legible may appear before engagement — no
    // application chrome, and no name, tagline or instruction either.
    expect(await page.locator('nav[aria-label="Main"]').count()).toBe(0);
    expect(await page.locator('h1').count(), 'no title before engagement').toBe(0);
    const visibleText = (await page.textContent('.shell'))?.trim() ?? '';
    expect(visibleText, 'the dormant screen carries no copy at all').toBe('');

    // Only the faint environmental mark remains, and it is not a control.
    expect(await page.locator('.cold-open-mark').count()).toBe(1);
  });

  it('2. 320px viewport has zero horizontal overflow during onboarding', async () => {
    await page.setViewportSize(NARROW);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
    await page.setViewportSize(PHONE);
  });

  it('3. critical targets are >= 44px on onboarding screens', async () => {
    const beginBtn = page.locator('[data-testid="cold-open"]');
    const box = await beginBtn.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  });

  it('3b. waking reveals the identity, then hands over to Atlas', async () => {
    await page.click('[data-testid="cold-open"]');
    // Identity is discovered by waking it, not presented beforehand.
    await page.waitForSelector('.cold-open-title', { timeout: 5_000 });
    expect(await page.textContent('.cold-open-title')).toBe('Atlas of One');
    expect(await page.textContent('.cold-open-sub')).toBe('The Greyson Map');
    await page.waitForSelector('[data-testid="onboarding-step-2"]', { timeout: 10_000 });
  });

  it('4. Atlas is on Screen 2 after waking, with no second Begin', async () => {
    await page.waitForSelector('[data-testid="onboarding-step-2"]');
    expect(await page.textContent('h2')).toContain('Cartographer Sass');
    expect(await page.isVisible('[data-testid="onboarding-sass-low"]')).toBe(true);
    expect(await page.isVisible('[data-testid="onboarding-sass-medium"]')).toBe(true);
    expect(await page.isVisible('[data-testid="onboarding-sass-risks"]')).toBe(true);
  });

  it('5. all three sass choices can be selected and update active state', async () => {
    await page.click('[data-testid="onboarding-sass-low"]');
    expect(await page.getAttribute('[data-testid="onboarding-sass-low"]', 'aria-pressed')).toBe('true');
    expect(await page.getAttribute('[data-testid="onboarding-sass-medium"]', 'aria-pressed')).toBe('false');

    await page.click('[data-testid="onboarding-sass-risks"]');
    expect(await page.getAttribute('[data-testid="onboarding-sass-risks"]', 'aria-pressed')).toBe('true');
    expect(await page.getAttribute('[data-testid="onboarding-sass-low"]', 'aria-pressed')).toBe('false');

    await page.click('[data-testid="onboarding-sass-medium"]');
    expect(await page.getAttribute('[data-testid="onboarding-sass-medium"]', 'aria-pressed')).toBe('true');
  });

  it('6. Screen 2 advances to Screen 3: Interaction mode (Talk / Type)', async () => {
    await page.click('[data-testid="onboarding-next-sass"]');
    await page.waitForSelector('[data-testid="onboarding-step-3"]');
    expect(await page.textContent('h2')).toContain('Interaction Mode');
    expect(await page.isVisible('[data-testid="onboarding-mode-talk"]')).toBe(true);
    expect(await page.isVisible('[data-testid="onboarding-mode-type"]')).toBe(true);
  });

  it('7. Talk and Type mode choices toggle active selection', async () => {
    await page.click('[data-testid="onboarding-mode-talk"]');
    expect(await page.getAttribute('[data-testid="onboarding-mode-talk"]', 'aria-pressed')).toBe('true');
    expect(await page.getAttribute('[data-testid="onboarding-mode-type"]', 'aria-pressed')).toBe('false');

    await page.click('[data-testid="onboarding-mode-type"]');
    expect(await page.getAttribute('[data-testid="onboarding-mode-type"]', 'aria-pressed')).toBe('true');
    expect(await page.getAttribute('[data-testid="onboarding-mode-talk"]', 'aria-pressed')).toBe('false');
  });

  it('8. Screen 3 advances to Screen 4: Permanent agency controls explanation', async () => {
    await page.click('[data-testid="onboarding-next-mode"]');
    await page.waitForSelector('[data-testid="onboarding-step-4"]');
    expect(await page.textContent('h2')).toContain('Permanent Controls');
    const text = await page.textContent('[data-testid="onboarding-step-4"]');
    expect(text).toContain('Pass');
    expect(text).toContain('Private');
    expect(text).toContain('Stop');
    expect(text).toContain('Serious');
  });

  it('9. Screen 4 advances to Screen 5: Ready to Chart and Start', async () => {
    await page.click('[data-testid="onboarding-next-agency"]');
    await page.waitForSelector('[data-testid="onboarding-step-5"]');
    expect(await page.isVisible('[data-testid="onboarding-start"]')).toBe(true);
  });

  it('10. keyboard navigation can trigger Start', async () => {
    await page.focus('[data-testid="onboarding-start"]');
    await page.keyboard.press('Enter');
    await page.waitForSelector('.map');
    expect(await page.isVisible('.map')).toBe(true);
    expect(await page.isVisible('nav')).toBe(true);
  });

  it('11. onboarding does not alter XP, evidence, or unlocks', async () => {
    const xp = Number((await page.textContent('.xp span'))!.replace(/\D/g, ''));
    expect(xp).toBe(0);
    const level = (await page.textContent('.level'))!.trim();
    expect(level).toBe('L1');
  });

  it('12. onboarding completion survives reload locally in IndexedDB', async () => {
    await page.reload({ waitUntil: 'load' });
    // Every launch is a cold open, including a reload — so wake, then verify the
    // completed campaign comes back rather than replaying onboarding.
    await page.waitForSelector('[data-testid="cold-open"]');
    await wakeAtlas(page);
    await page.waitForSelector('.map');
    expect(await page.isVisible('.map')).toBe(true);
    expect(await page.locator('[data-testid="cold-open"]').count()).toBe(0);
  });

  it('13. permanent controls remain fully available on Talk screen afterward', async () => {
    await page.click('nav button:has(small:text-is("Talk"))');
    await page.waitForSelector('[data-testid="action-bar"]');
    // PASS is primary; everything else is behind one tap of MORE and still
    // unconditionally available - onboarding grants no control, it only explains.
    expect(await page.isVisible('[data-testid="agency-pass"]')).toBe(true);
    await openAgency(page);
    await page.waitForSelector('.agency');
    expect(await page.isVisible('[data-testid="agency-private"]')).toBe(true);
    expect(await page.isVisible('[data-testid="agency-stop"]')).toBe(true);
    expect(await page.isVisible('[data-testid="agency-serious"]')).toBe(true);
    expect(await page.isVisible('[data-testid="agency-help"]')).toBe(true);
    expect(await page.isVisible('[data-testid="agency-sass"]')).toBe(true);
  });

  it('14. reduced motion preference is respected by document element', async () => {
    const reducedMotion = await page.evaluate(() => document.documentElement.dataset.reducedMotion);
    expect(reducedMotion).toBe('false');
  });
});
