import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type Page } from 'playwright-core';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { serveDist } from './server';
import { completeOnboardingIfPresent, navigateTo, openAgency } from './helper';
import type { CampaignState } from '../../src/game/types';

/**
 * The first ten minutes, played through the real production bundle.
 *
 * Human review of the previous candidate said the UI was "a lot" and that there
 * was "no map really" — a node graph with a dashboard around it. This suite
 * exists to keep the replacement honest: the root is a world, the island is
 * progressively uncovered, Greyson walks through it, and the conversation
 * happens over the top of it rather than on a page of its own.
 *
 * Automation cannot prove any of this is beautiful or fun, and nothing here
 * claims to. It proves the world visibly reacts and the chrome stays small, so
 * a human reviewer is judging a game rather than a spreadsheet.
 *
 * Everything runs on the deterministic local Cartographer with synthetic
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
  await navigateTo(page, label);
  await page.waitForTimeout(120);
};

/** How many regions are drawn under fog right now. */
const foggedRegions = () => page.locator('[data-testid^="fog-"]').count();
/** How many regions have shed their fog entirely. */
const revealedRegions = () => page.locator('[data-testid^="region-"][data-reveal="known"], [data-testid^="region-"][data-reveal="detailed"]').count();

/**
 * Milestones are non-blocking banners that clear themselves, so this reads what
 * was shown and then waits for the world to be uncovered again rather than
 * clicking anything away.
 */
async function readMilestones(): Promise<string[]> {
  const banners = page.locator('[data-testid="milestone"] .banner strong');
  if ((await banners.count()) === 0) return [];
  const shown: string[] = [];
  for (let index = 0; index < (await banners.count()); index += 1) shown.push(await banners.nth(index).innerText());
  await page.locator('[data-testid="milestone"]').waitFor({ state: 'detached', timeout: 20_000 });
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
  milestones: string[];
  sawMark: boolean;
  worldVisible: boolean;
}

const log: TurnLog[] = [];
let fogAtStart = 0;
let revealedAtStart = 0;

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

describe('Atlas opens into a world', () => {
  it('the root view is the map itself, not a page of cards', async () => {
    await page.waitForSelector('[data-testid="world"]');
    expect(await page.locator('[data-testid="world"]').isVisible()).toBe(true);

    // The island fills the screen rather than sitting in a panel among panels.
    const world = (await page.locator('[data-testid="world"]').boundingBox())!;
    expect(world.height).toBeGreaterThan(VIEWPORT.height * 0.7);
    expect(world.width).toBeGreaterThan(VIEWPORT.width * 0.9);

    // There is no four-tab application nav any more.
    expect(await page.locator('nav[aria-label="Main"]').count()).toBe(0);

    // Greyson is standing in it, and the chrome is a place name, a level pip,
    // a menu and one way in.
    expect(await page.locator('[data-testid="world-greyson"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="hud-territory"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="open-menu"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="enter-encounter"]').isVisible()).toBe(true);
  });

  it('Greyson is actually drawn, not an empty sprite slot', async () => {
    // Two of the five canonical 48x64 slots ship unusable — one fully
    // transparent, one colour-corrupted — and the asset test only checks
    // dimensions, so a blank protagonist would otherwise pass every check.
    const opaquePixels = await page.evaluate(async () => {
      const img = document.querySelector('[data-testid="world-greyson"] img') as HTMLImageElement;
      if (!img) return -1;
      if (!img.complete) await new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; });
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const context = canvas.getContext('2d')!;
      context.drawImage(img, 0, 0);
      const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
      let count = 0;
      for (let index = 3; index < data.length; index += 4) if (data[index] > 200) count += 1;
      return count;
    });
    // A drawn 48x64 character covers a substantial share of its frame.
    expect(opaquePixels).toBeGreaterThan(400);
  });

  it('most of the island starts hidden under fog', async () => {
    fogAtStart = await foggedRegions();
    revealedAtStart = await revealedRegions();
    const state = await readState(page);

    expect(fogAtStart, 'regions under fog at turn zero').toBeGreaterThanOrEqual(state.territories.length - 1);
    expect(revealedAtStart, 'nothing is fully revealed before play').toBe(0);

    // Unexplored country is not pre-labelled with a finished sitemap.
    const named = await page.locator('[data-testid^="region-"] .wm-region-name').count();
    expect(named, 'named regions at turn zero').toBeLessThanOrEqual(1);
  });
});

