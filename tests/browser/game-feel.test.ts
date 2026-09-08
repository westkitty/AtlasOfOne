import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { serveDist } from './server';
import { completeOnboardingIfPresent, openAgency } from './helper';
import type { CampaignState } from '../../src/game/types';

/**
 * The first ten minutes, played through the real production bundle.
 *
 * A ten-turn diagnostic against the previous build found that the engine was
 * granting substantial progression while the player could barely perceive any
 * of it: five of the six milestones one answer produced were silently deleted,
 * unlocked abilities existed only as an integer on the character screen, and
 * from turn five onwards the campaign re-asked the same exhausted Identity
 * question forever.
 *
 * Automation cannot assert that a game is fun. What it can do — and what this
 * suite does — is prove that the world visibly reacts, so a human reviewer is
 * judging a game rather than a spreadsheet.
 *
 * Everything here runs on the deterministic local Cartographer with synthetic
 * answers. No provider is called and no real campaign content is used.
 */

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), '../../dist/client');
const VIEWPORT = { width: 390, height: 844 };

/** Varied substantive answers: long, short, behavioural example, revision. */
const ANSWERS = [
  'I would lead with being someone who notices things other people walk past, and cares more about getting it right than getting it fast.',
  'Mostly a low steady hum with occasional sharp spikes. For example, when I have a whole quiet afternoon I get restless rather than relaxed.',
  'I stay calm when something is actually going wrong. When I worked a bad outage everyone escalated and I started listing what we knew.',
  'Being rushed by someone who will not explain why. That knocks me sideways faster than any actual crisis does.',
  'I used to think consistency was the highest virtue, but I have changed my mind: honesty about changing is worth more.',
  'Usually whichever value protects the person with the least power in the situation. That is the tiebreak I keep landing on.',
  'Loyalty stops being owed when someone asks me to lie for them. One time a friend asked exactly that and it ended things.',
  'Fairness is closer to equal power than equal treatment. Equal treatment of unequal people entrenches whatever was already there.',
  'The line is consent plus reversibility. Helping is when they can tell you to stop and you actually stop.',
  'I chase questions about why systems everyone agrees are broken keep reproducing themselves anyway.'
];

let browser: Browser;
let page: Page;
let host: { url: string; close: () => Promise<void> };

/** Read committed campaign state. Never writes — the game must play itself. */
const readState = (target: Page): Promise<CampaignState> => target.evaluate(() => new Promise((resolve) => {
  const request = indexedDB.open('atlas-of-one');
  request.onerror = () => resolve(null);
  request.onsuccess = () => {
    const tx = request.result.transaction('campaigns', 'readonly');
    const get = tx.objectStore('campaigns').get('active');
    get.onsuccess = () => resolve(get.result ? get.result.state : null);
    get.onerror = () => resolve(null);
  };
})) as Promise<CampaignState>;

const goto = async (label: 'Map' | 'Talk' | 'Vault' | 'Me') => {
  await page.click(`nav[aria-label="Main"] button:has(small:text-is("${label}"))`);
  await page.waitForTimeout(120);
};

/** Everything the milestone card showed, then dismiss it. */
async function captureAndDismissMilestone(): Promise<string[]> {
  if (!(await page.locator('[data-testid="milestone"]').isVisible().catch(() => false))) return [];
  const shown = [await page.locator('[data-testid="milestone-title"]').innerText()];
  const also = page.locator('[data-testid="milestone-also"] li strong');
  for (let index = 0; index < (await also.count()); index += 1) shown.push(await also.nth(index).innerText());
  await page.click('[data-testid="milestone-continue"]');
  await page.locator('[data-testid="milestone"]').waitFor({ state: 'detached', timeout: 15_000 });
  return shown;
}

/** Answer whatever is currently being asked, and wait for it to commit. */
async function answer(text: string, expectedTurns: number) {
  await page.fill('[data-testid="answer-input"]', text);
  await page.click('button:text("Map this answer")');
  await page.waitForFunction((count) => new Promise((resolve) => {
    const request = indexedDB.open('atlas-of-one');
    request.onerror = () => resolve(false);
    request.onsuccess = () => {
      const tx = request.result.transaction('campaigns', 'readonly');
      const get = tx.objectStore('campaigns').get('active');
      get.onsuccess = () => resolve(Boolean(get.result) && get.result.state.turns.length >= count);
      get.onerror = () => resolve(false);
    };
  }), expectedTurns, { timeout: 20_000 });
}

