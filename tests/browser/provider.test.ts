import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, openAgency, wakeAtlas, navigateTo } from './helper';
import { serveDist } from './server';

/**
 * Real-browser proof of the provider path.
 *
 * The production client bundle runs in installed Chrome and talks to a stubbed
 * same-origin `/api/*`. That proves the browser half end to end — health probe,
 * compiled-context request, validated response, deterministic application, and
 * typed degradation — without a Cloudflare account.
 *
 * It is NOT a claim that real Workers AI inference occurred. The stub stands in
 * for the model; the Worker's own runtime behaviour is proven separately.
 */

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };

/** Synthetic answers only. */
const SYNTHETIC = 'For example, when a group has to make a difficult choice, I slow down and ask what each option costs the people with the least power.';
const MODEL_REPLY = 'Synthetic provider reply: that reads as a cost-first way of deciding.';

let browser: Browser;
let page: Page;
let host: { url: string; close: () => Promise<void> };
const pageErrors: string[] = [];

/** Compiled contexts the client actually sent, for inspection. */
const sentContexts: Array<Record<string, any>> = [];
let turnMode: 'ok' | 'quota' = 'ok';
let healthProbes = 0;

const providerTurn = {
  reply: MODEL_REPLY,
  nextQuestion: 'What does slowing down cost you when the room wants a decision now?',
  presentation: 'normal',
  evidence: [{ dimension: 'self-description', claim: 'Decides by asking who carries the cost.', basis: 'explicit', strength: 2, territories: ['identity'] }],
  connections: [],
  quoteCandidates: [],
  summaryPatch: 'Identity coverage advanced.',
  achievementCandidates: []
};

// The world HUD renders a level pip and a hairline, so progression is read
// from the values it is rendering from rather than a stats panel.
const xpOf = async () => Number(await page.getAttribute('[data-testid="hud-progress"]', 'data-xp'));

async function dismissNotices() {
  // Milestones are brief, non-blocking banners that clear themselves, so this
  // waits them out rather than clicking a modal away.
  if (await page.isVisible('[data-testid="milestone"]').catch(() => false)) {
    await page.locator('[data-testid="milestone"]').waitFor({ state: 'detached', timeout: 20_000 }).catch(() => undefined);
  }
}