describe('the first ten turns uncover it', () => {
  it('plays ten varied answers, recording what the player could see', async () => {
    const before = await readState(page);
    expect(before.turns).toHaveLength(0);

    for (let index = 0; index < ANSWERS.length; index += 1) {
      const turn = index + 1;
      await goto('Talk');
      await page.waitForSelector('[data-testid="answer-input"]');
      const question = await page.locator('[data-testid="prompt-question"]').innerText();
      // The world must still be on screen while the Cartographer is talking.
      const worldVisible = await page.locator('[data-testid="world"]').isVisible();

      await answer(ANSWERS[index], turn);

      const sawMark = await page.locator('[data-testid="world-mark"]').isVisible().catch(() => false);
      const milestones = await readMilestones();
      const state = await readState(page);

      log.push({ turn, question, xp: state.xp, level: state.level, activeTerritory: state.activeTerritory, milestones, sawMark, worldVisible });
    }

    expect(log).toHaveLength(10);
  }, 240_000);

  it('1. the first answer marks the world and moves XP', async () => {
    expect(log[0].xp).toBeGreaterThan(0);
    expect(log[0].sawMark, 'a coordinate visibly landed on the island').toBe(true);
    expect(log[0].milestones.join(' | ')).toContain('First Mark');
  });

  it('2. the conversation never leaves the world behind', async () => {
    expect(log.every((entry) => entry.worldVisible), 'world visible during every encounter').toBe(true);
  });

  it('3. fog recedes and more than one area becomes revealed', async () => {
    await goto('Map');
    const fogNow = await foggedRegions();
    const revealedNow = await revealedRegions();

    expect(fogNow, 'fog has withdrawn from part of the island').toBeLessThan(fogAtStart);
    expect(revealedNow, 'at least two areas are materially revealed').toBeGreaterThanOrEqual(2);
    expect(revealedNow).toBeGreaterThan(revealedAtStart);

    // Places that were unnamed silhouettes now carry their names.
    const named = await page.locator('[data-testid^="region-"] .wm-region-name').count();
    expect(named).toBeGreaterThanOrEqual(2);

    // And country nobody has been to is still hidden.
    expect(fogNow, 'the map is not finished after ten turns').toBeGreaterThan(0);
  });

  it('4. trails light up between places that have been walked', async () => {
    await goto('Map');
    const lit = await page.locator('.wm-trail.is-known').count();
    expect(lit, 'a route between two known regions is drawn').toBeGreaterThan(0);
  });

  it('5. Greyson travels rather than staying put', async () => {
    const visited = new Set(log.map((entry) => entry.activeTerritory));
    expect(visited.size, 'more than one region was occupied').toBeGreaterThan(1);

    await goto('Map');
    const state = await readState(page);
    const standingIn = await page.getAttribute('[data-testid="world-greyson"]', 'data-territory');
    expect(standingIn).toBe(state.activeTerritory);
    expect(standingIn).not.toBe('identity');
  });

  it('6. no question is asked twice and the Identity loop never returns', async () => {
    const questions = log.map((entry) => entry.question);
    expect(new Set(questions).size).toBe(questions.length);
  });

  it('7. milestones arrive as brief banners, never a blocking changelog', async () => {
    const busiest = log.reduce((most, entry) => Math.max(most, entry.milestones.length), 0);
    expect(busiest, 'several grants were surfaced together').toBeGreaterThan(1);
    // The old six-item modal is gone: nothing blocks, and nothing stacks deep.
    expect(busiest, 'banners stay shallow').toBeLessThanOrEqual(2);
    expect(await page.locator('[data-testid="milestone-continue"]').count(), 'no dismiss-to-continue modal').toBe(0);

    // Everything that was earned is still surfaced somewhere across the session.
    const announced = log.flatMap((entry) => entry.milestones).join(' | ');
    expect(announced).toContain('Level 2');
    expect(announced).toContain('Go Deeper unlocked');
    expect(announced).toContain('Fragment recovered');
  });

  it('8. the action row stays small and contextual', async () => {
    await goto('Talk');
    const buttons = page.locator('[data-testid="action-bar"] button');
    const labels: string[] = [];
    for (let index = 0; index < (await buttons.count()); index += 1) labels.push((await buttons.nth(index).innerText()).trim());

    // Four at the very most: Pass, up to two earned moves, More.
    expect(labels.length).toBeLessThanOrEqual(4);
    expect(labels).toContain('Pass');
    expect(labels.some((label) => label.includes('More'))).toBe(true);
    for (const permanent of ['Private', 'Stop', 'Serious', 'Help', 'Sass']) {
      expect(labels, `${permanent} is not on the primary row`).not.toContain(permanent);
    }

    // A move is offered because it is useful now, not merely because it is owned.
    await page.fill('[data-testid="answer-input"]', 'A part-written answer.');
    expect(await page.locator('[data-testid="move-reroll"]').count(), 'reroll withdraws once answering starts').toBe(0);
    await page.fill('[data-testid="answer-input"]', '');
    await page.waitForTimeout(80);

    // Permanent agency is still one interaction away and never gated.
    await openAgency(page);
    for (const control of ['stop', 'private', 'serious', 'help', 'sass']) {
      expect(await page.locator(`[data-testid="agency-${control}"]`).isVisible(), control).toBe(true);
      expect(await page.locator(`[data-testid="agency-${control}"]`).isDisabled(), control).toBe(false);
    }
    await page.click('[data-testid="more-close"]');
  });

  it('9. earned abilities are named and usable where play happens', async () => {
    const state = await readState(page);
    const unlocked = state.unlocks.filter((unlock) => unlock.unlockedAt).map((unlock) => unlock.id);
    expect(unlocked).toContain('go-deeper');
    expect(unlocked).toContain('reroll');

    await goto('Talk');
    expect(await page.locator('[data-testid="move-go-deeper"]').isVisible()).toBe(true);
  });

  it('10. the Vault holds what the world handed over', async () => {
    const state = await readState(page);
    expect(state.mapFragments.length).toBeGreaterThan(0);

    await goto('Vault');
    const vault = await page.locator('[data-testid="sheet"]').innerText();
    expect(vault).toContain('CHARTED');
    expect(vault).not.toMatch(/Fragments\s*0 \/ 8/);
    await page.click('[data-testid="close-sheet"]');
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

    const afterInvoke = await readState(page);
    expect(afterInvoke.xp).toBe(before.xp);
    expect(afterInvoke.turns).toHaveLength(before.turns.length);

    await answer('The part I leave out is that it is mostly stubbornness dressed up as principle.', before.turns.length + 1);
    await readMilestones();

    const afterAnswer = await readState(page);
    expect(afterAnswer.xp).toBeGreaterThan(before.xp);
    expect(afterAnswer.turns[afterAnswer.turns.length - 1].question).toBe(deeper);
  }, 90_000);

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

    await page.click('[data-testid="move-reroll"]');
    expect(await page.locator('[data-testid="prompt-question"]').innerText()).not.toBe(reframed);

    const shown = await page.locator('[data-testid="prompt-question"]').innerText();
    await answer('On a bad day it looks like refusing to move until someone explains themselves.', before.turns.length + 1);
    await readMilestones();

    const afterAnswer = await readState(page);
    expect(afterAnswer.turns[afterAnswer.turns.length - 1].question).toBe(shown);
  }, 90_000);
});

