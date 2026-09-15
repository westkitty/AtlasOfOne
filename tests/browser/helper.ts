import type { Page } from 'playwright-core';

/**
 * Shared first-run handling for the browser suites.
 *
 * ## The race this exists to remove
 *
 * `App.tsx` renders `<div className="shell">` unconditionally on the very first
 * paint, while `hydrated` is still `false` because the IndexedDB read in its
 * mount effect has not resolved yet. At that moment:
 *
 *     showOnboarding = hydrated && !onboardingCompleted && ... === false
 *
 * so the app renders the **normal** branch — map and `<nav>` — even on a profile
 * that is about to be sent to onboarding. Only when hydration lands does a
 * first-run campaign swap that navigation out for the onboarding screen.
 *
 * Two consequences the harness has to respect:
 *
 * 1. `.shell` and the world are observable BEFORE the onboarding
 *    decision has been made, so none of them is evidence that onboarding was
 *    skipped.
 * 2. A non-waiting `page.isVisible('[data-testid="onboarding-begin"]')` taken at
 *    first paint returns a false negative. The helper then does nothing, the
 *    suite proceeds, hydration lands a moment later, and the whole app is
 *    replaced by the onboarding screen — after which every world and avatar
 *    locator times out.
 *
 * That is exactly what happened on a slow CI runner in `Atlas validation` run
 * 34169573538: check 1 passed in 25ms against the pre-hydration map, check 2
 * failed on the sprite, and every later check timed out at 30000ms waiting for
 * `nav`.
 *
 * ## What this helper waits for instead
 *
 * It waits for the first-run decision to actually be *settled*, by racing the
 * two states that can only be true once it is:
 *
 *   A. the onboarding screen is present and actionable — this markup does not
 *      exist before hydration; or
 *   B. `localStorage.atlas_onboarding_completed` is set — the app's own durable
 *      completion marker, which describes stored state rather than render state
 *      and so cannot be spuriously true during the pre-hydration window.
 *
 * No arbitrary delay is involved: both are real waits on real conditions, and if
 * neither settles the helper fails loudly instead of continuing on a guess.
 */

/** Matches the storage key written by `handleOnboardingStart` in `src/App.tsx`. */
const ONBOARDING_DONE_KEY = 'atlas_onboarding_completed';

const READINESS_TIMEOUT = 30_000;

/**
 * Wake Atlas out of its cinematic cold open.
 *
 * The cold open owns first paint AND holds until hydration has settled, so
 * waiting for its surface is itself a real settled-state wait — the app cannot
 * be mid-hydration behind it. After the tap the first-run decision is already
 * made, which is why `completeOnboardingIfPresent` can then race two states
 * that are only true post-hydration rather than sampling a moving target.
 */
export async function wakeAtlas(page: Page, timeout = READINESS_TIMEOUT) {
  const surface = page.locator('[data-testid="cold-open"]');
  if ((await surface.count()) === 0) return;
  await surface.waitFor({ state: 'visible', timeout });
  await surface.click();
  await surface.waitFor({ state: 'detached', timeout });
}

export async function completeOnboardingIfPresent(page: Page, timeout = READINESS_TIMEOUT) {
  // Every launch begins dormant, so wake first or nothing below is on screen.
  await wakeAtlas(page, timeout);

  const onboardingReady = page
    .waitForSelector('[data-testid="onboarding-step-2"]', { state: 'visible', timeout })
    .then(() => 'onboarding' as const);

  const alreadyOnboarded = page
    .waitForFunction(
      (key) => {
        try {
          return window.localStorage.getItem(key) === 'true';
        } catch {
          // A storage-restricted context cannot have completed onboarding either.
          return false;
        }
      },
      ONBOARDING_DONE_KEY,
      { timeout }
    )
    .then(() => 'already-onboarded' as const);

  let settled: 'onboarding' | 'already-onboarded';
  try {
    settled = await Promise.race([onboardingReady, alreadyOnboarded]);
  } catch {
    throw new Error(
      `Atlas never settled its first-run decision within ${timeout}ms: neither the onboarding screen ` +
        `nor a completed-onboarding marker appeared. The app may still be pre-hydration, or it hydrated ` +
        `into a campaign whose onboarding was completed elsewhere. Refusing to continue on a guess.`
    );
  } finally {
    // The loser of the race is abandoned deliberately; swallow its eventual
    // rejection so it cannot surface as an unhandled rejection later.
    void onboardingReady.catch(() => undefined);
    void alreadyOnboarded.catch(() => undefined);
  }

  if (settled === 'already-onboarded') {
    // This profile is past onboarding, so the world itself is the correct target.
    await page.waitForSelector('[data-testid="world"]', { state: 'visible', timeout });
    return;
  }

  // No second Begin: the wake tap was it.
  await page.click('[data-testid="onboarding-next-sass"]');
  await page.click('[data-testid="onboarding-next-mode"]');
  await page.click('[data-testid="onboarding-next-agency"]');
  await page.click('[data-testid="onboarding-start"]');
  await page.waitForSelector('[data-testid="world"]');
}

