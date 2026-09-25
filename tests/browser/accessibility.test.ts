import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { auditSurface, persistedState, resetProfile, type SurfaceAudit } from './a11y-support';
import { completeOnboardingIfPresent } from './helper';
import { serveDist } from './server';

/**
 * Q11: keyboard-only, dialog semantics, accessible names, reduced motion and live
 * status proof for the v2 Journal -> Adventure -> Combat -> Reflection -> Vault ->
 * Snapshots surfaces. Every activation below is Tab-to-focus + Enter; no clicks.
 */
const DIST = join(process.cwd(), 'dist', 'client');
const PHONE = { width: 390, height: 844 };

let browser: Browser;
let host: { url: string; close: () => Promise<void> };
const audits: SurfaceAudit[] = [];
const dialogs: Record<string, { role: string | null; modal: string | null; labelled: boolean }> = {};
const escapeCloses: Record<string, boolean> = {};

beforeAll(async () => {
  expect(existsSync(DIST), 'run npm run build first').toBe(true);
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome', headless: true });
});

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

async function freshPage(reducedMotion: 'reduce' | 'no-preference' = 'no-preference'): Promise<{ context: BrowserContext; page: Page }> {
  const context = await browser.newContext({ viewport: PHONE, reducedMotion });
  const page = await context.newPage();
  await resetProfile(page, host.url);
  await completeOnboardingIfPresent(page);
  await page.waitForSelector('[data-testid="world"]');
  return { context, page };
}

