import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditSurface, persistedState, resetProfile, type SurfaceAudit } from './a11y-support';
import { completeOnboardingIfPresent } from './helper';
import { serveDist } from './server';

/**
 * Q10: mobile layout proof for the v2 Journal -> Adventure -> Combat -> Reflection
 * -> Vault -> Snapshots surfaces at four viewports. Screenshots go to the OS tmp
 * directory only (never committed).
 */
const DIST = join(process.cwd(), 'dist', 'client');
const SHOTS = join(tmpdir(), 'atlas-q10-shots');
const VIEWPORTS = [
  { width: 320, height: 640 },
  { width: 390, height: 844 },
  { width: 430, height: 932 },
  { width: 768, height: 1024 }
];

let browser: Browser;
let host: { url: string; close: () => Promise<void> };
const audits: SurfaceAudit[] = [];
const combatProbe: Array<{ tag: string; leavePresent: boolean; leaveCoveredBy: string | null; toast: { w: number; h: number; overlapsPanel: boolean } | null }> = [];

/** LEAVE must be reachable and not painted over; any toast over the dialog is measured. */
async function probeLeave(page: Page) {
  const leave = page.locator('[data-testid="adventure-combat"] .cp-verb[data-verb="leave"]');
  const leavePresent = (await leave.count()) === 1;
  if (leavePresent) await leave.scrollIntoViewIfNeeded();
  return page.evaluate(() => {
    const el = document.querySelector('[data-testid="adventure-combat"] .cp-verb[data-verb="leave"]');
    let leaveCoveredBy: string | null = null;
    if (el) {
      const r = el.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      if (top && top !== el && !el.contains(top)) leaveCoveredBy = `${top.tagName.toLowerCase()}.${top.className}`;
    }
    const toastButton = document.querySelector('.toast button');
    const panel = document.querySelector('[data-testid="adventure-panel"]');
    let toast = null;
    if (toastButton && panel) {
      const b = toastButton.getBoundingClientRect();
      const t = toastButton.parentElement!.getBoundingClientRect();
      const p = panel.getBoundingClientRect();
      toast = { w: Math.round(b.width), h: Math.round(b.height), overlapsPanel: t.top < p.bottom && t.bottom > p.top };
    }
    return { leavePresent: !!el, leaveCoveredBy, toast };
  });
}

beforeAll(async () => {
  expect(existsSync(DIST), 'run npm run build first').toBe(true);
  mkdirSync(SHOTS, { recursive: true });
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});

afterAll(async () => {
  writeFileSync(join(SHOTS, 'audits.json'), JSON.stringify({ audits, combatProbe }, null, 1));
  await browser?.close();
  await host?.close();
});