interface TurnLog {
  turn: number;
  question: string;
  xp: number;
  level: number;
  activeTerritory: string;
  milestonesShown: string[];
  sawPulse: boolean;
}

const log: TurnLog[] = [];

beforeAll(async () => {
  host = await serveDist(DIST);
  browser = await chromium.launch({ channel: 'chrome' });
  page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(host.url);
  await completeOnboardingIfPresent(page);
}, 120_000);

afterAll(async () => {
  await browser?.close();
  await host?.close();
});

describe('the first ten turns visibly change the Atlas', () => {
  it('plays ten varied answers, recording what the player could see', async () => {
    const before = await readState(page);
    expect(before.turns).toHaveLength(0);
    expect(before.xp).toBe(0);

    for (let index = 0; index < ANSWERS.length; index += 1) {
      const turn = index + 1;
      await goto('Talk');
      await page.waitForSelector('[data-testid="answer-input"]');
      const question = await page.locator('[data-testid="prompt-question"]').innerText();

      await answer(ANSWERS[index], turn);

      // The immediate world reaction is transient by design, so it is sampled
      // right after the answer commits rather than after navigating away.
      const sawPulse = await page.locator('[data-testid="answer-pulse"]').isVisible().catch(() => false);
      const milestonesShown = await captureAndDismissMilestone();
      const state = await readState(page);

      log.push({ turn, question, xp: state.xp, level: state.level, activeTerritory: state.activeTerritory, milestonesShown, sawPulse });
    }

    expect(log).toHaveLength(10);
  }, 180_000);

  it('1. the first answer moves XP and visibly marks the world', async () => {
    const first = log[0];
    expect(first.xp, 'XP after the first answer').toBeGreaterThan(0);
    // First Mark on the Map is granted by the engine on the first substantive
    // answer, and the player is told about it.
    expect(first.milestonesShown.join(' | ')).toContain('First Mark');
    expect(first.sawPulse, 'coordinate reaction visible on turn 1').toBe(true);
  });

  it('2. quest progress and quest completion are both surfaced', async () => {
    const state = await readState(page);
    expect(state.quests.filter((quest) => quest.status === 'complete').length).toBeGreaterThan(0);

    const announced = log.flatMap((entry) => entry.milestonesShown).join(' | ');
    expect(announced, 'a completed quest was announced').toContain('Quest complete');
  });

  it('3. the first map fragment is announced and persists in the Vault', async () => {
    const announced = log.flatMap((entry) => entry.milestonesShown).join(' | ');
    expect(announced, 'fragment acquisition was announced').toContain('Fragment recovered');

    const state = await readState(page);
    expect(state.mapFragments.length).toBeGreaterThan(0);

    // The acquisition has somewhere permanent to live.
    await goto('Vault');
    const vault = await page.locator('.screen').innerText();
    expect(vault).toContain('CHARTED');
    expect(vault).not.toMatch(/Fragments\s*0 \/ 8/);
  });

  it('4. levelling up is an announced event, not a silent number', async () => {
    const state = await readState(page);
    expect(state.level).toBeGreaterThan(1);
    const announced = log.flatMap((entry) => entry.milestonesShown).join(' | ');
    expect(announced).toContain('Level 2');
  });

  it('5. nothing the engine granted was silently discarded', async () => {
    // Turn 2 grants six things at once. Every one of them must have been shown.
    const bigTurn = log.find((entry) => entry.milestonesShown.length >= 5);
    expect(bigTurn, 'a multi-grant turn occurred').toBeTruthy();
    const shown = bigTurn!.milestonesShown.join(' | ');
    expect(shown).toContain('Level 2');
    expect(shown).toContain('Go Deeper unlocked');
    expect(shown).toContain('Cartographer');
    expect(shown).toContain('Fragment recovered');
  });

  it('6. play leaves Identity once exhausted and never loops the same question', async () => {
    const questions = log.map((entry) => entry.question);
    // The old defect: turns 5-10 were six copies of the self-description prompt.
    expect(new Set(questions).size, 'every question was different').toBe(questions.length);

    const territories = new Set(log.map((entry) => entry.activeTerritory));
    expect(territories.size, 'the expedition travelled').toBeGreaterThan(1);
    expect(log[9].activeTerritory).not.toBe('identity');
  });

  it('7. more than one territory was visibly affected, and the map shows it', async () => {
    const state = await readState(page);
    const touched = state.territories.filter((territory) => territory.coveredDimensions.length > 0);
    expect(touched.length, 'territories carrying evidence').toBeGreaterThan(1);

    await goto('Map');
    await page.waitForSelector('[data-testid="atlas-map"]');
    // The map's own DOM carries the state, not just the campaign object.
    for (const territory of touched) {
      const status = await page.getAttribute(`[data-testid="atlas-node-${territory.id}"]`, 'data-status');
      expect(status, `${territory.id} node status`).not.toBe('fogged');
    }
    // And fog genuinely remains over what has not been visited.
    const fogged = state.territories.filter((territory) => territory.status === 'fogged');
    expect(fogged.length, 'unexplored country is still fogged').toBeGreaterThan(0);
  });

  it('8. Greyson stands in the territory the expedition currently occupies', async () => {
    const state = await readState(page);
    await goto('Map');
    const where = await page.getAttribute('[data-testid="atlas-greyson"]', 'data-territory');
    expect(where).toBe(state.activeTerritory);
    expect(where).not.toBe('identity');
  });

  it('9. the primary action row is game-facing, with agency one tap away', async () => {
    await goto('Talk');
    await page.waitForSelector('[data-testid="action-bar"]');

    const bar = page.locator('[data-testid="action-bar"] button');
    const labels: string[] = [];
    for (let index = 0; index < (await bar.count()); index += 1) labels.push((await bar.nth(index).innerText()).trim());

    // The six-control wall is gone from the primary surface.
    const permanent = ['PRIVATE', 'STOP', 'SERIOUS', 'HELP', 'SASS'];
    expect(labels.filter((label) => permanent.includes(label)), 'permanent controls on primary row').toHaveLength(0);
    expect(labels).toContain('PASS');
    expect(labels.some((label) => label.includes('MORE'))).toBe(true);

    // At most two earned game moves share the row with PASS and MORE.
    const moves = await page.locator('[data-testid="action-bar"] .action-move').count();
    expect(moves).toBeGreaterThan(0);
    expect(moves).toBeLessThanOrEqual(2);

    // Everything permanent is still reachable, enabled, and never gated.
    await openAgency(page);
    for (const control of ['stop', 'private', 'serious', 'help', 'sass']) {
      const button = page.locator(`[data-testid="agency-${control}"]`);
      expect(await button.isVisible(), control).toBe(true);
      expect(await button.isDisabled(), control).toBe(false);
    }
    await page.click('[data-testid="more-close"]');
  });

  it('10. after ten turns the player can do something they could not at turn zero', async () => {
    const state = await readState(page);
    const unlocked = state.unlocks.filter((unlock) => unlock.unlockedAt).map((unlock) => unlock.id);
    expect(unlocked).toContain('go-deeper');
    expect(unlocked).toContain('reroll');

    // Named and usable where play actually happens, not an integer on a stats page.
    await goto('Talk');
    expect(await page.locator('[data-testid="move-go-deeper"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="move-reroll"]').isVisible()).toBe(true);
  });

  it('reports the longest stretch without a visible reward', () => {
    let longest = 0;
    let run = 0;
    for (const entry of log) {
      if (entry.milestonesShown.length === 0) { run += 1; longest = Math.max(longest, run); } else run = 0;
    }
    // Before this pass the run was six identical questions with nothing at all.
    expect(longest, `longest silent stretch was ${longest} turns`).toBeLessThanOrEqual(3);
  });
});

