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
 * 1. `.shell`, `.map` and `nav` are all observable BEFORE the onboarding
 *    decision has been made, so none of them is evidence that onboarding was
 *    skipped.
 * 2. A non-waiting `page.isVisible('[data-testid="onboarding-begin"]')` taken at
 *    first paint returns a false negative. The helper then does nothing, the
 *    suite proceeds, hydration lands a moment later, and the whole app is
 *    replaced by the onboarding screen — after which every `nav` and `.avatar`
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

export async function completeOnboardingIfPresent(page: Page, timeout = READINESS_TIMEOUT) {
  const onboardingReady = page
    .waitForSelector('[data-testid="onboarding-begin"]', { state: 'visible', timeout })
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
    // This profile is past onboarding, so the normal app is the correct target.
    await page.waitForSelector('nav[aria-label="Main"]', { state: 'visible', timeout });
    return;
  }

  await page.click('[data-testid="onboarding-begin"]');
  await page.click('[data-testid="onboarding-next-sass"]');
  await page.click('[data-testid="onboarding-next-mode"]');
  await page.click('[data-testid="onboarding-next-agency"]');
  await page.click('[data-testid="onboarding-start"]');
  await page.waitForSelector('.map');
}
