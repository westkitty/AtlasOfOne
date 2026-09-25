import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Download, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { completeOnboardingIfPresent, navigateTo, wakeAtlas } from './helper';
import { serveDist } from './server';

const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };
const V1_FIXTURE = readFileSync(new URL('../fixtures/v1/canonical-current-v1.json', import.meta.url));

let browser: Browser;
let page: Page;
let host: { url: string; close: () => Promise<void> };
let exportedV2: Buffer;

async function persisted() {
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

async function goto(screen: string) {
  await navigateTo(page, screen);
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run npm run build first').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
  page = await browser.newPage({ viewport: PHONE, acceptDownloads: true });

  await page.goto(host.url, { waitUntil: 'load' });
  await page.evaluate(async () => {
    localStorage.clear();
    const dbs = await indexedDB.databases?.() ?? [];
    for (const db of dbs) if (db.name) indexedDB.deleteDatabase(db.name);
  });
  await page.reload({ waitUntil: 'load' });
  await completeOnboardingIfPresent(page);
  await wakeAtlas(page);
  await page.waitForSelector('[data-testid="world"]');
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('M07 real-browser v1 -> v2 persistence torture', () => {
  it('imports canonical schema-v1 through the public UI and persists the migrated v2 + historical Snapshot', async () => {
    await goto('Me');
    await page.setInputFiles('.file input', {
      name: 'canonical-current-v1.atlas.json',
      mimeType: 'application/json',
      buffer: V1_FIXTURE
    });
    await page.waitForSelector('.toast:text-matches("imported and validated")');

    await expect.poll(async () => (await persisted())?.schemaVersion).toBe(2);
    const state = await persisted();

    expect(state.campaignId).toBe('campaign_fixture_current_v1');
    expect(state.finalAssessment?.id).toBe('assessment_fixture_v1');
    expect(state.atlasSnapshots).toEqual([{
      id: 'snapshot_legacy_assessment_fixture_v1',
      createdAt: '2026-01-02T03:04:05.000Z',
      evidenceIds: [],
      insightIds: [],
      contradictionIds: [],
      synthesis: state.finalAssessment
    }]);
    expect(state.turns.map((turn: any) => turn.id)).toEqual(['turn_fixture_1']);
    expect(state.bossRuns.map((run: any) => run.id)).toEqual(['bossrun_fixture_1']);
    expect(state.doorRuns.map((run: any) => run.id)).toEqual(['doorrun_fixture_1']);
    expect(state.worldJourney.lastPosition).toEqual({ x: 12, y: 34, territoryId: 'identity' });
  });

  it('exports that migrated v2 through the real control, deletes local state, then restores the same durable state', async () => {
    await goto('Me');
    const before = await persisted();

    const downloadPromise = page.waitForEvent('download');
    await page.click('button:text("Export Atlas")');
    const download: Download = await downloadPromise;
    const path = await download.path();
    expect(path).toBeTruthy();
    exportedV2 = readFileSync(path!);

    const exported = JSON.parse(exportedV2.toString('utf8'));
    expect(exported.schemaVersion).toBe(2);
    expect(exported.campaignId).toBe(before.campaignId);
    expect(exported.atlasSnapshots).toEqual(before.atlasSnapshots);

    await page.click('button:text("Delete local Atlas")');
    await page.click('button:text-is("Delete everything")');
    await page.waitForTimeout(300);

    const afterDelete = await persisted();
    if (afterDelete !== null) {
      expect(afterDelete.campaignId).not.toBe(before.campaignId);
      expect(afterDelete.turns).toEqual([]);
    }

    await goto('Me');
    await page.setInputFiles('.file input', {
      name: 'migrated-v2.atlas.json',
      mimeType: 'application/json',
      buffer: exportedV2
    });
    await page.waitForSelector('.toast:text-matches("imported and validated")');

    await expect.poll(async () => (await persisted())?.campaignId).toBe(before.campaignId);
    const restored = await persisted();

    expect(restored.schemaVersion).toBe(2);
    expect(restored.campaignId).toBe(before.campaignId);
    expect(restored.turns).toEqual(before.turns);
    expect(restored.evidence).toEqual(before.evidence);
    expect(restored.bossRuns).toEqual(before.bossRuns);
    expect(restored.doorRuns).toEqual(before.doorRuns);
    expect(restored.worldJourney).toEqual(before.worldJourney);
    expect(restored.settings).toEqual(before.settings);
    expect(restored.finalAssessment).toEqual(before.finalAssessment);
    expect(restored.atlasSnapshots).toEqual(before.atlasSnapshots);

    await page.reload({ waitUntil: 'load' });
    await wakeAtlas(page);
    await page.waitForSelector('[data-testid="world"]');
    expect((await persisted()).atlasSnapshots).toEqual(before.atlasSnapshots);
  });
});
