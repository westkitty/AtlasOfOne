import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, openAgency, wakeAtlas } from './helper';
import { serveDist } from './server';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import { serializeCampaign } from '../../src/persistence/transfer';
import type { EvidenceRecord, TurnRecord } from '../../src/game/types';

/**
 * Real-application proof of the BUG-001..BUG-004 concurrency guards.
 *
 * The suite these replace, `tests/adversarial/async-hammer.test.ts`, declared its
 * own `let isSubmitting` / `let currentRequestId` / `let cancelled` and then
 * tested those local variables. Deleting every guard in `src/App.tsx` left it
 * green, so it proved that the author could write the algorithm twice and
 * nothing about the shipped application.
 *
 * Everything here drives the real production bundle in installed Chrome: real
 * DOM handlers, real React state, real IndexedDB, the real import control and
 * the real voice controls. Only the same-origin `/api/*` boundary is stubbed,
 * and its responses are held open on demand so a genuine in-flight window
 * exists. No Cloudflare account, no credentials, no inference, no neurons.
 *
 * Synthetic data only.
 */

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };

const SYNTHETIC_A = 'For example, when a group has to make a difficult choice, I slow down and ask what each option costs the people with the least power.';
const SYNTHETIC_B = 'Synthetic second coordinate recorded for concurrency verification only.';

const MODEL_ID = '@cf/qwen/qwen3-30b-a3b-fp8';

/** A schema-valid provider turn. `reply` is varied so responses are tellable apart. */
const providerTurn = (reply: string, claim: string) => ({
  reply,
  nextQuestion: 'What does that cost you when the room wants a decision now?',
  presentation: 'normal',
  evidence: [{ dimension: 'self-description', claim, basis: 'explicit', strength: 2, territories: ['identity'] }],
  connections: [],
  quoteCandidates: [],
  summaryPatch: 'Identity coverage advanced.',
  achievementCandidates: []
});

let browser: Browser;
let host: { url: string; close: () => Promise<void> };

/** One isolated browser session with a controllable Worker stub. */
interface Session {
  context: BrowserContext;
  page: Page;
  /** Every `/api/turn` request the client actually started. */
  turnRequests: string[];
  /** Releases the Nth held `/api/turn` response, newest-last. */
  releaseTurn: (index: number, reply: string, claim: string) => Promise<void>;
  close: () => Promise<void>;
}

async function newSession(options: { holdTurns?: boolean } = {}): Promise<Session> {
  const holdTurns = options.holdTurns ?? true;
  const context = await browser.newContext({ viewport: PHONE });
  const page = await context.newPage();

  const turnRequests: string[] = [];
  const heldTurns: Array<(body: unknown) => void> = [];
  const heldTranscribes: Array<(body: unknown) => void> = [];

  await page.route('**/api/health', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, service: 'atlas-of-one', cartographer: 'workers-ai', model: MODEL_ID })
    })
  );

  await page.route('**/api/turn', async (route: Route) => {
    turnRequests.push(route.request().postData() ?? '');
    if (!holdTurns) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, turn: providerTurn('Synthetic reply.', 'Synthetic claim.'), modelId: MODEL_ID, repaired: false })
      });
      return;
    }
    // Hold the response open so the in-flight window is real, not simulated.
    const body = await new Promise<unknown>((resolve) => heldTurns.push(resolve));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/api/transcribe', async (route: Route) => {
    const body = await new Promise<unknown>((resolve) => heldTranscribes.push(resolve));
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.goto(host.url, { waitUntil: 'load' });
  await page.waitForSelector('.shell');
  await wakeAtlas(page);
  await completeOnboardingIfPresent(page);
  // The client only switches to the remote provider once the health probe lands.
  await page.waitForFunction(() => document.querySelector('.shell') !== null);
  await page.waitForTimeout(400);

  return {
    context,
    page,
    get turnRequests() {
      return turnRequests;
    },
    releaseTurn: async (index, reply, claim) => {
      const resolve = heldTurns[index];
      if (!resolve) throw new Error(`no held /api/turn response at index ${index} (have ${heldTurns.length})`);
      resolve({ ok: true, turn: providerTurn(reply, claim), modelId: MODEL_ID, repaired: false });
      await page.waitForTimeout(250);
    },
    close: async () => {
      // Release anything still parked so no route handler is left hanging.
      heldTurns.forEach((resolve) => resolve({ ok: false, code: 'network', message: 'closed' }));
      heldTranscribes.forEach((resolve) => resolve({ ok: false, code: 'network', message: 'closed' }));
      await context.close();
    }
  } as Session;
}

