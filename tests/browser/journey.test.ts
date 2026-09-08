import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type ConsoleMessage, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, openAgency, wakeAtlas } from './helper';
import { serveDist } from './server';

/**
 * Real-browser proof of the Atlas user journey.
 *
 * Runs the production client bundle in installed Chrome over HTTP, so IndexedDB
 * hydration, reload persistence and the canonical sprite are exercised for real
 * rather than simulated. Every answer submitted here is synthetic.
 *
 * Requires `npm run build` first; `npm run test:browser` does that for you.
 */

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };

/** Synthetic answers only. No real Greyson material ever enters this file. */
const SYNTHETIC = 'For example, when a group has to make a difficult choice, I slow down and ask what each option costs the people with the least power.';
const SYNTHETIC_TWO = 'Synthetic follow-up answer recorded for browser-journey verification purposes only.';

let browser: Browser;
let page: Page;
let host: { url: string; close: () => Promise<void> };
const consoleErrors: string[] = [];
const pageErrors: string[] = [];

const xpOf = async () => Number((await page.textContent('.xp span'))!.replace(/\D/g, ''));
const levelOf = async () => (await page.textContent('.level'))!.trim();

/** Clear any celebratory notice, exactly as a player would, before moving on. */
async function dismissNotices() {
  while (await page.isVisible('.overlay')) await page.click('.overlay button:text("Continue")');
}