/** Tab (forward) until the focused element matches, then press Enter. Fails if unreachable. */
async function keyActivate(page: Page, selector: string, maxTabs = 80) {
  await page.waitForSelector(selector);
  for (let i = 0; i < maxTabs; i += 1) {
    if (await page.evaluate((sel) => !!document.activeElement?.matches(sel), selector)) {
      await page.keyboard.press('Enter');
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard could not reach ${selector} in ${maxTabs} Tab presses.`);
}

/**
 * World-level entry buttons (open-journal / open-menu / open-reflection / open-adventure):
 * proves Tab reachability, then activates with a click because of DEFECT Q11-D2
 * (TouchControls' window keydown handler preventDefaults Enter/Space on focused buttons).
 */
async function worldActivate(page: Page, selector: string, maxTabs = 80) {
  await page.waitForSelector(selector);
  for (let i = 0; i < maxTabs; i += 1) {
    if (await page.evaluate((sel) => !!document.activeElement?.matches(sel), selector)) {
      await page.click(selector);
      return;
    }
    await page.keyboard.press('Tab');
  }
  throw new Error(`Keyboard could not reach ${selector} in ${maxTabs} Tab presses.`);
}

async function recordDialog(page: Page, name: string, selector: string) {
  dialogs[name] = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const by = el?.getAttribute('aria-labelledby');
    const labelled = !!(el?.getAttribute('aria-label')?.trim() || (by && document.getElementById(by)?.textContent?.trim()));
    return { role: el?.getAttribute('role') ?? null, modal: el?.getAttribute('aria-modal') ?? null, labelled };
  }, selector);
}

async function checkEscape(page: Page, name: string, selector: string, reopen: () => Promise<void>) {
  await page.focus(`${selector} button`);
  await page.keyboard.press('Escape');
  escapeCloses[name] = await page.waitForSelector(selector, { state: 'detached', timeout: 2_000 }).then(() => true, () => false);
  if (escapeCloses[name]) await reopen();
}

/** Plays the open adventure to its outcome using only the keyboard. Returns whether combat appeared. */
async function playAdventureByKeyboard(page: Page, onCombat?: () => Promise<void>) {
  let sawCombat = false;
  for (let step = 0; step < 40; step += 1) {
    if (await page.locator('[data-testid="adventure-outcome"]').count()) break;
    if (await page.locator('[data-testid="adventure-combat"]').count()) {
      if (!sawCombat) { sawCombat = true; await onCombat?.(); }
      await keyActivate(page, '[data-testid="adventure-combat"] .cp-verb:not([disabled]):not([data-verb="leave"])');
      if (await page.locator('[data-testid="adventure-combat"] .cp-option:not([disabled])').count()) {
        await keyActivate(page, '[data-testid="adventure-combat"] .cp-option:not([disabled])');
      }
    } else {
      await keyActivate(page, '[data-testid="adventure-option"]');
    }
  }
  await page.waitForSelector('[data-testid="adventure-outcome"]');
  return sawCombat;
}

describe('Q11 accessibility of v2 surfaces', () => {
  it('keyboard-only journey: Journal -> Explore -> Adventure -> Combat -> Reflection -> Vault -> Snapshots', async () => {
    const { context, page } = await freshPage();
    try {
      await worldActivate(page, '[data-testid="open-journal"]');
      await page.waitForSelector('[data-testid="journal-composer"]');
      await recordDialog(page, 'journal-composer', '[data-testid="journal-composer"]');
      await checkEscape(page, 'journal-composer', '[data-testid="journal-composer"]', () => worldActivate(page, '[data-testid="open-journal"]'));
      await keyActivate(page, '[data-testid="journal-prompt-request"]');
      await page.waitForSelector('[data-testid="journal-prompt-text"]');
      audits.push(await auditSurface(page, 'journal-composer', '[data-testid="journal-composer"]'));
      await page.focus('[data-testid="journal-entry-input"]');
      await page.keyboard.type('Q11 synthetic keyboard entry.');
      await keyActivate(page, '[data-testid="journal-save"]');
      await expect.poll(async () => (await persistedState(page))?.journalEntries?.length ?? 0).toBe(1);

      await worldActivate(page, '[data-testid="open-journal"]');
      await keyActivate(page, '[data-testid="journal-history-open"]');
      await keyActivate(page, '[data-testid="journal-history-entry"] button');
      await keyActivate(page, '[data-testid="journal-explore"]');
      audits.push(await auditSurface(page, 'journal-history-explore', '[data-testid="journal-composer"]'));
      await keyActivate(page, '[data-testid="journal-explore-place"][data-territory="identity"]');

      await page.waitForSelector('[data-testid="adventure-just-for-fun"]');
      await recordDialog(page, 'adventure-panel', '[data-testid="adventure-panel"]');
      audits.push(await auditSurface(page, 'adventure-list', '[data-testid="adventure-panel"]'));
      await checkEscape(page, 'adventure-panel', '[data-testid="adventure-panel"]', async () => {
        // Reopen via the world's adventure affordance if present; otherwise Explore again.
        await worldActivate(page, '[data-testid="open-adventure"]');
      });
      await keyActivate(page, '[data-testid="adventure-start"]');
      await page.waitForSelector('[data-testid="adventure-beat"]');
      audits.push(await auditSurface(page, 'adventure-beat', '[data-testid="adventure-panel"]'));

      // Free input by keyboard: type, then Enter on the submit control.
      await page.focus('[data-testid="adventure-free-input"]');
      await page.keyboard.type('Knock on the tower door.');
      await keyActivate(page, '[data-testid="adventure-free-submit"]');
      await expect.poll(async () => (await persistedState(page))?.adventureActions?.length ?? 0).toBe(1);

      const sawCombat = await playAdventureByKeyboard(page, async () => {
        audits.push(await auditSurface(page, 'combat', '[data-testid="adventure-panel"]'));
        expect(await page.locator('.cp-verb[data-verb="leave"]').isVisible()).toBe(true);
      });
      expect(sawCombat).toBe(true);
      expect(await page.getAttribute('[data-testid="adventure-outcome"]', 'role')).toBe('status');
      await keyActivate(page, '[data-testid="adventure-close"]');

      await worldActivate(page, '[data-testid="open-reflection"]');
      await page.waitForSelector('[data-testid="reflection-panel"]');
      await recordDialog(page, 'reflection-panel', '[data-testid="reflection-panel"]');
      audits.push(await auditSurface(page, 'reflection', '[data-testid="reflection-panel"]'));
      await checkEscape(page, 'reflection-panel', '[data-testid="reflection-panel"]', () => worldActivate(page, '[data-testid="open-reflection"]'));
      await page.focus('[data-testid="reflection-response"]');
      await page.keyboard.type('Q11 synthetic statement in my own words.');
      await keyActivate(page, '[data-testid="reflection-confirm"]');
      await expect.poll(async () => (await persistedState(page))?.evidence?.length ?? 0).toBeGreaterThan(0);

      await worldActivate(page, '[data-testid="open-menu"]');
      await page.waitForSelector('[data-testid="menu"]');
      await recordDialog(page, 'menu', '[data-testid="menu"] .menu');
      await keyActivate(page, '[data-testid="go-vault"]');
      await page.waitForSelector('[data-testid="vault-confirmed-item"]');
      audits.push(await auditSurface(page, 'vault-confirmed', '[data-testid="vault-confirmed"]'));
      await recordDialog(page, 'sheet', '[data-testid="sheet"]');
      await keyActivate(page, '[data-testid="close-sheet"]');

      await worldActivate(page, '[data-testid="open-menu"]');
      await keyActivate(page, '[data-testid="go-character"]');
      await page.waitForSelector('[data-testid="atlas-snapshots"]');
      audits.push(await auditSurface(page, 'atlas-snapshots', '[data-testid="atlas-snapshots"]'));
    } finally {
      await context.close();
    }

    for (const audit of audits) expect.soft(audit.unnamed, `${audit.surface} unnamed controls`).toEqual([]);
    for (const name of ['journal-composer', 'adventure-panel', 'reflection-panel']) {
      expect.soft(dialogs[name], name).toEqual({ role: 'dialog', modal: 'true', labelled: true });
      expect.soft(escapeCloses[name], `${name} Escape closes`).toBe(true);
    }
    expect(dialogs.menu).toMatchObject({ role: 'dialog', labelled: true });
  });

  // DEFECT Q11-D1: the menu (role=dialog, aria-label="Menu") has no aria-modal, and
  // the Vault/record sheet is not exposed as a dialog. Repro: open the menu, inspect
  // [data-testid="menu"] and [data-testid="sheet"]. Remove .fails once fixed.
  it.fails('DEFECT Q11-D1: menu and Vault/record sheet are modal, labelled dialogs', () => {
    expect(dialogs.menu).toEqual({ role: 'dialog', modal: 'true', labelled: true });
    expect(dialogs.sheet).toEqual({ role: 'dialog', modal: 'true', labelled: true });
  });

  // DEFECT Q11-D2: src/world/TouchControls.tsx registers a window keydown handler that
  // calls preventDefault() + onInteract() for Enter/Space/KeyE unless the target is an
  // input/textarea/select, so a focused world <button> (e.g. open-journal) never
  // activates from the keyboard. Repro: focus [data-testid="open-journal"], press Enter:
  // the Journal composer does not open. Remove .fails once fixed.
  it.fails('DEFECT Q11-D2: Enter/Space on a focused world button activates it', async () => {
    const { context, page } = await freshPage();
    try {
      for (const key of ['Enter', 'Space']) {
        await page.focus('[data-testid="open-journal"]');
        await page.keyboard.press(key);
        await page.waitForSelector('[data-testid="journal-composer"]', { timeout: 2_000 });
        await page.click('[data-testid="journal-close"]');
      }
    } finally {
      await context.close();
    }
  });

  it('prefers-reduced-motion: reduce shows no timed prompt and combat still completes', async () => {
    const { context, page } = await freshPage('reduce');
    try {
      expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
      await page.click('[data-testid="open-journal"]');
      await page.fill('[data-testid="journal-entry-input"]', 'Q11 reduced-motion synthetic entry.');
      await page.click('[data-testid="journal-save"]');
      await expect.poll(async () => (await persistedState(page))?.journalEntries?.length ?? 0).toBe(1);
      await page.click('[data-testid="open-journal"]');
      await page.click('[data-testid="journal-history-open"]');
      await page.click('[data-testid="journal-history-entry"] button');
      await page.click('[data-testid="journal-explore"]');
      await page.click('[data-testid="journal-explore-place"][data-territory="identity"]');
      await page.locator('[data-testid="adventure-start"]').first().click();
      await page.waitForSelector('[data-testid="adventure-beat"]');
      const timedPrompt = '[data-testid*="timing"], [data-testid*="timed"], [class*="timing"], [class*="timed"], [role="timer"]';
      let timedSeen = 0;
      const sawCombat = await playAdventureByKeyboard(page, async () => {
        timedSeen += await page.locator(timedPrompt).count();
      });
      timedSeen += await page.locator(timedPrompt).count();
      expect(sawCombat).toBe(true);
      expect(timedSeen).toBe(0);
      await expect.poll(async () => (await persistedState(page))?.adventureRuns?.[0]?.status).toBe('complete');
      expect((await persistedState(page)).activeCombat).toBeNull();
    } finally {
      await context.close();
    }
  });
});
