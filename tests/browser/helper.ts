import type { Page } from 'playwright-core';

export async function completeOnboardingIfPresent(page: Page) {
  if (await page.isVisible('[data-testid="onboarding-begin"]')) {
    await page.click('[data-testid="onboarding-begin"]');
    await page.click('[data-testid="onboarding-next-sass"]');
    await page.click('[data-testid="onboarding-next-mode"]');
    await page.click('[data-testid="onboarding-next-agency"]');
    await page.click('[data-testid="onboarding-start"]');
    await page.waitForSelector('.map');
  }
}
