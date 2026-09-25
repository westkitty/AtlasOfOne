import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, wakeAtlas } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };
const NARROW = { width: 320, height: 640 };

let browser: Browser;
let page: Page;
let host: { url: string; close: () => Promise<void> };
let turnRequests = 0;

async function persistedState() {
  return page.evaluate(async () => {
    const open = indexedDB.open('atlas-of-one');
    return new Promise<any>((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const request = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result?.state ?? null);
      };
    });
  });
}

async function waitForPersistedState(timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await persistedState()) return;
    await page.waitForTimeout(50);
  }
  throw new Error('Timed out waiting for the active Atlas campaign to persist.');
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run npm run build first').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: PHONE });
  page.on('request', (request) => {
    try {
      if (new URL(request.url()).pathname === '/api/turn') turnRequests += 1;
    } catch {
      // Ignore malformed/non-URL browser internals.
    }
  });

  await page.goto(host.url, { waitUntil: 'load' });
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases?.() ?? [];
    for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
  });
  await page.reload({ waitUntil: 'load' });
  await completeOnboardingIfPresent(page);
  await page.waitForSelector('[data-testid="world"]');
  await waitForPersistedState();
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('v2 vertical slice: Journal -> Adventure -> Encounter -> Reflection (I00-I04)', () => {
  it('explores a Journal entry into an optional adventure, plays through an encounter, and offers a Reflection', async () => {
    const before = await persistedState();
    const beforeTurnRequests = turnRequests;

    await page.click('[data-testid="open-journal"]');
    await page.fill('[data-testid="journal-entry-input"]', 'SLICE_BROWSER_CANARY synthetic entry.');
    await page.click('[data-testid="journal-save"]');
    await expect.poll(async () => (await persistedState())?.journalEntries?.length ?? 0).toBe(1);

    // W02/W09: the just-for-fun adventure is on the map as a glyph+text marker with an accessible name.
    const marker = page.locator('[data-testid="world-adventure-marker"]').first();
    await marker.waitFor();
    expect(await marker.getAttribute('aria-label')).toMatch(/\S/);
    const box = await marker.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    await marker.click();
    await page.waitForSelector('[data-testid="adventure-panel"]');
    expect(await page.locator('[data-testid="adventure-just-for-fun"]').count()).toBe(1);
    await page.click('[data-testid="adventure-close"]');

    // Writing never creates an adventure about the entry; only an explicit "Explore this" does.
    expect((await persistedState()).adventureSeeds).toEqual([]);
    expect((await persistedState()).knowledgeGaps).toEqual([]);

    await page.click('[data-testid="open-journal"]');
    await page.click('[data-testid="journal-history-open"]');
    await page.click('[data-testid="journal-history-entry"] button');
    await page.click('[data-testid="journal-explore"]');
    await page.click('[data-testid="journal-explore-place"][data-territory="identity"]');

    await page.waitForSelector('[data-testid="adventure-panel"]');
    await expect.poll(async () => (await persistedState())?.adventureSeeds?.length ?? 0).toBe(1);
    // The explored adventure is listed first; a just-for-fun one is always offered too.
    expect(await page.locator('[data-testid="adventure-just-for-fun"]').count()).toBe(1);
    await page.locator('[data-testid="adventure-start"]').first().click();
    await page.waitForSelector('[data-testid="adventure-beat"]');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);

    // Free input works as well as suggested options.
    await page.fill('[data-testid="adventure-free-input"]', 'Knock on the tower door.');
    await page.click('[data-testid="adventure-free-submit"]');

    // Double-tap regression: two dispatches in one task must both apply, in order.
    await expect.poll(async () => (await persistedState())?.adventureActions?.length ?? 0).toBe(1);
    await page.evaluate(() => {
      const button = document.querySelector('[data-testid="adventure-option"]') as HTMLButtonElement | null;
      if (!button) throw new Error('No adventure option.');
      button.click();
      (document.querySelector('[data-testid="adventure-option"]') as HTMLButtonElement).click();
    });
    await expect.poll(async () => (await persistedState())?.adventureActions?.length ?? 0).toBe(3);
    const afterDouble = await persistedState();
    expect(afterDouble.adventureObservations).toHaveLength(3);
    expect(afterDouble.adventureRuns[0].currentBeat).toBe('encounter');

    for (let step = 0; step < 30; step += 1) {
      if (await page.locator('[data-testid="adventure-outcome"]').count()) break;
      if (await page.locator('[data-testid="adventure-combat"]').count()) {
        // Always pick the first enabled verb button, then the first enabled option if a menu opens.
        const verb = page.locator('[data-testid="adventure-combat"] .cp-verb:not([disabled])').first();
        await verb.click();
        const option = page.locator('[data-testid="adventure-combat"] .cp-option:not([disabled])').first();
        if (await option.count()) await option.click();
      } else {
        await page.locator('[data-testid="adventure-option"]').first().click();
      }
      await page.waitForTimeout(30);
    }

    await page.waitForSelector('[data-testid="adventure-outcome"]');
    await expect.poll(async () => (await persistedState())?.adventureRuns?.[0]?.status).toBe('complete');
    const after = await persistedState();
    expect(after.activeCombat).toBeNull();
    expect(after.reflections).toHaveLength(1);
    expect(after.reflections[0]).toMatchObject({ sourceKind: 'adventure', epistemicStatus: 'pending' });
    expect(after.evidence).toEqual(before.evidence);
    expect(after.xp).toBe(before.xp);
    expect(JSON.stringify(after.adventureObservations)).not.toContain('SLICE_BROWSER_CANARY');
    expect(turnRequests).toBe(beforeTurnRequests);

    await page.click('[data-testid="adventure-close"]');
    await page.waitForSelector('[data-testid="open-reflection"]');

    // I06: Greyson answers in his own words and confirms; only then does Evidence exist.
    await page.click('[data-testid="open-reflection"]');
    await page.fill('[data-testid="reflection-response"]', 'Synthetic confirmed statement in my own words.');
    await page.click('[data-testid="reflection-confirm"]');
    await expect.poll(async () => (await persistedState())?.evidence?.length ?? 0).toBe(before.evidence.length + 1);
    const confirmed = await persistedState();
    const evidence = confirmed.evidence.at(-1);
    expect(evidence).toMatchObject({
      claim: 'Synthetic confirmed statement in my own words.',
      origin: 'player-stated',
      sourceReflectionIds: [confirmed.reflections[0].id],
      status: 'active'
    });
    expect(confirmed.xp).toBe(before.xp);
    expect(turnRequests).toBe(beforeTurnRequests);

    // I07: the confirmed statement is visible in the Vault, and Greyson can withdraw it.
    await page.click('[data-testid="open-menu"]');
    await page.click('[data-testid="go-vault"]');
    await page.waitForSelector('[data-testid="vault-confirmed-item"]');
    expect(await page.textContent('[data-testid="vault-confirmed"]')).toContain('Synthetic confirmed statement in my own words.');
    await page.click('[data-testid="vault-confirmed-withdraw"]');
    await expect.poll(async () => (await persistedState())?.evidence?.at(-1)?.status).toBe('retracted');
    const withdrawn = await persistedState();
    expect(withdrawn.reflections[0].recordStatus).toBe('retracted');
    expect(await page.locator('[data-testid="vault-confirmed-item"]').count()).toBe(0);
  });
});