async function goto(screen: string) {
  await dismissNotices();
  await page.click(`nav button:has(small:text-is("${screen}"))`);
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run `npm run build` before the browser journey').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: PHONE });

  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error: Error) => pageErrors.push(error.message));

  await page.goto(host.url, { waitUntil: 'load' });
  await page.waitForSelector('.shell');
  await wakeAtlas(page);
  await completeOnboardingIfPresent(page);
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('Atlas browser journey', () => {
  it('1. loads on the Map screen', async () => {
    await expect.poll(() => page.textContent('h1')).toBe('Atlas of One');
    expect(await page.isVisible('.map')).toBe(true);
    expect(await page.textContent('nav button.active small')).toBe('Map');
  });

  it('2. renders the canonical Greyson sprite', async () => {
    const sprite = page.locator('.avatar img');
    await expect.poll(() => sprite.getAttribute('src')).toBe('/assets/greyson/map/idle-front.png');
    // Proves the bytes actually decoded in the browser, not merely that a tag exists.
    const natural = await sprite.evaluate((node) => ({
      width: (node as HTMLImageElement).naturalWidth,
      height: (node as HTMLImageElement).naturalHeight,
      complete: (node as HTMLImageElement).complete
    }));
    expect(natural).toEqual({ width: 48, height: 64, complete: true });
    expect(await sprite.evaluate((node) => getComputedStyle(node).imageRendering)).toBe('pixelated');
  });

  it('3. navigates Map to Talk to Vault to Me and back to Map', async () => {
    await goto('Talk');
    await expect.poll(() => page.textContent('h1')).toBe('The Cartographer');
    await goto('Vault');
    await expect.poll(() => page.textContent('h1')).toBe('Vault');
    await goto('Me');
    await expect.poll(() => page.textContent('h1')).toBe('Greyson');
    await goto('Map');
    await expect.poll(() => page.textContent('h1')).toBe('Atlas of One');
  });

  it('4-5. submits a synthetic answer and advances XP deterministically', async () => {
    const before = await xpOf();
    await goto('Talk');
    await page.fill('.answer textarea', SYNTHETIC);
    await page.click('button:text("Map this answer")');
    // The first accepted answer earns an achievement; its celebration is shown
    // and dismissed here, which is itself proof that normal mode celebrates.
    await page.waitForSelector('.overlay');
    await goto('Map');
    // accepted answer 5 + developed 3 + behavioural example 3 + new evidence 2
    await expect.poll(xpOf).toBe(before + 13);
  });

  it('6-7. survives a full page reload through IndexedDB', async () => {
    const before = await xpOf();
    const evidence = await page.evaluate(async () => {
      const open = indexedDB.open('atlas-of-one');
      return new Promise<number>((resolve) => {
        open.onsuccess = () => {
          const request = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
          request.onsuccess = () => resolve(request.result?.state?.evidence?.length ?? 0);
        };
      });
    });
    expect(evidence).toBeGreaterThan(0);

    const levelBefore = await levelOf();
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('.map');
    await expect.poll(xpOf).toBe(before);
    expect(await levelOf()).toBe(levelBefore);
  });

  it('8. PASS costs no XP', async () => {
    const before = await xpOf();
    await goto('Talk');
    await page.click('[data-testid="agency-pass"]');
    await expect.poll(() => page.textContent('.reply')).toContain('No penalty');
    await goto('Map');
    expect(await xpOf()).toBe(before);
  });

  it('9. PRIVATE closes a dimension and the mock stops selecting it', async () => {
    await goto('Talk');
    const closed = (await page.textContent('.prompt small'))!.replace('Evidence dimension: ', '').trim();
    await openAgency(page);
    await page.click('[data-testid="agency-private"]');
    await expect.poll(() => page.textContent('.reply')).toContain('not intentionally return');
    await expect.poll(async () => (await page.textContent('.prompt small'))!.replace('Evidence dimension: ', '').trim()).not.toBe(closed);
  });

  it('10. STOP pauses and blocks submission until resumed', async () => {
    await goto('Talk');
    await openAgency(page);
    await page.click('[data-testid="agency-stop"]');
    await page.waitForSelector('.quiet:text-matches("Session paused")');
    expect(await page.isDisabled('.composer textarea')).toBe(true);
    expect(await page.isDisabled('button:text("Map this answer")')).toBe(true);

    // RESUME is promoted to the primary row while paused, so recovery is instant.
    await page.click('[data-testid="action-resume"]');
    await expect.poll(() => page.isDisabled('.composer textarea')).toBe(false);
  });

  it('11-13. SERIOUS enters quiet presentation, still progresses, and suppresses celebration', async () => {
    await goto('Talk');
    await dismissNotices();
    await openAgency(page);
    await page.click('[data-testid="agency-serious"]');
    await expect.poll(() => page.textContent('.chip')).toBe('quiet');

    const before = await (async () => { await goto('Map'); return xpOf(); })();
    await goto('Talk');
    // Drive enough synthetic turns to cross a level boundary while quiet.
    for (let index = 0; index < 8; index += 1) {
      await page.fill('.composer textarea', `${SYNTHETIC_TWO} ${index}`);
      await page.click('button:text("Map this answer")');
      expect(await page.isVisible('.overlay')).toBe(false);
    }
    await goto('Map');
    expect(await xpOf()).toBeGreaterThan(before);
    expect(await page.isVisible('.overlay')).toBe(false);
  });

  it('14. sass stays adjustable at every level and in quiet mode', async () => {
    await goto('Talk');
    await openAgency(page);
    await page.click('[data-testid="agency-sass"]');
    await goto('Me');
    const select = page.locator('.settings select');
    expect(await select.isDisabled()).toBe(false);
    for (const value of ['low', 'risks-understood', 'medium']) {
      await select.selectOption(value);
      await expect.poll(() => select.inputValue()).toBe(value);
    }
  });

  it('15-18. exports, deletes and re-imports the campaign with matching state', async () => {
    await goto('Me');
    const exported = await page.evaluate(async () => {
      const open = indexedDB.open('atlas-of-one');
      return new Promise<string>((resolve) => {
        open.onsuccess = () => {
          const request = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
          request.onsuccess = () => resolve(JSON.stringify(request.result.state));
        };
      });
    });
    const before = JSON.parse(exported);
    expect(before.schemaVersion).toBe(1);

    const download = page.waitForEvent('download');
    await page.click('button:text("Export Atlas")');
    expect((await download).suggestedFilename()).toMatch(/^atlas-of-one-.*\.atlas\.json$/);

    await page.click('button:text("Delete local Atlas")');
    // Destructive delete now takes a deliberate second tap.
    expect(await page.isVisible('button:text-is("Delete everything")')).toBe(true);
    await page.click('button:text-is("Delete everything")');
    await goto('Map');
    await expect.poll(xpOf).toBe(0);

    await page.goto(host.url, { waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('.map');
    expect(await xpOf()).toBe(0);

    await goto('Me');
    await page.setInputFiles('.file input', {
      name: 'synthetic.atlas.json',
      mimeType: 'application/json',
      buffer: Buffer.from(exported)
    });
    await page.waitForSelector('.toast:text-matches("imported and validated")');

    await goto('Map');
    await expect.poll(xpOf).toBe(before.xp);
    const after = await page.evaluate(async () => {
      const open = indexedDB.open('atlas-of-one');
      return new Promise<string>((resolve) => {
        open.onsuccess = () => {
          const request = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
          request.onsuccess = () => resolve(JSON.stringify(request.result.state));
        };
      });
    });
    const restored = JSON.parse(after);
    expect(restored.campaignId).toBe(before.campaignId);
    expect(restored.xp).toBe(before.xp);
    expect(restored.level).toBe(before.level);
    expect(restored.evidence).toEqual(before.evidence);
    expect(restored.turns).toEqual(before.turns);
    expect(restored.privateTopics).toEqual(before.privateTopics);
    expect(restored.territories).toEqual(before.territories);
  });

  it('19. stays usable at a narrow phone viewport', async () => {
    await page.setViewportSize({ width: 320, height: 640 });
    await goto('Map');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    const buttons = page.locator('nav button');
    expect(await buttons.count()).toBe(4);
    for (let index = 0; index < 4; index += 1) {
      const box = (await buttons.nth(index).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThan(0);
    }
    await goto('Talk');
    // The primary row is game-facing at this width; permanent agency is one tap away.
    expect(await page.isVisible('[data-testid="action-bar"]')).toBe(true);
    await openAgency(page);
    expect(await page.isVisible('[data-testid="agency"]')).toBe(true);
    await page.click('[data-testid="more-close"]');
    await page.setViewportSize(PHONE);
  });

  it('19b. mobile polish holds: no overflow on any screen, reachable controls, fixed nav clears content', async () => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const screen of ['Map', 'Talk', 'Vault', 'Me']) {
      await goto(screen);
      const { overflow, offenders } = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const diff = document.documentElement.scrollWidth - vw;
        const bad = diff > 0 ? [...document.querySelectorAll('*')]
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { tag: el.tagName, cls: el.className, id: el.id, right: Math.round(r.right), width: Math.round(r.width) };
          })
          .filter((x) => x.right > vw) : [];
        return { overflow: diff, offenders: JSON.stringify(bad) };
      });
      expect(overflow, `no horizontal overflow on ${screen} at 320px (offenders: ${offenders})`).toBeLessThanOrEqual(0);
    }

    // Every permanent control is a real 44px+ target, on both surfaces it lives on.
    await goto('Talk');
    for (const control of ['pass', 'more']) {
      const testId = control === 'pass' ? 'agency-pass' : 'action-more';
      const box = (await page.locator(`[data-testid="${testId}"]`).boundingBox())!;
      expect(box.height, `${control} height`).toBeGreaterThanOrEqual(44);
      expect(box.width, `${control} width`).toBeGreaterThanOrEqual(44);
    }
    await openAgency(page);
    for (const control of ['private', 'stop', 'serious', 'help', 'sass']) {
      const box = (await page.locator(`[data-testid="agency-${control}"]`).boundingBox())!;
      expect(box.height, `${control} height`).toBeGreaterThanOrEqual(44);
      expect(box.width, `${control} width`).toBeGreaterThanOrEqual(44);
    }

    // The fixed bottom nav must never sit on top of the form controls: once
    // scrolled to the end, the last permanent control clears the nav entirely.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const lastControl = (await page.locator('[data-testid="agency-status"]').boundingBox())!;
    const navBox = (await page.locator('nav').boundingBox())!;
    expect(lastControl.y + lastControl.height).toBeLessThanOrEqual(navBox.y + 1);

    // Long question text stays inside the viewport.
    const promptOverflow = await page.evaluate(() => {
      const h2 = document.querySelector('.prompt h2') as HTMLElement | null;
      return h2 ? h2.getBoundingClientRect().right - document.documentElement.clientWidth : -1;
    });
    expect(promptOverflow).toBeLessThanOrEqual(0);

    await page.setViewportSize(PHONE);
  });

  it('21a. an unfinished campaign cannot synthesize a Final Atlas Assessment', async () => {
    await goto('Me');
    expect(await page.isVisible('[data-testid="final-assessment-section"]')).toBe(true);

    // The map is not finished, so the end-state artifact is not offered at all.
    expect(await page.isVisible('[data-testid="assessment-locked"]')).toBe(true);
    expect(await page.locator('[data-testid="synthesize-assessment-btn"]').count()).toBe(0);
    expect(await page.locator('[data-testid="assessment-content"]').count()).toBe(0);
  });

  it('21b. a completed campaign synthesizes and renders the Final Atlas Assessment', async () => {
    // Reach the end state the way a player legitimately can: import a campaign
    // the engine already considers complete, through the real import path.
    const exported = await page.evaluate(async () => {
      const open = indexedDB.open('atlas-of-one');
      return new Promise<string>((resolve) => {
        open.onsuccess = () => {
          const request = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
          request.onsuccess = () => resolve(JSON.stringify(request.result.state));
        };
      });
    });
    const completed = { ...JSON.parse(exported), campaignCompleted: true };

    await goto('Me');
    await page.setInputFiles('.file input', {
      name: 'synthetic-completed.atlas.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(completed))
    });
    await page.waitForSelector('.toast:text-matches("imported and validated")');

    await goto('Me');
    await expect.poll(() => page.locator('[data-testid="assessment-locked"]').count()).toBe(0);

    await page.click('[data-testid="synthesize-assessment-btn"]');
    await expect.poll(() => page.isVisible('[data-testid="assessment-content"]')).toBe(true);

    const whoText = await page.textContent('[data-testid="who-is-greyson"]');
    expect(whoText).toContain('Greyson (he/they)');

    const domainCards = page.locator('.domain-card');
    expect(await domainCards.count()).toBe(8);

    expect(await page.isVisible('[data-testid="print-assessment-btn"]')).toBe(true);
  });

  it('22. print styles and 320px layout hold with full assessment rendered', async () => {
    // 320px viewport layout test with assessment present
    await page.setViewportSize({ width: 320, height: 640 });
    const { overflow, offenders } = await page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      const diff = document.documentElement.scrollWidth - vw;
      const bad = diff > 0 ? [...document.querySelectorAll('*')]
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { tag: el.tagName, cls: el.className, id: el.id, right: Math.round(r.right), width: Math.round(r.width) };
        })
        .filter((x) => x.right > vw) : [];
      return { overflow: diff, offenders: JSON.stringify(bad) };
    });
    expect(overflow, `no horizontal overflow on Me with assessment at 320px (offenders: ${offenders})`).toBeLessThanOrEqual(0);
    await page.setViewportSize(PHONE);

    // Verify print media rules exist
    const printRulesExist = await page.evaluate(() => {
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          for (const rule of Array.from(sheet.cssRules)) {
            if (rule instanceof CSSMediaRule && rule.conditionText === 'print') {
              return true;
            }
          }
        } catch {
          // ignore cross-origin sheet errors
        }
      }
      return false;
    });
    expect(printRulesExist).toBe(true);
  });

  it('23. records no critical console errors or unhandled rejections', () => {
    expect(pageErrors).toEqual([]);
    // Ignore transport noise from the ephemeral static host; assert on app errors.
    const critical = consoleErrors.filter((text) => !/favicon|Failed to load resource/i.test(text));
    expect(critical).toEqual([]);
  });
});
