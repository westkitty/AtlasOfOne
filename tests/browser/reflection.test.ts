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

async function seedPendingReflection(id: string, interpretation = 'Synthetic interpretation candidate.') {
  await page.evaluate(async ({ id, interpretation }) => {
    const open = indexedDB.open('atlas-of-one');
    await new Promise<void>((resolve, reject) => {
      open.onerror = () => reject(open.error);
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction('campaigns', 'readwrite');
        const store = tx.objectStore('campaigns');
        const get = store.get('active');
        get.onerror = () => reject(get.error);
        get.onsuccess = () => {
          const row = get.result;
          if (!row?.state) return reject(new Error('Active campaign missing.'));
          const journalId = `journal_source_${id}`;
          row.state.journalEntries = [{
            id: journalId,
            createdAt: '2026-01-02T03:00:00.000Z',
            text: 'Synthetic Reflection source.',
            inputMode: 'typed',
            privacy: 'normal',
            status: 'active',
            linkedReflectionIds: [id],
            linkedAdventureIds: []
          }];
          row.state.reflections = [{
            id,
            sourceKind: 'journal',
            sourceIds: [journalId],
            question: 'Does this fit you outside the fiction?',
            response: '',
            ...(interpretation ? { interpretation } : {}),
            epistemicStatus: 'pending',
            privacy: 'normal',
            recordStatus: 'active',
            createdAt: '2026-01-02T03:04:05.000Z'
          }];
          store.put(row);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      };
    });
  }, { id, interpretation });

  await page.reload({ waitUntil: 'load' });
  await wakeAtlas(page);
  await page.waitForSelector('[data-testid="world"]');
  await page.waitForSelector('[data-testid="open-reflection"]');
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
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('v2 Reflection human-authority UI (RF01)', () => {
  it('offers one pending eligible Reflection and shows all six explicit outcomes', async () => {
    await seedPendingReflection('reflection_ui_offer');
    await page.click('[data-testid="open-reflection"]');
    await page.waitForSelector('[data-testid="reflection-panel"]');

    expect(await page.textContent('[data-testid="reflection-panel"]')).toContain('Your call.');
    expect(await page.textContent('[data-testid="reflection-panel"]')).toContain('Does this fit you outside the fiction?');
    expect(await page.textContent('[data-testid="reflection-interpretation"]')).toContain('Synthetic interpretation candidate.');

    for (const id of [
      'reflection-confirm',
      'reflection-partial',
      'reflection-reject',
      'reflection-uncertain',
      'reflection-revise',
      'reflection-private'
    ]) {
      expect(await page.isVisible(`[data-testid="${id}"]`)).toBe(true);
    }

    expect(await page.isDisabled('[data-testid="reflection-partial"]')).toBe(true);
    expect(await page.isDisabled('[data-testid="reflection-revise"]')).toBe(true);
    await page.click('[data-testid="reflection-close"]');
  });

  it('records one-tap Confirm without fabricating response text or progression', async () => {
    await seedPendingReflection('reflection_ui_confirm');
    const before = await persistedState();
    const beforeRequests = turnRequests;

    await page.click('[data-testid="open-reflection"]');
    await page.click('[data-testid="reflection-confirm"]');

    await expect.poll(async () => {
      const state = await persistedState();
      return state.reflections[0]?.epistemicStatus;
    }).toBe('confirmed');

    const after = await persistedState();
    expect(after.reflections[0]).toMatchObject({
      id: 'reflection_ui_confirm',
      decision: 'confirm',
      epistemicStatus: 'confirmed',
      response: ''
    });
    expect(after.xp).toBe(before.xp);
    expect(after.turns).toEqual(before.turns);
    expect(after.evidence).toEqual(before.evidence);
    expect(after.insights).toEqual(before.insights);
    expect(turnRequests).toBe(beforeRequests);
    expect(await page.locator('[data-testid="reflection-panel"]').count()).toBe(0);
  });

  it('requires Greyson words for Partial and preserves them exactly', async () => {
    await seedPendingReflection('reflection_ui_partial');
    await page.click('[data-testid="open-reflection"]');
    expect(await page.isDisabled('[data-testid="reflection-partial"]')).toBe(true);

    const response = '  Sometimes, but only when I already feel responsible.  ';
    await page.fill('[data-testid="reflection-response"]', response);
    expect(await page.isDisabled('[data-testid="reflection-partial"]')).toBe(false);
    await page.click('[data-testid="reflection-partial"]');

    await expect.poll(async () => (await persistedState()).reflections[0]?.decision).toBe('partial');
    const after = await persistedState();
    expect(after.reflections[0].epistemicStatus).toBe('partial');
    expect(after.reflections[0].response).toBe(response);
  });

  it.each([
    ['reject', 'rejected'],
    ['uncertain', 'uncertain']
  ] as const)('records %s without inventing a response', async (decision, status) => {
    await seedPendingReflection(`reflection_ui_${decision}`);
    await page.click('[data-testid="open-reflection"]');
    await page.click(`[data-testid="reflection-${decision}"]`);

    await expect.poll(async () => (await persistedState()).reflections[0]?.epistemicStatus).toBe(status);
    const after = await persistedState();
    expect(after.reflections[0].decision).toBe(decision);
    expect(after.reflections[0].response).toBe('');
  });

  it('requires Greyson words for Revise and leaves the replacement unresolved', async () => {
    await seedPendingReflection('reflection_ui_revise');
    await page.click('[data-testid="open-reflection"]');
    expect(await page.isDisabled('[data-testid="reflection-revise"]')).toBe(true);

    await page.fill('[data-testid="reflection-response"]', 'Replacement wording from Greyson.');
    await page.click('[data-testid="reflection-revise"]');

    await expect.poll(async () => (await persistedState()).reflections[0]?.decision).toBe('revise');
    const after = await persistedState();
    expect(after.reflections[0].response).toBe('Replacement wording from Greyson.');
    expect(after.reflections[0].epistemicStatus).toBe('pending');

    // The unresolved revision remains available for later RF05 handling.
    await page.waitForSelector('[data-testid="open-reflection"]');
  });

  it('marks a Reflection PRIVATE without changing XP, turns or evidence', async () => {
    await seedPendingReflection('reflection_ui_private');
    const before = await persistedState();
    await page.click('[data-testid="open-reflection"]');
    await page.click('[data-testid="reflection-private"]');

    await expect.poll(async () => (await persistedState()).reflections[0]?.privacy).toBe('private');
    const after = await persistedState();
    expect(after.reflections[0].decision).toBe('private');
    expect(after.reflections[0].epistemicStatus).toBe('pending');
    expect(after.reflections[0].response).toBe('');
    expect(after.xp).toBe(before.xp);
    expect(after.turns).toEqual(before.turns);
    expect(after.evidence).toEqual(before.evidence);
    expect(await page.locator('[data-testid="open-reflection"]').count()).toBe(0);
  });

  it('fits at 320px with accessible decision targets and no horizontal overflow', async () => {
    await seedPendingReflection('reflection_ui_mobile');
    await page.setViewportSize(NARROW);

    const offer = await page.locator('[data-testid="open-reflection"]').boundingBox();
    expect(offer).not.toBeNull();
    expect(offer!.height).toBeGreaterThanOrEqual(44);
    expect(offer!.width).toBeGreaterThanOrEqual(44);

    await page.click('[data-testid="open-reflection"]');
    await page.waitForSelector('[data-testid="reflection-panel"]');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow).toBeLessThanOrEqual(0);

    for (const id of [
      'reflection-close',
      'reflection-confirm',
      'reflection-partial',
      'reflection-reject',
      'reflection-uncertain',
      'reflection-revise',
      'reflection-private'
    ]) {
      const box = await page.locator(`[data-testid="${id}"]`).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height, `${id} height`).toBeGreaterThanOrEqual(44);
      expect(box!.width, `${id} width`).toBeGreaterThanOrEqual(44);
    }

    await page.setViewportSize(PHONE);
  });
});
