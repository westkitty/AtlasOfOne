import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { availableBosses, availableDoors } from '../../src/game/encounters';
import { serializeCampaign } from '../../src/persistence/transfer';
import { seededCampaign } from '../fixtures/synthetic';
import { completeOnboardingIfPresent, wakeAtlas, navigateTo } from './helper';
import { serveDist } from './server';

/**
 * Real-application proof for the encounter submission boundary (UNV-022).
 *
 * `submitEncounter` guards on `isSubmitting`, React state read from the render
 * closure, and — unlike the ordinary Talk submit button — its control is not
 * even `disabled` on that state. Two clicks dispatched in one browser task
 * therefore both reach the handler before React rerenders.
 *
 * The two encounter types are checked independently, because the engine treats
 * them differently: `BOSS_STAGE_ANSWERED` applies unconditionally to whichever
 * stage is current, while `DOOR_ANSWERED` bails out when no door run is active.
 * A shared verdict would hide that difference.
 *
 * The invariant covers deterministic state AND provider work: one logical
 * submission may cause at most one enrichment request, because a duplicate
 * request spends quota even though the model owns no progression.
 *
 * Everything drives the production bundle in installed Chrome through the real
 * import path and the real encounter UI. Only same-origin `/api/*` is stubbed.
 * No credentials, no inference, no neurons. Synthetic data only.
 */

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };

const SYNTHETIC = 'Synthetic position recorded for encounter concurrency verification: the mapped commitment wins, and the cost is a slower decision.';
const MODEL_ID = '@cf/qwen/qwen3-30b-a3b-fp8';

const providerTurn = {
  reply: 'Synthetic enrichment reply.',
  nextQuestion: 'What does holding that position cost you?',
  presentation: 'normal',
  evidence: [],
  connections: [],
  quoteCandidates: [],
  summaryPatch: '',
  achievementCandidates: []
};

let browser: Browser;
let host: { url: string; close: () => Promise<void> };

interface Session {
  context: BrowserContext;
  page: Page;
  /** Enrichment requests the client actually started. */
  turnRequests: () => number;
  close: () => Promise<void>;
}

/** A fresh browser profile with the seeded synthetic campaign already imported. */
async function newSeededSession(): Promise<Session> {
  const context = await browser.newContext({ viewport: PHONE });
  const page = await context.newPage();
  let turnRequests = 0;

  await page.route('**/api/health', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, service: 'atlas-of-one', cartographer: 'workers-ai', model: MODEL_ID })
    })
  );
  await page.route('**/api/turn', (route: Route) => {
    turnRequests += 1;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, turn: providerTurn, modelId: MODEL_ID, repaired: false })
    });
  });

  await page.goto(host.url, { waitUntil: 'load' });
  await page.waitForSelector('.shell');
  await wakeAtlas(page);
  await completeOnboardingIfPresent(page);
  // Let the health probe land so the client selects the remote provider.
  await page.waitForTimeout(400);

  const seed = seededCampaign({ territories: ['identity', 'values', 'cognition'], xp: 700 });
  expect(availableBosses(seed).length, 'seed offers a Boss Fight').toBeGreaterThan(0);
  expect(availableDoors(seed).length, 'seed offers a Mystery Door').toBeGreaterThan(0);

  await gotoScreen(page, 'Me');
  await page.setInputFiles('.file input', {
    name: 'synthetic.atlas.json',
    mimeType: 'application/json',
    buffer: Buffer.from(serializeCampaign(seed))
  });
  await page.waitForSelector('.toast:text-matches("imported and validated")');
  await gotoScreen(page, 'Map');
  // Encounter offers live in the menu now; their presentation is unchanged.
  await page.click('[data-testid="open-menu"]');
  await page.waitForSelector('[data-testid="encounter-offers"]');

  return {
    context,
    page,
    turnRequests: () => turnRequests,
    close: () => context.close()
  };
}