describe('unlocked moves are real gameplay', () => {
  it('GO DEEPER changes the question, costs nothing, and records what was asked', async () => {
    await goto('Talk');
    const before = await readState(page);
    const original = await page.locator('[data-testid="prompt-question"]').innerText();

    await page.click('[data-testid="move-go-deeper"]');
    const deeper = await page.locator('[data-testid="prompt-question"]').innerText();
    expect(deeper).not.toBe(original);

    // Invoking a move is not an accomplishment.
    const afterInvoke = await readState(page);
    expect(afterInvoke.xp).toBe(before.xp);
    expect(afterInvoke.turns).toHaveLength(before.turns.length);

    await answer('The part I leave out is that it is mostly stubbornness dressed up as principle.', before.turns.length + 1);
    await captureAndDismissMilestone();

    const afterAnswer = await readState(page);
    expect(afterAnswer.turns).toHaveLength(before.turns.length + 1);
    expect(afterAnswer.xp).toBeGreaterThan(before.xp);
    // The question the player actually saw is the question that got recorded.
    expect(afterAnswer.turns[afterAnswer.turns.length - 1].question).toBe(deeper);
  }, 60_000);

  it('REROLL reframes the question without creating a turn or evidence', async () => {
    await goto('Talk');
    const before = await readState(page);
    const original = await page.locator('[data-testid="prompt-question"]').innerText();

    await page.click('[data-testid="move-reroll"]');
    const reframed = await page.locator('[data-testid="prompt-question"]').innerText();
    expect(reframed).not.toBe(original);

    const afterInvoke = await readState(page);
    expect(afterInvoke.xp).toBe(before.xp);
    expect(afterInvoke.turns).toHaveLength(before.turns.length);
    expect(afterInvoke.evidence).toHaveLength(before.evidence.length);

    // A second reroll gives a genuinely different framing, not the same string.
    await page.click('[data-testid="move-reroll"]');
    expect(await page.locator('[data-testid="prompt-question"]').innerText()).not.toBe(reframed);

    const shown = await page.locator('[data-testid="prompt-question"]').innerText();
    await answer('On a bad day it looks like refusing to move until someone explains themselves.', before.turns.length + 1);
    await captureAndDismissMilestone();

    const afterAnswer = await readState(page);
    expect(afterAnswer.turns).toHaveLength(before.turns.length + 1);
    expect(afterAnswer.turns[afterAnswer.turns.length - 1].question).toBe(shown);
  }, 60_000);
});

