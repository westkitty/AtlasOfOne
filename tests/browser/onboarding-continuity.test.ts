import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { serializeCampaign } from '../../src/persistence/transfer';
import { seededCampaign } from '../fixtures/synthetic';
import { completeOnboardingIfPresent } from './helper';
import { serveDist } from './server';

/**
 * First-run continuity across the real persistence boundary (KNOWN-005).
 *
 * Two different things were conflated in the ledger and are separated here:
 *
 *   1. the LOAD-time expression
 *        saved.onboardingCompleted ?? isCompletedLocally ?? (saved.turns.length > 0)
 *      whose third operand is unreachable, because the first two are booleans
 *      after schema normalization and `false ?? x` is `false`; and
 *   2. what a player actually SEES, which is decided by the RENDER gate
 *        hydrated && !onboardingCompleted && !isCompletedLocally && turns.length === 0
 *      and which carries its own `turns.length === 0` term.
 *
 * A path can therefore be visually correct while still persisting a wrong flag.
 * Each case below records both, from real IndexedDB rather than from reasoning.
 *
 * Legacy rows are built at the actual migration boundary — the stored object has
 * no `onboardingCompleted` key at all, so `migrateCampaign`'s Zod default is what
 * normalizes it, exactly as a pre-onboarding-era record would be.
 *
 * Synthetic data only.
 */

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };

let browser: Browser;
let host: { url: string; close: () => Promise<void> };