/**
 * Open the permanent-agency surface.
 *
 * PASS stays on the primary action row with the earned game moves; PRIVATE,
 * STOP, SERIOUS, HELP and SASS now live one interaction away behind MORE, so
 * the control plane stops impersonating the game. They remain always available
 * and never progression-gated - just not the loudest thing on screen.
 */
export async function openAgency(page: Page, timeout = READINESS_TIMEOUT) {
  const sheet = page.locator('[data-testid="more-sheet"]');
  if (await sheet.isVisible().catch(() => false)) return;
  await page.click('[data-testid="action-more"]');
  await sheet.waitFor({ state: 'visible', timeout });
}

/**
 * Move between places in the world-first shell.
 *
 * There is no longer a four-tab application nav: the map IS the root, the
 * conversation is a layer over it, and the Vault and character record are places
 * reached from one menu. Every suite navigates through this helper so the shape
 * of that navigation lives in exactly one file.
 */
export async function navigateTo(page: Page, screen: string, timeout = READINESS_TIMEOUT) {
  const target = screen.toLowerCase();

  // Any sheet or menu currently covering the world has to close first.
  if (await page.locator('[data-testid="menu"]').isVisible().catch(() => false)) {
    await page.click('[data-testid="menu-close"]');
  }
  // Any open sheet is closed first, whatever the destination: a sheet covers the
  // world, including the menu button that leads to the other sheet.
  if (await page.locator('[data-testid="sheet"]').isVisible().catch(() => false)) {
    await page.click('[data-testid="close-sheet"]');
    await page.locator('[data-testid="sheet"]').waitFor({ state: 'detached', timeout });
  }

  if (target === 'talk') {
    if (await page.locator('[data-testid="answer-input"]').isVisible().catch(() => false)) return;
    if (await page.locator('[data-testid="encounter-input"]').isVisible().catch(() => false)) return;
    const resume = page.locator('[data-testid="resume-encounter"]');
    await (await resume.isVisible().catch(() => false) ? resume : page.locator('[data-testid="enter-encounter"]')).click();
    await page.waitForSelector('[data-testid="convo"], [data-testid^="encounter-"]', { state: 'visible', timeout });
    return;
  }

  if (target === 'map' || target === 'world') {
    if (await page.locator('[data-testid="leave-encounter"]').isVisible().catch(() => false)) {
      await page.click('[data-testid="leave-encounter"]');
    } else if (await page.locator('[data-testid="encounter-leave"]').isVisible().catch(() => false)) {
      await page.click('[data-testid="encounter-leave"]');
    }
    await page.waitForSelector('[data-testid="world"]', { state: 'visible', timeout });
    return;
  }

  // Vault and the character record both live behind the one menu.
  if (await page.locator('[data-testid="leave-encounter"]').isVisible().catch(() => false)) {
    await page.click('[data-testid="leave-encounter"]');
  }
  await page.click('[data-testid="open-menu"]');
  await page.waitForSelector('[data-testid="menu"]', { state: 'visible', timeout });
  await page.click(target === 'vault' ? '[data-testid="go-vault"]' : '[data-testid="go-character"]');
  await page.waitForSelector('[data-testid="sheet"]', { state: 'visible', timeout });
}