describe('quiet mode keeps the progress and drops the celebration', () => {
  it('advances state and the map while suppressing the milestone card', async () => {
    await goto('Talk');
    await openAgency(page);
    await page.click('[data-testid="agency-serious"]');

    const before = await readState(page);
    expect(before.presentation).toBe('quiet');

    // Drive enough turns that something would certainly have been celebrated.
    for (let index = 0; index < 4; index += 1) {
      await goto('Talk');
      await page.waitForSelector('[data-testid="answer-input"]');
      await answer(`A plain synthetic answer for the quiet-mode check, number ${index}.`, before.turns.length + index + 1);
      expect(await page.locator('[data-testid="milestone"]').isVisible().catch(() => false), 'no celebration while quiet').toBe(false);
    }

    const after = await readState(page);
    // Progression is untouched by presentation mode.
    expect(after.xp).toBeGreaterThan(before.xp);
    expect(after.turns.length).toBe(before.turns.length + 4);
    // The record of what was earned still exists; it is simply not paraded.
    expect(after.presentationQueue.length).toBeGreaterThan(0);

    // And factual progress stays legible on screen.
    await goto('Map');
    expect(await page.locator('[data-testid="atlas-map"]').isVisible()).toBe(true);
    expect(await page.locator('.xp').innerText()).toContain(`${after.xp}`);
  }, 120_000);
});

describe('the map is a place at every supported width', () => {
  it('never overflows horizontally and keeps the map a map', async () => {
    await goto('Map');
    for (const size of [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 320, height: 640 }]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(150);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `no horizontal overflow at ${size.width}px`).toBeLessThanOrEqual(0);

      // It stays a single cartographic composition, not a card list.
      const map = await page.locator('[data-testid="atlas-map"]').boundingBox();
      expect(map!.width, `map width at ${size.width}px`).toBeGreaterThan(size.width * 0.7);
      expect(map!.height, `map height at ${size.width}px`).toBeGreaterThan(220);
      expect(await page.locator('[data-testid="atlas-greyson"]').isVisible()).toBe(true);
    }
    await page.setViewportSize(VIEWPORT);
  }, 60_000);
});
