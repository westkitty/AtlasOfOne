import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Download, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { TERRITORY_DEFINITIONS } from '../../src/game/data';
import { applyGameEvents, campaignReachedEndState } from '../../src/game/engine';
import type { EvidenceRecord, TurnRecord } from '../../src/game/types';
import { serializeCampaign } from '../../src/persistence/transfer';
import { seededCampaign } from '../fixtures/synthetic';
import { completeOnboardingIfPresent, wakeAtlas, navigateTo } from './helper';
import { serveDist } from './server';

/**
 * PND-004 — the Phase 5 long-session gate.
 *
 * Every one of these five operations already had its own proof. What had never
 * been shown is that they survive as ONE lineage, which is exactly where state
 * carried across steps tends to break:
 *
 *   long campaign -> retraction -> export of the retracted state -> delete ->
 *   import of THAT SAME FILE -> restored retraction -> finalization ->
 *   assessment persistence
 *
 * So this is deliberately one browser context, one page, one continuous
 * scenario. The `it` blocks are sequential stages of a single session, not
 * independent tests: each depends on the state the previous one left behind, and
 * a failure early invalidates everything after it.
 *
 * Every state transition after the session becomes visible happens through the
 * real UI — the Vault retraction control, the Export button, the Delete flow,
 * the file input, the Synthesize button. Nothing here dispatches a game event,
 * writes IndexedDB mid-session, or hand-edits the exported file.
 *
 * Finalization runs on the deterministic local synthesizer: `/api/health` is
 * stubbed as `disabled`, so no `/api/finalize` request is ever made. UNV-018
 * stays open. No credentials, no Workers AI, no neurons.
 *
 * Synthetic data only.
 */

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };

/** Appears in exactly one answer and one evidence claim, nowhere else in Atlas. */
const RETRACTION_CANARY = 'CANARY_RETRACTED_ANSWER_c41f7b';
const CANARY_ANSWER = `${RETRACTION_CANARY} — a synthetic position I later take back, recorded only to prove retraction survives an export and import round trip.`;

let browser: Browser;
let context: BrowserContext;
let page: Page;
let host: { url: string; close: () => Promise<void> };

/** Anchors captured at stage 0 and compared across the whole chain. */
interface Anchors {
  campaignId: string;
  xp: number;
  level: number;
  turns: number;
  activeEvidence: number;
  fragments: number;
  privateTopics: string[];
  territoryStatuses: string;
}
let baseline: Anchors;
let afterRetraction: Anchors;
let exportedFile: Buffer;
let targetTurnId: string;

/**
 * A substantial campaign with every territory charted, plus one deliberately
 * REDUNDANT extra answer carrying the canary.
 *
 * Redundancy is the point: the extra evidence sits on a dimension that is
 * already covered, so retracting it retires evidence without dropping the
 * campaign out of its end state. That lets stage 1 prove retraction really
 * invalidates evidence while stage 5 still has a finalizable campaign.
 *
 * Built entirely through deterministic engine helpers — no forged progression.
 */
function longCampaign() {
  const territoryIds = TERRITORY_DEFINITIONS.map((t) => t.id);
  const base = seededCampaign({ territories: territoryIds });

  // Reuse a dimension the campaign already covers, so coverage cannot depend on
  // the record we are about to retract.
  const covered = base.evidence[0];
  const duplicateOnSameDimension = base.evidence.filter((e) => e.dimension === covered.dimension).length;
  expect(duplicateOnSameDimension, 'the canary dimension is already covered once').toBe(1);

  const turn: TurnRecord = {
    id: 'turn_retraction_target',
    createdAt: new Date('2026-02-01T00:00:00.000Z').toISOString(),
    territoryId: covered.territories[0],
    dimension: covered.dimension,
    question: 'Synthetic question whose answer will be taken back?',
    answer: CANARY_ANSWER,
    substantive: true,
    behavioralExample: false,
    revision: false,
    retracted: false
  };
  const evidence: EvidenceRecord = {
    id: 'ev_retraction_target',
    dimension: covered.dimension,
    claim: `${RETRACTION_CANARY} derived claim`,
    sourceTurnIds: [turn.id],
    basis: 'explicit',
    strength: 2,
    territories: [...covered.territories],
    counterEvidenceIds: [],
    status: 'active',
    origin: 'player-stated'
  };

  const state = applyGameEvents(base, [
    { type: 'ONBOARDING_COMPLETED', sass: 'medium', voiceMode: 'text' },
    { type: 'ANSWER_ACCEPTED', turn },
    { type: 'EVIDENCE_ADDED', evidence }
  ]);

  expect(campaignReachedEndState(state), 'fixture starts in end state').toBe(true);
  expect(state.finalAssessment ?? null, 'fixture has no assessment yet').toBeNull();
  return { state: { ...state, campaignId: 'campaign_phase5_long_session' }, targetTurnId: turn.id };
}

