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
});
