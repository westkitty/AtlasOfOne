import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { join } from 'node:path';
import { completeOnboardingIfPresent } from './helper';
import { serveDist, type StaticHost } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const VIEWPORT = { width: 390, height: 844 };

let host: StaticHost;
let browser: Browser;
let page: Page;

beforeAll(async () => {
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome' });
  page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(host.url);
  await completeOnboardingIfPresent(page);
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('SNES Overworld Verbs', () => {
  it('renders the 2D overworld canvas and touch controls on the world stage', async () => {
    await page.waitForSelector('[data-testid="world"]');
    expect(await page.locator('[data-testid="world"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="overworld-canvas"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="touch-controls"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="interact-action-btn"]').isVisible()).toBe(true);
  });

  it('opens conversation overlay when pressing [A] Interact button near landmark', async () => {
    // Greyson is in the Identity clearing; tapping [A] initiates Cartographer dialogue
    await page.locator('[data-testid="interact-action-btn"]').click();
    await page.waitForSelector('[data-testid="convo"]');
    expect(await page.locator('[data-testid="convo"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="prompt-question"]').isVisible()).toBe(true);

    // Verify 16-bit landmark architectural sanctuary header
    expect(await page.locator('[data-testid="convo-sanctuary"]').isVisible()).toBe(true);
    expect(await page.textContent('[data-testid="convo-sanctuary"]')).toContain('Origin Grove Shrine');

    // Answering a question
    await page.fill('[data-testid="answer-input"]', 'I value honesty and authentic growth.');
    await page.click('[data-testid="submit-answer"]');

    // After answer commits, world visibly reacts
    await page.waitForSelector('[data-testid="world-mark"]', { timeout: 10_000 });
    expect(await page.locator('[data-testid="world-mark"]').isVisible()).toBe(true);

    // Return to exploration
    await page.click('[data-testid="leave-encounter"]');
    await page.waitForTimeout(400);
  });

  it('allows free movement via keyboard input (Arrow keys / WASD)', async () => {
    await page.waitForSelector('[data-testid="world-greyson"]');
    const startPos = await page.locator('[data-testid="world-greyson"]').boundingBox();
    expect(startPos).not.toBeNull();

    // Hold ArrowRight for 300ms to walk East
    await page.keyboard.down('ArrowRight');
    await page.waitForTimeout(350);
    await page.keyboard.up('ArrowRight');

    const movedPos = await page.locator('[data-testid="world-greyson"]').boundingBox();
    expect(movedPos).not.toBeNull();
    // Greyson moved rightward
    expect(movedPos!.x).toBeGreaterThan(startPos!.x);

    // Verify facing direction updated
    const facingClass = await page.getAttribute('[data-testid="world-greyson"]', 'class');
    expect(facingClass).toContain('face-right');
  });

  it('allows movement via on-screen D-Pad controls', async () => {
    const posBefore = (await page.locator('[data-testid="world-greyson"]').boundingBox())!;

    // Tap D-Pad Down
    await page.locator('[data-testid="dpad-down"]').dispatchEvent('pointerdown');
    await page.waitForTimeout(250);
    await page.locator('[data-testid="dpad-down"]').dispatchEvent('pointerup');

    const posAfter = (await page.locator('[data-testid="world-greyson"]').boundingBox())!;
    expect(posAfter.y).toBeGreaterThan(posBefore.y);
  });

  it('interacts with discoverable trail waystones and displays lore dialog', async () => {
    // Walk south towards the trail waystone
    await page.locator('[data-testid="dpad-down"]').dispatchEvent('pointerdown');
    await page.waitForTimeout(500);
    await page.locator('[data-testid="dpad-down"]').dispatchEvent('pointerup');

    const btnText = await page.locator('[data-testid="interact-action-btn"]').innerText();
    if (btnText.includes('Read')) {
      await page.locator('[data-testid="interact-action-btn"]').click();
      await page.waitForSelector('[data-testid="waystone-overlay"]');
      expect(await page.locator('[data-testid="waystone-overlay"]').isVisible()).toBe(true);
      await page.locator('[data-testid="waystone-dismiss"]').click();
      expect(await page.locator('[data-testid="waystone-overlay"]').isVisible()).toBe(false);
    }
  });

  it('displays 16-bit JRPG battle arena staging for Boss Fights', async () => {
    await page.locator('[data-testid="open-menu"]').click();
    await page.waitForSelector('[data-testid="menu"]');
    const bossOffer = page.locator('[data-testid^="start-boss-"]');
    if (await bossOffer.count() > 0) {
      await bossOffer.first().click();
      await page.waitForSelector('[data-testid="encounter-boss"]');
      const classes = await page.getAttribute('[data-testid="encounter-boss"]', 'class');
      expect(classes).toContain('is-boss-arena');
      expect(await page.locator('.encounter-stage-frame').isVisible()).toBe(true);
      expect(await page.locator('.encounter-portrait').isVisible()).toBe(true);
      await page.locator('[data-testid="encounter-leave"]').click();
    } else {
      await page.locator('[data-testid="menu-close"]').click();
    }
  });

  it('enters landmark sanctuary interior, inspects authored prop, and exits back to island', async () => {
    // Navigate back to Origin Grove landmark center
    await page.locator('[data-testid="place-identity"]').click();
    await page.waitForTimeout(500);

    // Enter Origin Grove Sanctuary
    await page.waitForSelector('[data-testid="enter-sanctuary"]');
    await page.locator('[data-testid="enter-sanctuary"]').click();

    // Verify Interior Stage & Canvas are rendered
    await page.waitForSelector('[data-testid="interior-stage"]');
    expect(await page.locator('[data-testid="interior-stage"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="interior-canvas"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="exit-interior"]').isVisible()).toBe(true);

    // Verify HUD reflects the sanctuary name
    expect(await page.textContent('[data-testid="hud-territory"]')).toContain('Origin Grove Shrine');

    // Walk North toward the Altar of Origins prop using D-Pad Up
    await page.locator('[data-testid="dpad-up"]').dispatchEvent('pointerdown');
    await page.waitForTimeout(1600);
    await page.locator('[data-testid="dpad-up"]').dispatchEvent('pointerup');

    // Contextual Action button updates to 'Inspect'
    const actionLabel = await page.locator('[data-testid="interact-action-btn"]').innerText();
    expect(actionLabel.toUpperCase()).toContain('INSPECT');

    // Inspect the prop
    await page.locator('[data-testid="interact-action-btn"]').click();
    await page.waitForSelector('[data-testid="prop-inspection-overlay"]');
    expect(await page.locator('[data-testid="prop-inspection-overlay"]').isVisible()).toBe(true);

    // Verify authored inscription text is displayed
    const propText = await page.textContent('.prop-inspection-text');
    expect(propText!.length).toBeGreaterThan(15);

    // Dismiss the prop inspection dialog
    await page.locator('[data-testid="prop-dismiss"]').click();
    expect(await page.locator('[data-testid="prop-inspection-overlay"]').count()).toBe(0);

    // Return to the island overworld using the exit button
    await page.locator('[data-testid="exit-interior"]').click();
    await page.waitForSelector('[data-testid="overworld-canvas"]');
    expect(await page.locator('[data-testid="overworld-canvas"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="interior-stage"]').count()).toBe(0);
  });

  it('displays 16-bit JRPG region arrival announcement card when moving to a new region', async () => {
    // Travel to an adjacent reachable region (e.g. values)
    const reachablePlace = page.locator('.world-place.can-travel').first();
    if (await reachablePlace.count() > 0) {
      await reachablePlace.click();

      // Verify region arrival card appears
      await page.waitForSelector('[data-testid="region-arrival-card"]', { timeout: 4000 });
      expect(await page.locator('[data-testid="region-arrival-card"]').isVisible()).toBe(true);
      const eyebrow = await page.textContent('.region-arrival-eyebrow');
      expect(eyebrow?.toUpperCase()).toContain('NOW ENTERING');
      expect((await page.textContent('.region-arrival-title'))!.length).toBeGreaterThan(3);
      expect((await page.textContent('.region-arrival-sanctuary'))!.length).toBeGreaterThan(3);
    }
  });

  it('bottom controls never overlap at phone width', async () => {
    // The D-pad, [A], the primary pill, the Enter Sanctuary chip and the
    // interior exit verb are laid out by independent components (TouchControls,
    // WorldMap, App). Any of them can be absent depending on state, so ids
    // with no matching element (or that are not currently visible) are
    // skipped rather than failing the lookup.
    const ids = [
      'dpad-up',
      'dpad-down',
      'dpad-left',
      'dpad-right',
      'interact-action-btn',
      'enter-sanctuary',
      'enter-encounter',
      'exit-interior'
    ];

    const assertNoOverlap = async (label: string) => {
      const boxes = (
        await Promise.all(
          ids.map(async (id) => {
            const locator = page.locator(`[data-testid="${id}"]`);
            // count() resolves immediately with 0 for a non-matching selector;
            // boundingBox() on a locator with no attached element instead waits
            // out the full actionability timeout, so absence has to be checked
            // first rather than relied on to short-circuit.
            if ((await locator.count()) === 0) return [id, null] as const;
            return [id, await locator.boundingBox()] as const;
          })
        )
      ).filter(([, box]) => box);
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [idA, a] = boxes[i];
          const [idB, b] = boxes[j];
          const overlap =
            a!.x < b!.x + b!.width &&
            b!.x < a!.x + a!.width &&
            a!.y < b!.y + b!.height &&
            b!.y < a!.y + a!.height;
          expect(overlap, `[${label}] ${idA} overlaps ${idB}`).toBe(false);
        }
      }
    };

    // State: overworld, near the Origin Grove landmark (enter-sanctuary visible).
    await page.locator('[data-testid="place-identity"]').click();
    await page.waitForTimeout(400);
    await page.waitForSelector('[data-testid="enter-sanctuary"]');
    await assertNoOverlap('overworld near landmark');

    // State: overworld, away from any landmark (enter-sanctuary absent).
    // Regions sit close enough together that a long hold overshoots into the
    // next region's own landmark radius, so this polls and releases the
    // instant the chip disappears rather than holding for a fixed duration.
    await page.locator('[data-testid="dpad-up"]').dispatchEvent('pointerdown');
    let clearedLandmark = false;
    for (let i = 0; i < 20 && !clearedLandmark; i++) {
      await page.waitForTimeout(100);
      clearedLandmark = (await page.locator('[data-testid="enter-sanctuary"]').count()) === 0;
    }
    await page.locator('[data-testid="dpad-up"]').dispatchEvent('pointerup');
    expect(clearedLandmark, 'walked clear of every landmark radius within 2s').toBe(true);
    await page.waitForTimeout(150);
    expect(await page.locator('[data-testid="enter-sanctuary"]').count()).toBe(0);
    await assertNoOverlap('overworld away from landmark');

    // State: inside an interior (exit-interior visible).
    await page.locator('[data-testid="place-identity"]').click();
    await page.waitForTimeout(400);
    await page.waitForSelector('[data-testid="enter-sanctuary"]');
    await page.locator('[data-testid="enter-sanctuary"]').click();
    await page.waitForSelector('[data-testid="interior-stage"]');
    await page.waitForSelector('[data-testid="exit-interior"]');
    await assertNoOverlap('interior');

    // Leave the interior so any later suite starts from the overworld.
    await page.locator('[data-testid="exit-interior"]').click();
    await page.waitForSelector('[data-testid="overworld-canvas"]');
  });

  it('bottom-lane labels render in full at 320px (no clipping, no ellipsis)', async () => {
    // The middle lane between the D-pad and [A] is narrowest at 320px. A
    // fixed line-clamp there previously combined with overflow:hidden to
    // silently cut "Continue" down to "Contin" (scrollWidth 64 vs
    // clientWidth 44) instead of wrapping it. This checks the DOM-level
    // signal for that failure mode directly: a clipped or ellipsized label
    // always has scrollWidth/scrollHeight exceeding the visible box, even
    // though boundingBox()-based overlap checks alone can't see it.
    await page.setViewportSize({ width: 320, height: 640 });
    await page.waitForTimeout(150);

    const assertFullyRendered = async (testId: string, expectedText: string) => {
      const span = page.locator(`[data-testid="${testId}"] span`);
      await span.waitFor({ state: 'visible' });
      const metrics = await span.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth,
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        text: el.textContent ?? ''
      }));
      expect(metrics.scrollWidth, `${testId} label not clipped horizontally`).toBeLessThanOrEqual(
        metrics.clientWidth + 1
      );
      expect(metrics.scrollHeight, `${testId} label not clipped vertically`).toBeLessThanOrEqual(
        metrics.clientHeight + 1
      );
      expect(metrics.text.trim(), `${testId} text is intact, not truncated`).toBe(expectedText);
    };

    // Primary pill: whichever of Begin/Continue is currently active (this
    // suite has already answered several turns by this point, so it reads
    // "Continue" here — the exact word the bug report reproduced) shares its
    // CSS with "Begin", so exercising either exercises both. The Enter
    // Sanctuary chip must show the complete sanctuary name alongside it.
    await page.locator('[data-testid="place-identity"]').click();
    await page.waitForTimeout(400);
    await page.waitForSelector('[data-testid="enter-sanctuary"]');
    const primaryLabel = (await page.locator('[data-testid="enter-encounter"] span').textContent())?.trim();
    expect(['Begin', 'Continue']).toContain(primaryLabel);
    await assertFullyRendered('enter-encounter', primaryLabel!);
    await assertFullyRendered('enter-sanctuary', 'Enter Origin Grove Shrine');

    // Interior: "Consult Cartographer" (primary pill) and "◀ Exit to Island"
    // (the [B]-style verb) both have to render completely too.
    await page.locator('[data-testid="enter-sanctuary"]').click();
    await page.waitForSelector('[data-testid="interior-stage"]');
    await page.waitForSelector('[data-testid="exit-interior"]');
    await assertFullyRendered('enter-encounter', 'Consult Cartographer');
    await assertFullyRendered('exit-interior', '◀ Exit to Island');

    // Leave the interior and restore the shared viewport for any later suite.
    await page.locator('[data-testid="exit-interior"]').click();
    await page.waitForSelector('[data-testid="overworld-canvas"]');
    await page.setViewportSize(VIEWPORT);
  });
});