async function persisted(): Promise<Record<string, any> | null> {
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

const anchorsOf = (s: Record<string, any>): Anchors => ({
  campaignId: s.campaignId,
  xp: s.xp,
  level: s.level,
  turns: s.turns.length,
  activeEvidence: s.evidence.filter((e: any) => e.status === 'active').length,
  fragments: s.mapFragments.length,
  privateTopics: [...s.privateTopics],
  territoryStatuses: s.territories.map((t: any) => `${t.id}=${t.status}`).join(' ')
});

const allCharted = (s: Record<string, any>) =>
  s.territories.every((t: any) => t.status === 'charted' || t.status === 'deeply-charted');

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
  expect(existsSync(DIST), 'run `npm run build` before the long-session gate').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  context = await browser.newContext({ viewport: PHONE, acceptDownloads: true });
  page = await context.newPage();

  // Deterministic local finalization only. No provider, so no /api/finalize.
  await page.route('**/api/health', (route: Route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, service: 'atlas-of-one', cartographer: 'disabled', model: null, transcribeModel: null, accessProtected: false })
    })
  );
  await page.route('**/api/finalize', (route: Route) => route.abort());
  await page.route('**/api/turn', (route: Route) => route.abort());

  await page.goto(host.url, { waitUntil: 'load' });
  await page.waitForSelector('.shell');
  await wakeAtlas(page);
  await completeOnboardingIfPresent(page);

  // SETUP ONLY: place the prepared campaign on disk before the visible session.
  const prepared = longCampaign();
  targetTurnId = prepared.targetTurnId;
  await page.evaluate(
    (raw) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('atlas-of-one');
        open.onsuccess = () => {
          const tx = open.result.transaction('campaigns', 'readwrite');
          tx.objectStore('campaigns').put({ key: 'active', state: JSON.parse(raw) });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
        open.onerror = () => reject(open.error);
      }),
    serializeCampaign(prepared.state)
  );
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.shell');
  await wakeAtlas(page);
  await page.waitForTimeout(700);
}, 180_000);

afterAll(async () => {
  await context?.close();
  await browser?.close();
  await host?.close();
});