describe('quiet mode keeps the progress and drops the celebration', () => {
  it('advances the world while suppressing every banner', async () => {
    await goto('Talk');
    await openAgency(page);
    await page.click('[data-testid="agency-serious"]');

    const before = await readState(page);
    expect(before.presentation).toBe('quiet');

    for (let index = 0; index < 4; index += 1) {
      await goto('Talk');
      await page.waitForSelector('[data-testid="answer-input"]');
      await answer(`A plain synthetic answer for the quiet-mode check, number ${index}.`, before.turns.length + index + 1);
      expect(await page.locator('[data-testid="milestone"]').isVisible().catch(() => false), 'no celebration while quiet').toBe(false);
    }

    const after = await readState(page);
    expect(after.xp).toBeGreaterThan(before.xp);
    expect(after.turns.length).toBe(before.turns.length + 4);
    // Nothing earned was discarded; it simply was not paraded.
    expect(after.presentationQueue.length).toBeGreaterThan(0);

    await goto('Map');
    expect(await page.locator('[data-testid="world"]').isVisible()).toBe(true);
    expect(await page.locator('[data-testid="hud-level"]').innerText()).toBe(`L${after.level}`);
  }, 150_000);
});

describe('the world holds together at every supported width', () => {
  it('never overflows and never collapses into a list', async () => {
    await goto('Map');
    for (const size of [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 320, height: 640 }]) {
      await page.setViewportSize(size);
      await page.waitForTimeout(180);

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `no horizontal overflow at ${size.width}px`).toBeLessThanOrEqual(0);

      const world = (await page.locator('[data-testid="world"]').boundingBox())!;
      expect(world.height, `world height at ${size.width}px`).toBeGreaterThan(size.height * 0.7);
      expect(await page.locator('[data-testid="world-greyson"]').isVisible()).toBe(true);
      expect(await page.locator('[data-testid="enter-encounter"]').isVisible()).toBe(true);
    }
    await page.setViewportSize(VIEWPORT);
  }, 60_000);
});