beforeAll(async () => {
  expect(existsSync(DIST), 'run `npm run build` before the onboarding continuity suite').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

/** Writes a raw campaign row straight into IndexedDB, as if it were already on disk. */
async function seedRawRow(page: Page, state: unknown) {
  await page.evaluate(
    (raw) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('atlas-of-one');
        open.onupgradeneeded = () => {
          if (!open.result.objectStoreNames.contains('campaigns')) open.result.createObjectStore('campaigns', { keyPath: 'key' });
        };
        open.onsuccess = () => {
          const tx = open.result.transaction('campaigns', 'readwrite');
          tx.objectStore('campaigns').put({ key: 'active', state: JSON.parse(raw) });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    JSON.stringify(state)
  );
}

async function readRawRow(page: Page): Promise<Record<string, any> | null> {
  const raw = await page.evaluate(
    () =>
      new Promise<string>((resolve) => {
        const open = indexedDB.open('atlas-of-one');
        open.onsuccess = () => {
          const request = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
          request.onsuccess = () => resolve(JSON.stringify(request.result?.state ?? null));
        };
      })
  );
  return JSON.parse(raw);
}

/** Observed first-run outcome: what the player sees, and what ends up persisted. */
interface Outcome {
  onboardingVisible: boolean;
  navVisible: boolean;
  persistedFlag: unknown;
  persistedTurns: number;
}

/**
 * Boot a fresh profile, optionally pre-seeding an IndexedDB row and a
 * localStorage marker, then report what the app did.
 */
async function boot(options: { row?: unknown; marker?: boolean } = {}): Promise<{ outcome: Outcome; page: Page; context: BrowserContext }> {
  const context = await browser.newContext({ viewport: PHONE });
  const page = await context.newPage();

  if (options.marker) {
    await page.addInitScript(() => {
      try {
        window.localStorage.setItem('atlas_onboarding_completed', 'true');
      } catch {
        /* ignore */
      }
    });
  }

  // A first navigation is needed before IndexedDB for this origin is reachable.
  await page.goto(host.url, { waitUntil: 'load' });
  await page.waitForSelector('.shell');

  if (options.row !== undefined) {
    await seedRawRow(page, options.row);
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.shell');
  }

  // Let hydration settle either way before observing.
  await page.waitForTimeout(700);

  const onboardingVisible = await page.isVisible('[data-testid="onboarding-begin"]');
  const navVisible = await page.isVisible('nav[aria-label="Main"]');
  const stored = await readRawRow(page);

  return {
    outcome: {
      onboardingVisible,
      navVisible,
      persistedFlag: stored === null ? null : stored.onboardingCompleted,
      persistedTurns: stored === null ? 0 : stored.turns.length
    },
    page,
    context
  };
}

/** A campaign with real turns, as production code would build it. */
const withTurns = () => JSON.parse(serializeCampaign(seededCampaign({ territories: ['identity'] })));

/** The same campaign as it would have been stored before onboarding existed. */
function legacyRow(base: Record<string, any>) {
  const row = { ...base };
  delete row.onboardingCompleted;
  return row;
}

describe('KNOWN-005 — first-run continuity across real persistence', () => {
  it('A. a fresh profile with no saved campaign shows onboarding', async () => {
    const { outcome, context } = await boot();
    try {
      expect(outcome.onboardingVisible, 'onboarding is shown').toBe(true);
      expect(outcome.navVisible).toBe(false);
    } finally {
      await context.close();
    }
  }, 120_000);

  it('B. a completed campaign skips onboarding on reload and keeps the flag true', async () => {
    const context = await browser.newContext({ viewport: PHONE });
    const page = await context.newPage();
    try {
      await page.goto(host.url, { waitUntil: 'load' });
      await page.waitForSelector('.shell');
      await completeOnboardingIfPresent(page);
      await page.waitForTimeout(400);

      // Drop the localStorage marker so only the persisted flag can carry it.
      await page.evaluate(() => window.localStorage.removeItem('atlas_onboarding_completed'));
      await page.reload({ waitUntil: 'load' });
      await page.waitForSelector('.shell');
      await page.waitForTimeout(700);

      expect(await page.isVisible('[data-testid="onboarding-begin"]'), 'onboarding is skipped').toBe(false);
      expect(await page.isVisible('nav[aria-label="Main"]')).toBe(true);
      expect((await readRawRow(page))!.onboardingCompleted, 'flag stays true').toBe(true);
    } finally {
      await context.close();
    }
  }, 120_000);

  it('C. a LEGACY campaign with turns skips onboarding, and its flag is normalized to true', async () => {
    const base = withTurns();
    expect(base.turns.length, 'the fixture really has turns').toBeGreaterThan(0);
    const { outcome, context } = await boot({ row: legacyRow(base) });
    try {
      // What the player sees.
      expect(outcome.onboardingVisible, 'a mapped campaign is never sent back to first-run').toBe(false);
      expect(outcome.navVisible).toBe(true);
      expect(outcome.persistedTurns).toBeGreaterThan(0);
      // What gets written back. This is the half the render gate cannot fix.
      expect(outcome.persistedFlag, 'the campaign is recorded as past onboarding').toBe(true);
    } finally {
      await context.close();
    }
  }, 120_000);

  it('D. a stored onboardingCompleted:false with turns is normalized to true', async () => {
    const row = { ...withTurns(), onboardingCompleted: false };
    const { outcome, context } = await boot({ row });
    try {
      expect(outcome.onboardingVisible).toBe(false);
      expect(outcome.persistedFlag, 'normalization agrees with what is rendered').toBe(true);
    } finally {
      await context.close();
    }
  }, 120_000);

  it('E. the localStorage marker alone carries continuity into persisted state', async () => {
    const row = { ...JSON.parse(serializeCampaign(seededCampaign({ territories: [] }))), onboardingCompleted: false, turns: [] };
    const { outcome, context } = await boot({ row, marker: true });
    try {
      expect(outcome.persistedTurns, 'zero turns, so only the marker can decide').toBe(0);
      expect(outcome.onboardingVisible, 'the marker skips onboarding').toBe(false);
      expect(outcome.persistedFlag, 'and the flag is brought into agreement').toBe(true);
    } finally {
      await context.close();
    }
  }, 120_000);

  it('F. a legacy campaign with NO turns and no marker still shows onboarding', async () => {
    // Indistinguishable from a fresh install, so first-run is the correct answer.
    const row = legacyRow({ ...JSON.parse(serializeCampaign(seededCampaign({ territories: [] }))), turns: [] });
    const { outcome, context } = await boot({ row });
    try {
      expect(outcome.onboardingVisible, 'nothing mapped yet, so first-run is right').toBe(true);
      expect(outcome.navVisible).toBe(false);
    } finally {
      await context.close();
    }
  }, 120_000);
});
