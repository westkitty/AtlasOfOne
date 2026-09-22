import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page, type Route } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, wakeAtlas } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const oldEvidenceId = 'ev-rf06-old-synthetic';
const oldTurnId = 'turn-rf06-old-synthetic';
const revision = 'I changed my mind. Synthetic revision answer for the runtime canary.';
let browser: Browser;
let host: { url: string; close: () => Promise<void> };

const readCampaign = (page: Page) => page.evaluate(() => new Promise<any>((resolve) => {
  const request = indexedDB.open('atlas-of-one');
  request.onsuccess = () => { const get = request.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active'); get.onsuccess = () => resolve(get.result?.state); };
}));

async function seed(page: Page) {
  await page.evaluate(async ({ oldEvidenceId, oldTurnId }) => {
    const request = indexedDB.open('atlas-of-one');
    await new Promise<void>((resolve) => { request.onsuccess = () => resolve(); });
    const get = request.result.transaction('campaigns', 'readonly').objectStore('campaigns').get('active');
    const row = await new Promise<any>((resolve) => { get.onsuccess = () => resolve(get.result); });
    const state = row.state;
    state.onboardingCompleted = true;
    const identityHistory = [
      { turnId: oldTurnId, evidenceId: oldEvidenceId, dimension: 'self-description', at: '2026-09-21T10:00:00.000Z' },
      { turnId: 'turn-rf06-temperament-synthetic', evidenceId: 'ev-rf06-temperament-synthetic', dimension: 'temperament', at: '2026-09-21T10:01:00.000Z' },
      { turnId: 'turn-rf06-strengths-synthetic', evidenceId: 'ev-rf06-strengths-synthetic', dimension: 'strengths', at: '2026-09-21T10:02:00.000Z' },
      { turnId: 'turn-rf06-vulnerabilities-synthetic', evidenceId: 'ev-rf06-vulnerabilities-synthetic', dimension: 'vulnerabilities', at: '2026-09-21T10:03:00.000Z' }
    ];
    state.turns = identityHistory.map(({ turnId, dimension, at }) => ({
      id: turnId, createdAt: at, territoryId: 'identity', dimension, question: `Synthetic prior ${dimension} prompt.`, answer: `Synthetic prior ${dimension} answer.`, substantive: true, behavioralExample: false, revision: false, retracted: false
    }));
    state.evidence = identityHistory.map(({ turnId, evidenceId, dimension }) => ({
      id: evidenceId, dimension, claim: `Synthetic old active ${dimension} evidence.`, sourceTurnIds: [turnId], basis: 'explicit', strength: 2, territories: ['identity'], counterEvidenceIds: [], status: 'active', origin: 'model-proposed', providerId: 'mock'
    }));
    state.contradictions = [];
    state.territories = state.territories.map((territory: any) => territory.id === 'identity' ? {
      ...territory, status: 'deeply-charted', coveredDimensions: ['self-description', 'temperament', 'strengths', 'vulnerabilities'], evidenceIds: identityHistory.map(({ evidenceId }) => evidenceId)
    } : territory);
    const tx = request.result.transaction('campaigns', 'readwrite');
    tx.objectStore('campaigns').put({ key: 'active', state });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }, { oldEvidenceId, oldTurnId });
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run a production build before RF06 browser proof').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
}, 120_000);
afterAll(async () => { await browser?.close(); await host?.close(); });

describe('RF06 real-play reachability in the production bundle', () => {
  it('creates and persists a supported contradiction only through player revision provenance', async () => {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.route('**/api/health', (route: Route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, cartographer: 'disabled', model: null }) }));
    await page.goto(host.url, { waitUntil: 'load' });
    await page.waitForSelector('.shell');
    await completeOnboardingIfPresent(page);
    await seed(page);
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="world"]');
    await page.click('[data-testid="enter-encounter"]');
    await page.click('[data-testid="request-prompt"]');
    await expect.poll(() => page.textContent('[data-testid="prompt-dimension"]')).toContain('self-description');
    const before = await readCampaign(page);
    await page.fill('[data-testid="answer-input"]', revision);
    await page.click('[data-testid="submit-answer"]');
    await expect.poll(async () => (await readCampaign(page)).turns.length).toBe(before.turns.length + 1);
    const after = await readCampaign(page);
    const priorTurnIds = new Set(before.turns.map((turn: any) => turn.id));
    const newTurn = after.turns.find((turn: any) => !priorTurnIds.has(turn.id));
    const newEvidence = after.evidence.find((item: any) => item.sourceTurnIds.includes(newTurn.id));
    expect(newTurn).toMatchObject({ revision: true, dimension: 'self-description' });
    expect(newEvidence).toMatchObject({ basis: 'revision', dimension: 'self-description' });
    expect(newEvidence.counterEvidenceIds).toEqual([oldEvidenceId]);
    expect(after.evidence.find((item: any) => item.id === oldEvidenceId)).toMatchObject({ claim: 'Synthetic old active self-description evidence.', status: 'active', sourceTurnIds: [oldTurnId], counterEvidenceIds: [newEvidence.id] });
    expect(after.contradictions).toHaveLength(1);
    expect(after.contradictions[0]).toMatchObject({ claim: 'Supported evidence is explicitly linked as counter-evidence.', status: 'open' });
    expect([...after.contradictions[0].evidenceIds].sort()).toEqual([oldEvidenceId, newEvidence.id].sort());
    // Ordinary answer/evidence progression still occurs; RF06 adds no separate progression authority.
    // The unit gate compares every non-evidence/non-contradiction field against the already-applied state.
    expect(after.xp).toBeGreaterThan(before.xp);
    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    const persisted = await readCampaign(page);
    expect(persisted.evidence.find((item: any) => item.id === oldEvidenceId).counterEvidenceIds).toEqual([newEvidence.id]);
    expect(persisted.contradictions).toHaveLength(1);
    await page.context().close();
  }, 120_000);
});