/** Reads the persisted campaign straight out of IndexedDB — the real store. */
async function persistedCampaign(page: Page): Promise<Record<string, any>> {
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

const xpOf = async (page: Page) => Number((await page.textContent('.xp span'))!.replace(/\D/g, ''));

async function gotoScreen(page: Page, screen: string) {
  while (await page.isVisible('.overlay')) await page.click('.overlay button:text("Continue")');
  await page.click(`nav button:has(small:text-is("${screen}"))`);
}

/** A valid, distinctly recognisable Campaign B export built by production code. */
function campaignBExport() {
  const turn: TurnRecord = {
    id: 'turn_campaign_b',
    createdAt: new Date('2026-01-01T00:00:00.000Z').toISOString(),
    territoryId: 'identity',
    dimension: 'self-description',
    question: 'Synthetic question for campaign B?',
    answer: 'CAMPAIGN_B_ANSWER_MARKER synthetic answer belonging to the imported campaign.',
    substantive: true,
    behavioralExample: false,
    revision: false,
    retracted: false
  };
  const evidence: EvidenceRecord = {
    id: 'ev_campaign_b',
    dimension: 'self-description',
    claim: 'CAMPAIGN_B_EVIDENCE_MARKER',
    sourceTurnIds: ['turn_campaign_b'],
    basis: 'explicit',
    strength: 2,
    territories: ['identity'],
    counterEvidenceIds: [],
    status: 'active',
    origin: 'player-stated'
  };
  const base = applyGameEvents(createInitialCampaign(), [
    { type: 'ONBOARDING_COMPLETED', sass: 'medium', voiceMode: 'text' },
    { type: 'ANSWER_ACCEPTED', turn },
    { type: 'EVIDENCE_ADDED', evidence }
  ]);
  return serializeCampaign({ ...base, campaignId: 'campaign_b_synthetic' });
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run `npm run build` before the concurrency suite').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('BUG-001 — one submission may start at most one provider request', () => {
  it('two synchronous clicks on the real submit button start exactly one /api/turn', async () => {
    const session = await newSession();
    try {
      const { page } = session;
      await gotoScreen(page, 'Talk');
      await page.fill('[data-testid="answer-input"]', SYNTHETIC_A);

      // Two real clicks dispatched in ONE browser task, before React can rerender
      // and before `disabled` can be applied. This is the actual double-tap.
      await page.evaluate(() => {
        const button = document.querySelector<HTMLButtonElement>('button.primary.full');
        if (!button) throw new Error('submit button missing');
        button.click();
        button.click();
      });
      await page.waitForTimeout(400);

      // Deduplicating the RESPONSE is not enough: two requests means Atlas did
      // duplicate provider work and could spend duplicate neuron budget.
      expect(session.turnRequests.length, 'exactly one provider request was started').toBe(1);
      expect(await page.textContent('button.primary.full')).toContain('Mapping coordinate');

      await session.releaseTurn(0, 'Synthetic reply A.', 'Decides by asking who carries the cost.');

      const persisted = await persistedCampaign(page);
      expect(persisted.turns.length, 'exactly one turn committed').toBe(1);
      expect(persisted.evidence.length, 'evidence awarded once').toBe(1);
      await gotoScreen(page, 'Map');
      expect(await xpOf(page)).toBe(13);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('the lock is released so a later legitimate submission still works', async () => {
    const session = await newSession();
    try {
      const { page } = session;
      await gotoScreen(page, 'Talk');
      await page.fill('[data-testid="answer-input"]', SYNTHETIC_A);
      await page.click('button.primary.full');
      await page.waitForTimeout(200);
      await session.releaseTurn(0, 'Synthetic reply A.', 'First claim.');

      // Clear any celebratory notice exactly as a player would before continuing.
      while (await page.isVisible('.overlay')) await page.click('.overlay button:text("Continue")');
      await page.fill('[data-testid="answer-input"]', SYNTHETIC_B);
      await page.click('button.primary.full');
      await page.waitForTimeout(200);
      expect(session.turnRequests.length, 'a second submission is not stranded by the lock').toBe(2);
      await session.releaseTurn(1, 'Synthetic reply B.', 'Second claim.');

      const persisted = await persistedCampaign(page);
      expect(persisted.turns.length).toBe(2);
    } finally {
      await session.close();
    }
  }, 120_000);
});

describe('BUG-002 — an obsolete response cannot mutate the newer campaign', () => {
  it('a request invalidated by a real import cannot commit after a newer one', async () => {
    const session = await newSession();
    try {
      const { page } = session;
      await gotoScreen(page, 'Talk');

      // Request A, held open.
      await page.fill('[data-testid="answer-input"]', SYNTHETIC_A);
      await page.click('button.primary.full');
      await page.waitForTimeout(200);
      expect(session.turnRequests.length).toBe(1);

      // A real import legitimately invalidates A and installs campaign B.
      await gotoScreen(page, 'Me');
      await page.setInputFiles('.file input', {
        name: 'campaign-b.atlas.json',
        mimeType: 'application/json',
        buffer: Buffer.from(campaignBExport())
      });
      await page.waitForSelector('.toast:text-matches("imported and validated")');

      // Request B on the imported campaign.
      await gotoScreen(page, 'Talk');
      await page.fill('[data-testid="answer-input"]', SYNTHETIC_B);
      await page.click('button.primary.full');
      await page.waitForTimeout(200);
      expect(session.turnRequests.length).toBe(2);

      // Newer first, obsolete afterwards.
      await session.releaseTurn(1, 'Synthetic reply B.', 'CLAIM_FROM_REQUEST_B');
      await session.releaseTurn(0, 'Synthetic reply A.', 'CLAIM_FROM_REQUEST_A');
      await page.waitForTimeout(400);

      const persisted = await persistedCampaign(page);
      expect(persisted.campaignId, 'campaign B stayed active').toBe('campaign_b_synthetic');
      const claims = persisted.evidence.map((item: any) => item.claim);
      expect(claims, 'B committed').toContain('CLAIM_FROM_REQUEST_B');
      expect(claims, 'the obsolete response committed nothing').not.toContain('CLAIM_FROM_REQUEST_A');
      const answers = persisted.turns.map((item: any) => item.answer);
      expect(answers).not.toContain(SYNTHETIC_A);
    } finally {
      await session.close();
    }
  }, 120_000);
});

describe('BUG-002b — STOP and PRIVATE during an in-flight turn', () => {
  it('PRIVATE prevents the resolving turn from committing to the closed dimension', async () => {
    const session = await newSession();
    try {
      const { page } = session;
      await gotoScreen(page, 'Talk');
      await page.fill('[data-testid="answer-input"]', SYNTHETIC_A);
      await page.click('button.primary.full');
      await page.waitForTimeout(200);
      expect(session.turnRequests.length).toBe(1);

      // The real permanent control, used mid-flight.
      await openAgency(page);
      await page.click('[data-testid="agency-private"]');
      await page.waitForTimeout(150);

      await session.releaseTurn(0, 'Synthetic reply A.', 'CLAIM_AFTER_PRIVATE');

      const persisted = await persistedCampaign(page);
      expect(persisted.privateTopics.length, 'the dimension was closed').toBeGreaterThan(0);
      expect(persisted.turns.length, 'no turn committed').toBe(0);
      expect(persisted.evidence.length, 'no evidence committed').toBe(0);
      expect(persisted.xp, 'no progression').toBe(0);
    } finally {
      await session.close();
    }
  }, 120_000);

  it('STOP prevents the resolving turn from committing to the paused campaign', async () => {
    const session = await newSession();
    try {
      const { page } = session;
      await gotoScreen(page, 'Talk');
      await page.fill('[data-testid="answer-input"]', SYNTHETIC_A);
      await page.click('button.primary.full');
      await page.waitForTimeout(200);
      expect(session.turnRequests.length).toBe(1);

      await openAgency(page);
      await page.click('[data-testid="agency-stop"]');
      await page.waitForTimeout(150);

      await session.releaseTurn(0, 'Synthetic reply A.', 'CLAIM_AFTER_STOP');

      const persisted = await persistedCampaign(page);
      expect(persisted.sessionStatus, 'campaign is paused').toBe('paused');
      expect(persisted.turns.length, 'no turn committed').toBe(0);
      expect(persisted.evidence.length, 'no evidence committed').toBe(0);
      expect(persisted.xp, 'no progression').toBe(0);
    } finally {
      await session.close();
    }
  }, 120_000);
});

describe('BUG-003 — a cross-campaign import is not contaminated by an in-flight turn', () => {
  it('an in-flight request from campaign A leaves imported campaign B exactly as imported', async () => {
    const session = await newSession();
    try {
      const { page } = session;
      await gotoScreen(page, 'Talk');
      await page.fill('[data-testid="answer-input"]', SYNTHETIC_A);
      await page.click('button.primary.full');
      await page.waitForTimeout(200);
      expect(session.turnRequests.length).toBe(1);

      await gotoScreen(page, 'Me');
      await page.setInputFiles('.file input', {
        name: 'campaign-b.atlas.json',
        mimeType: 'application/json',
        buffer: Buffer.from(campaignBExport())
      });
      await page.waitForSelector('.toast:text-matches("imported and validated")');

      const imported = await persistedCampaign(page);

      // Resolve the obsolete request afterwards. No further submission is made.
      await session.releaseTurn(0, 'Synthetic reply A.', 'CLAIM_FROM_CAMPAIGN_A');
      await page.waitForTimeout(400);

      const after = await persistedCampaign(page);
      expect(after.campaignId).toBe('campaign_b_synthetic');
      expect(after.turns.length, 'B keeps exactly its imported turns').toBe(imported.turns.length);
      expect(after.evidence.length).toBe(imported.evidence.length);
      expect(after.xp).toBe(imported.xp);
      expect(after.level).toBe(imported.level);

      const serialized = JSON.stringify(after);
      expect(serialized, 'no campaign A evidence leaked in').not.toContain('CLAIM_FROM_CAMPAIGN_A');
      expect(serialized, 'no campaign A answer leaked in').not.toContain(SYNTHETIC_A);
      expect(serialized, 'B is intact').toContain('CAMPAIGN_B_EVIDENCE_MARKER');
    } finally {
      await session.close();
    }
  }, 120_000);
});

describe('BUG-004 — a cancelled transcription cannot submit', () => {
  it('leaving voice mode mid-transcription discards the result and starts no turn', async () => {
    const context = await browser.newContext({ viewport: PHONE });
    const page = await context.newPage();
    const turnRequests: string[] = [];
    const heldTranscribes: Array<(body: unknown) => void> = [];
    try {
      // Minimal deterministic media primitives, installed before app code runs.
      await page.addInitScript(() => {
        class FakeRecorder {
          state = 'inactive';
          ondataavailable: ((event: { data: Blob }) => void) | null = null;
          onstop: (() => void) | null = null;
          onerror: (() => void) | null = null;
          static isTypeSupported() {
            return true;
          }
          constructor(_stream: unknown, _options?: unknown) {}
          start() {
            this.state = 'recording';
          }
          stop() {
            this.state = 'inactive';
            this.ondataavailable?.({ data: new Blob([new Uint8Array(256)], { type: 'audio/webm' }) });
            this.onstop?.();
          }
        }
        (window as any).MediaRecorder = FakeRecorder;
        Object.defineProperty(navigator, 'mediaDevices', {
          configurable: true,
          value: { getUserMedia: async () => ({ getTracks: () => [{ stop() {} }] }) }
        });
      });

      await page.route('**/api/health', (route: Route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, service: 'atlas-of-one', cartographer: 'workers-ai', model: MODEL_ID })
        })
      );
      await page.route('**/api/turn', async (route: Route) => {
        turnRequests.push(route.request().postData() ?? '');
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ok: true, turn: providerTurn('Should never be reached.', 'unreachable'), modelId: MODEL_ID, repaired: false })
        });
      });
      await page.route('**/api/transcribe', async (route: Route) => {
        const body = await new Promise<unknown>((resolve) => heldTranscribes.push(resolve));
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });

      await page.goto(host.url, { waitUntil: 'load' });
      await page.waitForSelector('.shell');
  await wakeAtlas(page);
      await completeOnboardingIfPresent(page);
      await page.waitForTimeout(400);

      await gotoScreen(page, 'Talk');
      // Talk starts the conversation on its own: Atlas speaks, then listens.
      await page.click('[data-testid="mode-talk"]');
      await page.waitForSelector('[data-testid="mic-stop"]', { timeout: 30_000 });

      // Stop recording; Atlas enters transcription and the response is held.
      await page.click('[data-testid="voice-submit-done"]');
      await page.waitForFunction(() => document.querySelector('[data-testid="voice-status"]')?.textContent?.length);
      await page.waitForTimeout(300);
      expect(heldTranscribes.length, 'a transcription request is in flight').toBe(1);

      // The player leaves voice mode through the real control while it is pending.
      await page.click('[data-testid="mode-type"]');
      await page.waitForTimeout(150);

      // A successful transcription arrives afterwards. It must be discarded.
      heldTranscribes[0]({ ok: true, text: 'STALE_TRANSCRIPT_MARKER should never be submitted.', modelId: '@cf/openai/whisper-tiny-en' });
      await page.waitForTimeout(500);

      expect(turnRequests.length, 'the stale transcription started no provider turn').toBe(0);
      const persisted = await persistedCampaign(page);
      expect(persisted.turns.length, 'no turn committed').toBe(0);
      expect(persisted.evidence.length).toBe(0);
      expect(persisted.xp).toBe(0);
      expect(JSON.stringify(persisted)).not.toContain('STALE_TRANSCRIPT_MARKER');

      // And the campaign is still usable by typing.
      expect(await page.isVisible('[data-testid="answer-input"]')).toBe(true);
      await page.fill('[data-testid="answer-input"]', SYNTHETIC_B);
      await page.click('button.primary.full');
      await page.waitForTimeout(400);
      expect(turnRequests.length, 'a legitimate typed submission still works').toBe(1);
    } finally {
      heldTranscribes.forEach((resolve) => resolve({ ok: false, code: 'network', message: 'closed' }));
      await context.close();
    }
  }, 120_000);
});