describe('PND-004 — one continuous retraction → export → delete → import → finalization session', () => {
  it('stage 0. a substantial campaign hydrates, is end-state eligible, and holds the retraction target', async () => {
    const state = (await persisted())!;
    baseline = anchorsOf(state);

    expect(baseline.campaignId).toBe('campaign_phase5_long_session');
    expect(baseline.turns, 'a developed campaign, not a three-turn toy').toBeGreaterThanOrEqual(40);
    expect(baseline.activeEvidence).toBeGreaterThanOrEqual(40);
    expect(allCharted(state), 'every territory charted').toBe(true);
    expect(state.finalAssessment ?? null, 'no assessment yet').toBeNull();

    // The retraction target is present and active.
    const target = state.turns.find((t: any) => t.id === targetTurnId);
    expect(target, 'target answer exists').toBeTruthy();
    expect(target.retracted).toBe(false);
    expect(target.answer).toContain(RETRACTION_CANARY);
    const derived = state.evidence.filter((e: any) => e.sourceTurnIds.includes(targetTurnId));
    expect(derived.length, 'exactly one derived evidence record').toBe(1);
    expect(derived[0].status).toBe('active');

    // The Final Assessment action is offered because the gate is satisfied.
    await goto('Me');
    expect(await page.locator('[data-testid="synthesize-assessment-btn"]').count()).toBe(1);
    expect(await page.locator('[data-testid="assessment-locked"]').count()).toBe(0);
  }, 180_000);

  it('stage 1. the player takes an answer back through the real Vault control', async () => {
    await goto('Vault');
    const retract = page.locator(`[data-testid="retract-${targetTurnId}"]`);
    await retract.scrollIntoViewIfNeeded();
    expect(await retract.count(), 'a real player-reachable retraction control exists').toBe(1);
    await retract.click();
    await page.waitForTimeout(500);

    const state = (await persisted())!;
    afterRetraction = anchorsOf(state);

    // Exactly the intended answer, and history is preserved rather than erased.
    const target = state.turns.find((t: any) => t.id === targetTurnId);
    expect(target.retracted, 'target is retracted').toBe(true);
    expect(target.answer, 'history keeps the words').toContain(RETRACTION_CANARY);
    expect(afterRetraction.turns, 'no turn was deleted').toBe(baseline.turns);
    expect(state.turns.filter((t: any) => t.retracted).length, 'only one retraction').toBe(1);

    // Derived evidence is invalidated; unrelated evidence is untouched.
    const derived = state.evidence.find((e: any) => e.sourceTurnIds.includes(targetTurnId));
    expect(derived.status, 'derived evidence retired').toBe('retracted');
    expect(afterRetraction.activeEvidence, 'exactly one record left the active set').toBe(baseline.activeEvidence - 1);
    expect(state.evidence.filter((e: any) => e.status === 'active').some((e: any) => e.claim.includes(RETRACTION_CANARY))).toBe(false);

    // Retraction awards nothing and the redundant coverage holds the end state.
    expect(afterRetraction.xp, 'retraction awards no XP').toBe(baseline.xp);
    expect(afterRetraction.level).toBe(baseline.level);
    expect(afterRetraction.territoryStatuses, 'coverage recomputed and still charted').toBe(baseline.territoryStatuses);
    expect(allCharted(state), 'still end-state eligible thanks to redundant evidence').toBe(true);
    expect(afterRetraction.privateTopics).toEqual(baseline.privateTopics);
    expect(afterRetraction.fragments).toBe(baseline.fragments);

    // And it survives hydration.
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.shell');
  await wakeAtlas(page);
    await page.waitForTimeout(700);
    const reloaded = (await persisted())!;
    expect(reloaded.turns.find((t: any) => t.id === targetTurnId).retracted).toBe(true);
    expect(anchorsOf(reloaded)).toEqual(afterRetraction);
  }, 180_000);

  it('stage 2. the player exports the retracted Atlas through the real control', async () => {
    await goto('Me');
    const downloadPromise = page.waitForEvent('download');
    await page.click('button:text("Export Atlas")');
    const download: Download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^atlas-of-one-.*\.atlas\.json$/);

    const path = await download.path();
    expect(path, 'the browser really produced a file').toBeTruthy();
    exportedFile = readFileSync(path!);
    const exported = JSON.parse(exportedFile.toString('utf8'));

    expect(exported.schemaVersion).toBe(1);
    expect(anchorsOf(exported), 'the export is the post-retraction state').toEqual(afterRetraction);
    expect(exported.finalAssessment ?? null, 'still no assessment').toBeNull();

    // Retraction is carried as STATUS, not by erasing history.
    const target = exported.turns.find((t: any) => t.id === targetTurnId);
    expect(target.retracted).toBe(true);
    expect(target.answer).toContain(RETRACTION_CANARY);
    const derived = exported.evidence.find((e: any) => e.sourceTurnIds.includes(targetTurnId));
    expect(derived.status, 'not resurrected as active').toBe('retracted');
    expect(allCharted(exported)).toBe(true);
  }, 180_000);

  it('stage 3. the player deletes the local Atlas through the real confirmation flow', async () => {
    await goto('Me');
    await page.click('button:text("Delete local Atlas")');
    expect(await page.isVisible('button:text-is("Delete everything")'), 'delete takes a deliberate second tap').toBe(true);
    await page.click('button:text-is("Delete everything")');
    await page.waitForTimeout(600);

    const after = await persisted();
    // The persistence contract is that the row is removed; a fresh campaign is
    // held in memory until the next autosave writes it.
    if (after !== null) {
      expect(after.campaignId, 'the old campaign is gone').not.toBe(baseline.campaignId);
      expect(after.turns.length).toBe(0);
    }
    await goto('Map');
    expect(Number(await page.getAttribute('[data-testid="hud-progress"]', 'data-xp')), 'XP reset').toBe(0);

    // Observed, not assumed: the app stays usable and navigation is still
    // present, so the Me-screen import control remains reachable inside this
    // session. UNV-023 concerns a brand-new profile, which is a different case.
    expect(await page.isVisible('[data-testid="open-menu"]'), 'the menu holding import/export is still reachable after delete').toBe(true);
    expect(await page.locator('[data-testid="onboarding-step-2"]').count(), 'not sent back to first run').toBe(0);
  }, 180_000);

  it('stage 4. the player imports the exact exported file and the retraction is restored', async () => {
    await goto('Me');
    await page.setInputFiles('.file input', {
      name: 'atlas-of-one-restored.atlas.json',
      mimeType: 'application/json',
      buffer: exportedFile
    });
    await page.waitForSelector('.toast:text-matches("imported and validated")');
    await page.waitForTimeout(600);

    const restored = (await persisted())!;
    expect(anchorsOf(restored), 'every anchor restored exactly').toEqual(afterRetraction);
    expect(restored.finalAssessment ?? null).toBeNull();

    // The retraction is not resurrected.
    const target = restored.turns.find((t: any) => t.id === targetTurnId);
    expect(target.retracted, 'still retracted after the round trip').toBe(true);
    const derived = restored.evidence.find((e: any) => e.sourceTurnIds.includes(targetTurnId));
    expect(derived.status).toBe('retracted');
    expect(
      restored.evidence.filter((e: any) => e.status === 'active').some((e: any) => e.claim.includes(RETRACTION_CANARY)),
      'the canary is not eligible evidence again'
    ).toBe(false);

    // Settings, unlocks and achievements come back too.
    expect(restored.settings.sass).toBe('medium');
    expect(restored.unlocks.filter((u: any) => u.unlockedAt).length).toBeGreaterThan(0);
    expect(allCharted(restored), 'still end-state eligible').toBe(true);

    // And it survives hydration.
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.shell');
  await wakeAtlas(page);
    await page.waitForTimeout(700);
    expect(anchorsOf((await persisted())!)).toEqual(afterRetraction);
  }, 180_000);

  it('stage 5. the restored campaign finalizes locally, without the retracted material', async () => {
    await goto('Me');
    const before = (await persisted())!;

    const synthesize = page.locator('[data-testid="synthesize-assessment-btn"]');
    expect(await synthesize.count(), 'the restored campaign still satisfies the end-state gate').toBe(1);
    await synthesize.click();
    await expect.poll(() => page.isVisible('[data-testid="assessment-content"]'), { timeout: 30_000 }).toBe(true);
    await page.waitForTimeout(600);

    const after = (await persisted())!;
    expect(after.finalAssessment, 'assessment created').toBeTruthy();
    expect(after.finalAssessment.provider, 'deterministic local path, no Workers AI').toBe('local-synthesizer');

    // Finalization owns no progression.
    expect(anchorsOf(after), 'nothing about the campaign moved').toEqual(anchorsOf(before));

    // The retracted answer cannot reach the assessment, by any route.
    const serialized = JSON.stringify(after.finalAssessment);
    expect(serialized, 'retracted canary absent from the whole assessment').not.toContain(RETRACTION_CANARY);
    for (const quote of after.finalAssessment.representativeQuotes as string[]) {
      expect(quote).not.toContain(RETRACTION_CANARY);
      expect(CANARY_ANSWER).not.toContain(quote.replace(/^"|"$/g, ''));
    }

    // The synthesis is still grounded in what remains.
    expect(after.finalAssessment.whoIsGreyson).toContain('strictly by what this campaign recorded');

    // And it survives hydration.
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.shell');
  await wakeAtlas(page);
    await page.waitForTimeout(700);
    const reloaded = (await persisted())!;
    expect(reloaded.finalAssessment?.id, 'assessment persisted across reload').toBe(after.finalAssessment.id);
    expect(JSON.stringify(reloaded.finalAssessment)).not.toContain(RETRACTION_CANARY);
    await goto('Me');
    expect(await page.isVisible('[data-testid="assessment-content"]'), 'and renders after reload').toBe(true);
  }, 180_000);
});