async function walk(page: Page, tag: string) {
  const record = async (surface: string, root: string) => {
    const audit = await auditSurface(page, `${tag} ${surface}`, root);
    audits.push(audit);
    await page.screenshot({ path: join(SHOTS, `${tag}-${surface}.png`) });
    return audit;
  };

  await page.click('[data-testid="open-journal"]');
  await page.click('[data-testid="journal-prompt-request"]');
  await page.waitForSelector('[data-testid="journal-prompt-text"]');
  await record('journal-composer', '[data-testid="journal-composer"]');
  await page.fill('[data-testid="journal-entry-input"]', 'Q10 synthetic layout entry.');
  await page.click('[data-testid="journal-save"]');
  await expect.poll(async () => (await persistedState(page))?.journalEntries?.length ?? 0).toBe(1);

  await page.click('[data-testid="open-journal"]');
  await page.click('[data-testid="journal-history-open"]');
  await page.click('[data-testid="journal-history-entry"] button');
  await page.click('[data-testid="journal-explore"]');
  await page.waitForSelector('[data-testid="journal-explore-place"]');
  await record('journal-history-explore', '[data-testid="journal-composer"]');
  await page.click('[data-testid="journal-explore-place"][data-territory="identity"]');

  await page.waitForSelector('[data-testid="adventure-just-for-fun"]');
  await record('adventure-list', '[data-testid="adventure-panel"]');
  await page.locator('[data-testid="adventure-start"]').first().click();
  await page.waitForSelector('[data-testid="adventure-beat"]');
  await record('adventure-beat', '[data-testid="adventure-panel"]');

  let sawCombat = false;
  for (let step = 0; step < 40; step += 1) {
    if (await page.locator('[data-testid="adventure-outcome"]').count()) break;
    if (await page.locator('[data-testid="adventure-combat"]').count()) {
      if (!sawCombat) {
        sawCombat = true;
        await record('combat', '[data-testid="adventure-panel"]');
        combatProbe.push({ tag, ...(await probeLeave(page)) });
      }
      await page.locator('[data-testid="adventure-combat"] .cp-verb:not([disabled])').first().click();
      const option = page.locator('[data-testid="adventure-combat"] .cp-option:not([disabled])').first();
      if (await option.count()) {
        if (step < 3) await record(`combat-options-${step}`, '[data-testid="adventure-panel"]');
        await option.click();
      }
    } else {
      await page.locator('[data-testid="adventure-option"]').first().click();
    }
    await page.waitForTimeout(30);
  }
  await page.waitForSelector('[data-testid="adventure-outcome"]');
  expect(sawCombat).toBe(true);
  await record('adventure-outcome', '[data-testid="adventure-panel"]');
  await page.click('[data-testid="adventure-close"]');

  await page.click('[data-testid="open-reflection"]');
  await record('reflection', '[data-testid="reflection-panel"], .reflection-overlay');
  await page.fill('[data-testid="reflection-response"]', 'Q10 synthetic statement in my own words.');
  await page.click('[data-testid="reflection-confirm"]');
  await expect.poll(async () => (await persistedState(page))?.evidence?.length ?? 0).toBeGreaterThan(0);

  await page.click('[data-testid="open-menu"]');
  await page.click('[data-testid="go-vault"]');
  await page.waitForSelector('[data-testid="vault-confirmed-item"]');
  await page.locator('[data-testid="vault-confirmed"]').scrollIntoViewIfNeeded();
  await record('vault-confirmed', '[data-testid="vault-confirmed"]');
  await page.click('[data-testid="close-sheet"]');

  await page.click('[data-testid="open-menu"]');
  await page.click('[data-testid="go-character"]');
  await page.waitForSelector('[data-testid="atlas-snapshots"]');
  await page.locator('[data-testid="atlas-snapshots"]').scrollIntoViewIfNeeded();
  await record('atlas-snapshots', '[data-testid="atlas-snapshots"]');
}

describe('Q10 mobile layout across v2 surfaces', () => {
  for (const viewport of VIEWPORTS) {
    const tag = `${viewport.width}x${viewport.height}`;
    it(`${tag}: no horizontal overflow, no clipped containers, targets >= 44px`, async () => {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      try {
        await resetProfile(page, host.url);
        await completeOnboardingIfPresent(page);
        await page.waitForSelector('[data-testid="world"]');
        await walk(page, tag);
      } finally {
        await context.close();
      }
      const mine = audits.filter((a) => a.surface.startsWith(tag));
      const probe = combatProbe.find((p) => p.tag === tag)!;
      expect(probe.leavePresent, 'LEAVE verb present in combat').toBe(true);
      for (const audit of mine) {
        expect.soft(audit.overflow, `${audit.surface} horizontal overflow`).toBeLessThanOrEqual(0);
        expect.soft(audit.clipped, `${audit.surface} clipped`).toEqual([]);
        expect.soft(audit.smallTargets, `${audit.surface} targets under 44x44`).toEqual([]);
      }
    });
  }

  // DEFECT Q10-D1: the app toast ("An optional adventure is waiting...") stays at
  // z-index 70 over the open Adventure dialog during combat; at 430x932 it paints
  // over the LEAVE verb (elementFromPoint hits div.toast). Remove .fails once fixed.
  it.fails('DEFECT Q10-D1: no toast overlaps the open Adventure dialog / LEAVE', () => {
    expect(combatProbe).toHaveLength(VIEWPORTS.length);
    for (const probe of combatProbe) {
      expect(probe.toast?.overlapsPanel ?? false, `${probe.tag} toast over dialog`).toBe(false);
      expect(probe.leaveCoveredBy, `${probe.tag} LEAVE covered`).toBeNull();
    }
  });

  // DEFECT Q10-D2: the toast dismiss button (.toast button, "Dismiss") measures 25x23.
  it.fails('DEFECT Q10-D2: toast dismiss target is at least 44x44', () => {
    expect(combatProbe).toHaveLength(VIEWPORTS.length);
    for (const probe of combatProbe) {
      expect(probe.toast, `${probe.tag} toast present`).not.toBeNull();
      expect(Math.min(probe.toast!.w, probe.toast!.h), `${probe.tag} dismiss size`).toBeGreaterThanOrEqual(44);
    }
  });
});