async function dismissNotices(page: Page) {
  // Milestones are brief, non-blocking banners that clear themselves, so this
  // waits them out rather than clicking a modal away.
  if (await page.isVisible('[data-testid="milestone"]').catch(() => false)) {
    await page.locator('[data-testid="milestone"]').waitFor({ state: 'detached', timeout: 20_000 }).catch(() => undefined);
  }
}

async function gotoScreen(page: Page, screen: string) {
  await dismissNotices(page);
  await navigateTo(page, screen);
}

/** Reads the persisted campaign straight out of IndexedDB. */
async function persisted(page: Page): Promise<Record<string, any>> {
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

/** Two real clicks on the encounter submit control, dispatched in ONE task. */
async function doubleTapEncounterSubmit(page: Page) {
  await page.evaluate(() => {
    const button = document.querySelector<HTMLButtonElement>('[data-testid="encounter-submit"]');
    if (!button) throw new Error('encounter submit button missing');
    button.click();
    button.click();
  });
  await page.waitForTimeout(500);
}

async function enterFirstOffer(page: Page, selector: string) {
  await gotoScreen(page, 'Map');
  // Encounter offers live in the one menu now.
  await page.click('[data-testid="open-menu"]');
  await page.waitForSelector('[data-testid="encounter-offers"]');
  await page.locator(selector).first().click();
  await page.waitForSelector('[data-testid="encounter-input"]');
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run `npm run build` before the encounter concurrency suite').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('Boss Fight — one submission answers at most one stage', () => {
  it('a same-task double tap answers exactly one stage and starts one enrichment request', async () => {
    const session = await newSeededSession();
    try {
      const { page } = session;
      await enterFirstOffer(page, '[data-testid^="start-boss-"]');

      const before = await persisted(page);
      const bossBefore = before.bossRuns.find((run: any) => run.status === 'active');
      expect(bossBefore, 'a boss run is active').toBeTruthy();
      const answeredBefore = bossBefore.stages.filter((s: any) => s.outcome !== 'pending').length;
      const requestsBefore = session.turnRequests();

      await page.fill('[data-testid="encounter-input"]', SYNTHETIC);
      await doubleTapEncounterSubmit(page);

      const after = await persisted(page);
      const bossAfter = after.bossRuns.find((run: any) => run.id === bossBefore.id);
      const answeredAfter = bossAfter.stages.filter((s: any) => s.outcome !== 'pending').length;

      // One player action, one stage.
      expect(answeredAfter - answeredBefore, 'exactly one stage advanced').toBe(1);
      // One stored answer, and the same text is not recorded twice.
      expect(after.turns.length - before.turns.length, 'exactly one turn recorded').toBe(1);
      expect(after.turns.filter((t: any) => t.answer === SYNTHETIC).length, 'the answer is stored once').toBe(1);
      // XP awarded once.
      // answerXp = 5 + 3 (length >= 80) for this fixture.
      expect(after.xp - before.xp, 'ordinary answer XP awarded once').toBe(8);
      // And one enrichment request, because a duplicate spends quota.
      expect(session.turnRequests() - requestsBefore, 'exactly one enrichment request').toBe(1);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('the next legitimate stage remains immediately submittable', async () => {
    const session = await newSeededSession();
    try {
      const { page } = session;
      await enterFirstOffer(page, '[data-testid^="start-boss-"]');

      const before = await persisted(page);
      await page.fill('[data-testid="encounter-input"]', SYNTHETIC);
      await page.click('[data-testid="encounter-submit"]');
      await page.waitForTimeout(300);

      // Immediately answer the next stage the way a player would.
      await page.fill('[data-testid="encounter-input"]', `${SYNTHETIC} Second stage.`);
      await page.click('[data-testid="encounter-submit"]');
      await page.waitForTimeout(300);

      const after = await persisted(page);
      expect(after.turns.length - before.turns.length, 'both legitimate stages recorded').toBe(2);
      const boss = after.bossRuns.find((run: any) => run.id === before.bossRuns.find((r: any) => r.status === 'active').id);
      expect(boss.stages.filter((s: any) => s.outcome !== 'pending').length, 'two stages answered').toBe(2);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('PASS, STOP and stepping back still work after a submission', async () => {
    const session = await newSeededSession();
    try {
      const { page } = session;
      await enterFirstOffer(page, '[data-testid^="start-boss-"]');
      await page.fill('[data-testid="encounter-input"]', SYNTHETIC);
      await page.click('[data-testid="encounter-submit"]');
      await page.waitForTimeout(300);

      // PASS advances at no cost.
      const beforePass = await persisted(page);
      await page.click('[data-testid="agency-pass"]');
      await page.waitForTimeout(200);

      // STOP pauses and blocks submission.
      await page.click('[data-testid="agency-stop"]');
      await page.waitForTimeout(200);
      expect((await persisted(page)).sessionStatus).toBe('paused');
      expect(await page.isDisabled('[data-testid="encounter-submit"]')).toBe(true);
      await page.click('[data-testid="agency-stop"]');
      await page.waitForTimeout(200);

      // Stepping back keeps progress.
      await page.click('[data-testid="encounter-leave"]');
      await page.waitForTimeout(200);
      const after = await persisted(page);
      expect(after.xp).toBeGreaterThanOrEqual(beforePass.xp);
      expect(after.bossRuns.length).toBeGreaterThan(0);
    } finally {
      await session.close();
    }
  }, 120_000);
});

describe('Mystery Door — one submission crosses at most once', () => {
  it('a same-task double tap crosses once and starts one enrichment request', async () => {
    const session = await newSeededSession();
    try {
      const { page } = session;
      await enterFirstOffer(page, '[data-testid^="open-door_"]');

      const before = await persisted(page);
      const doorBefore = before.doorRuns.find((run: any) => run.status === 'open');
      expect(doorBefore, 'a door run is open').toBeTruthy();
      const requestsBefore = session.turnRequests();

      await page.fill('[data-testid="encounter-input"]', SYNTHETIC);
      await doubleTapEncounterSubmit(page);

      const after = await persisted(page);

      // One stored answer, one crossing Insight, one completed door.
      expect(after.turns.length - before.turns.length, 'exactly one turn recorded').toBe(1);
      expect(after.turns.filter((t: any) => t.answer === SYNTHETIC).length, 'the answer is stored once').toBe(1);
      expect(after.insights.length - before.insights.length, 'exactly one crossing insight').toBe(1);
      expect(after.doorRuns.filter((r: any) => r.status === 'complete').length, 'exactly one completed door').toBe(1);
      expect(after.activeDoor, 'the door closed').toBeNull();

      // Ordinary answer XP once plus the single fixed door reward.
      // answerXp 8 + DOOR_XP_REWARD 20.
      expect(after.xp - before.xp, 'door reward paid exactly once').toBe(28);

      // And one enrichment request — a duplicate would spend quota even though
      // the engine ignores a second DOOR_ANSWERED.
      expect(session.turnRequests() - requestsBefore, 'exactly one enrichment request').toBe(1);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('a legitimate single crossing still completes with its reward and achievement', async () => {
    const session = await newSeededSession();
    try {
      const { page } = session;
      await enterFirstOffer(page, '[data-testid^="open-door_"]');
      const before = await persisted(page);

      await page.fill('[data-testid="encounter-input"]', SYNTHETIC);
      await page.click('[data-testid="encounter-submit"]');
      await page.waitForTimeout(400);

      const after = await persisted(page);
      expect(after.xp - before.xp).toBe(28);
      expect(after.insights.length - before.insights.length).toBe(1);
      expect(after.doorRuns.some((r: any) => r.status === 'complete')).toBe(true);
      expect(after.achievements.filter((a: any) => a.unlockedAt).length).toBeGreaterThanOrEqual(
        before.achievements.filter((a: any) => a.unlockedAt).length
      );
    } finally {
      await session.close();
    }
  }, 120_000);
});