async function goto(screen: string) {
  await dismissNotices();
  await navigateTo(page, screen);
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run `npm run build` before the provider journey').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: PHONE });
  page.on('pageerror', (error: Error) => pageErrors.push(error.message));

  // Same-origin Worker stub. Installed before navigation so the startup health
  // probe is served and the client switches to the remote provider.
  await page.route('**/api/health', (route: Route) => {
    healthProbes += 1;
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, service: 'atlas-of-one', cartographer: 'workers-ai', model: '@cf/google/gemma-4-26b-a4b-it' }) });
  });

  await page.route('**/api/turn', async (route: Route) => {
    try { sentContexts.push(JSON.parse(route.request().postData() ?? '{}')); } catch { /* recorded as unparsed */ }
    if (turnMode === 'quota') {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, code: 'quota-exhausted', message: "That is the Cartographer's thinking for today.", retryable: false })
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, turn: providerTurn, modelId: '@cf/google/gemma-4-26b-a4b-it', repaired: false, usage: { inputTokens: 1400, outputTokens: 320, neurons: 21 } })
    });
  });

  await page.goto(host.url, { waitUntil: 'load' });
  await page.waitForSelector('.shell');
  await wakeAtlas(page);
  await completeOnboardingIfPresent(page);
  // Let the health probe resolve and flip the client onto the remote provider.
  // `expect.poll` is unavailable in a hook, so this waits explicitly.
  for (let attempt = 0; attempt < 100 && healthProbes === 0; attempt += 1) await page.waitForTimeout(50);
  expect(healthProbes).toBeGreaterThan(0);
  await page.waitForTimeout(300);
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('browser to Worker provider path', () => {
  it('1. sends a compiled context to /api/turn and applies the returned turn', async () => {
    const before = await xpOf();
    await goto('Talk');
    await page.fill('.answer textarea', SYNTHETIC);
    await page.click('button:text("Map this answer")');

    await expect.poll(() => page.textContent('.convo-reply'), { timeout: 10_000 }).toContain('cost-first way of deciding');
    await goto('Map');
    // Same deterministic arithmetic as the mock path: 5 + 3 + 3 + 2.
    await expect.poll(xpOf).toBe(before + 13);
  });

  it('2. the outgoing payload is a compiled context, not a transcript', async () => {
    const context = sentContexts.at(-1)!;
    expect(context.task.answer).toContain('difficult choice');
    expect(context.agencyRules.length).toBeGreaterThan(0);
    expect(Array.isArray(context.recentTurns)).toBe(true);
    // The whole transcript is never sent: the recent window is bounded.
    expect(context.recentTurns.length).toBeLessThanOrEqual(4);
    expect(context).not.toHaveProperty('turns');
    expect(context).not.toHaveProperty('campaignHistory');
  });

  it('3. records the model as the evidence provenance in IndexedDB', async () => {
    const origins = await page.evaluate(async () => {
      const open = indexedDB.open('atlas-of-one');
      return new Promise<Array<{ origin: string; providerId: string }>>((resolve) => {
        open.onsuccess = () => {
          const request = open.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
          request.onsuccess = () => resolve((request.result?.state?.evidence ?? []).map((item: any) => ({ origin: item.origin, providerId: item.providerId })));
        };
      });
    });
    expect(origins.length).toBeGreaterThan(0);
    expect(origins.at(-1)!.origin).toBe('model-proposed');
    expect(origins.at(-1)!.providerId).toContain('workers-ai:');
  });

  it('4. a PRIVATE dimension never appears in a later outgoing payload', async () => {
    await goto('Talk');
    const closed = (await page.textContent('[data-testid="prompt-dimension"]'))!.replace('Evidence dimension: ', '').trim();
    await openAgency(page);
    await page.click('[data-testid="agency-private"]');
    await expect.poll(() => page.textContent('.convo-reply')).toContain('not intentionally return');

    const countBefore = sentContexts.length;
    await page.fill('.answer textarea', 'A second synthetic answer after closing a topic.');
    await page.click('button:text("Map this answer")');
    await expect.poll(() => sentContexts.length, { timeout: 10_000 }).toBeGreaterThan(countBefore);

    const context = sentContexts.at(-1)!;
    // The label travels so the model knows to avoid it; the content does not.
    expect(context.retiredDimensions).toContain(closed);
    expect(context.relevantEvidence.some((item: any) => item.dimension === closed)).toBe(false);
    expect(context.recentTurns.some((item: any) => item.dimension === closed)).toBe(false);
  });

  it('5. quota exhaustion degrades without losing the answer', async () => {
    turnMode = 'quota';
    await dismissNotices();
    const before = await (async () => { await goto('Map'); return xpOf(); })();
    await goto('Talk');
    await page.fill('.answer textarea', 'A synthetic answer submitted while the daily allocation is spent.');
    await page.click('button:text("Map this answer")');

    // Player-facing degraded state, in Atlas's own words.
    await expect.poll(() => page.textContent('.toast'), { timeout: 10_000 }).toContain('thinking for today');
    await goto('Map');
    // The answer was still mapped: 5 accepted + 2 evidence from the local turn.
    await expect.poll(xpOf).toBeGreaterThan(before);
  });

  it('6. the degraded message carries no backend jargon', async () => {
    const toast = (await page.textContent('.toast').catch(() => '')) ?? '';
    expect(toast).not.toMatch(/429|quota-exhausted|binding|schema|http|neuron|@cf\//i);
  });

  it('7. raises no unhandled page errors across the provider flows', () => {
    expect(pageErrors).toEqual([]);
  });
});
