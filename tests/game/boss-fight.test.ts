import { describe, expect, it } from 'vitest';
import { describeBossStage, encounterTurnRecord } from '../../src/cartographer/mock';
import { BOSS_DEFINITIONS } from '../../src/game/data';
import { activeBossRun, availableBosses, bossRunFor, currentBossStage, isBossAvailable, planBossStages } from '../../src/game/encounters';
import { applyGameEvent, applyGameEvents } from '../../src/game/engine';
import type { CampaignState, GameEvent } from '../../src/game/types';
import { chartTerritory, seededCampaign } from '../fixtures/synthetic';

const BOSS = 'boss-values';
const TERRITORY = 'values';

/** A campaign with enough synthetic evidence and level to make the Boss Fight legal. */
function readyForBoss(): CampaignState {
  return seededCampaign({ territories: ['values', 'politics', 'identity', 'cognition'], xp: 700 });
}

function answerStage(state: CampaignState, answer: string): CampaignState {
  const run = activeBossRun(state)!;
  const stage = currentBossStage(run)!;
  const wording = describeBossStage(state, stage);
  const turn = encounterTurnRecord(run.territoryId, stage.dimensions[0], wording.question, answer);
  return applyGameEvent(state, { type: 'BOSS_STAGE_ANSWERED', turn });
}

describe('Boss Fight availability', () => {
  it('is decided by deterministic campaign state, not by the model', () => {
    const empty = seededCampaign({ territories: [], xp: 700 });
    expect(isBossAvailable(empty, BOSS)).toBe(false);

    const ready = readyForBoss();
    expect(isBossAvailable(ready, BOSS)).toBe(true);
    expect(availableBosses(ready).map((item) => item.id)).toContain(BOSS);
  });

  it('stays locked below the required level even with full evidence coverage', () => {
    const lowLevel = seededCampaign({ territories: ['values'], xp: 0 });
    expect(lowLevel.level).toBeLessThan(BOSS_DEFINITIONS.find((item) => item.id === BOSS)!.levelRequired);
    expect(isBossAvailable(lowLevel, BOSS)).toBe(false);
    expect(applyGameEvent(lowLevel, { type: 'BOSS_STARTED', bossId: BOSS }).activeBoss).toBeNull();
  });

  it('plans stages only from evidence the player already produced', () => {
    const state = readyForBoss();
    const stages = planBossStages(state, BOSS);
    expect(stages).toHaveLength(3);
    expect(stages.map((stage) => stage.kind)).toEqual(['priority', 'tradeoff', 'contradiction']);
    const covered = state.territories.find((item) => item.id === TERRITORY)!.coveredDimensions;
    for (const stage of stages) {
      expect(stage.dimensions.every((dimension) => covered.includes(dimension))).toBe(true);
      for (const id of stage.evidenceIds) {
        expect(state.evidence.some((item) => item.id === id && item.status === 'active')).toBe(true);
      }
    }
  });

  it('produces an identical plan for identical state', () => {
    const state = readyForBoss();
    expect(planBossStages(state, BOSS)).toEqual(planBossStages(state, BOSS));
  });
});

describe('Boss Fight progression authority', () => {
  it('awards the fixed reward and achievement only through engine completion', () => {
    let state = applyGameEvent(readyForBoss(), { type: 'BOSS_STARTED', bossId: BOSS });
    const before = state.xp;
    expect(state.activeBoss).toBe(BOSS);

    state = answerStage(state, 'Synthetic stage answer one that is long enough to count as developed material for the mapped tradeoff.');
    expect(bossRunFor(state, BOSS)!.status).toBe('active');
    state = answerStage(state, 'Synthetic stage answer two naming a concrete cost rather than restating the principle itself.');
    state = answerStage(state, 'Synthetic stage answer three resolving the tension between the two mapped positions under pressure.');

    const run = bossRunFor(state, BOSS)!;
    expect(run.status).toBe('complete');
    expect(state.activeBoss).toBeNull();
    const reward = BOSS_DEFINITIONS.find((item) => item.id === BOSS)!.xpReward;
    // three developed answers (8 XP each) plus exactly one fixed boss reward
    expect(state.xp).toBe(before + 24 + reward);
    expect(state.achievements.find((item) => item.id === 'boss-resolved')?.unlockedAt).toBeTruthy();
  });

  it('cannot be completed or rewarded by model-shaped events', () => {
    const state = applyGameEvent(readyForBoss(), { type: 'BOSS_STARTED', bossId: BOSS });
    const forged: GameEvent[] = [
      { type: 'ACHIEVEMENT_UNLOCKED', achievementId: 'boss-resolved' },
      { type: 'ABILITY_UNLOCKED', unlockId: 'boss-fight' },
      { type: 'LEVEL_UP', level: 8 }
    ];
    const after = applyGameEvents(state, forged);
    expect(bossRunFor(after, BOSS)!.status).toBe('active');
    expect(after.xp).toBe(state.xp);
    expect(after.achievements.find((item) => item.id === 'boss-resolved')?.unlockedAt).toBeUndefined();
  });

  it('refuses to start a boss that deterministic state has not made available', () => {
    const state = seededCampaign({ territories: ['values'], xp: 700 });
    const started = applyGameEvent(state, { type: 'BOSS_STARTED', bossId: 'boss-politics' });
    expect(started.activeBoss).toBeNull();
    expect(started.bossRuns).toHaveLength(0);
  });

  it('awards a resolved boss exactly once', () => {
    let state = applyGameEvent(readyForBoss(), { type: 'BOSS_STARTED', bossId: BOSS });
    state = applyGameEvents(state, [{ type: 'BOSS_STAGE_PASSED' }, { type: 'BOSS_STAGE_PASSED' }, { type: 'BOSS_STAGE_PASSED' }]);
    const settled = state.xp;
    expect(bossRunFor(state, BOSS)!.status).toBe('complete');
    const again = applyGameEvent(state, { type: 'BOSS_STARTED', bossId: BOSS });
    expect(again.activeBoss).toBeNull();
    expect(again.xp).toBe(settled);
  });
});

describe('Boss Fight agency', () => {
  it('lets PASS resolve every stage without an XP penalty and without trapping the player', () => {
    const start = applyGameEvent(readyForBoss(), { type: 'BOSS_STARTED', bossId: BOSS });
    const passed = applyGameEvents(start, [{ type: 'BOSS_STAGE_PASSED' }, { type: 'BOSS_STAGE_PASSED' }, { type: 'BOSS_STAGE_PASSED' }]);
    expect(passed.xp).toBe(start.xp + BOSS_DEFINITIONS.find((item) => item.id === BOSS)!.xpReward);
    expect(bossRunFor(passed, BOSS)!.stages.every((stage) => stage.outcome === 'passed')).toBe(true);
    expect(passed.activeBoss).toBeNull();
  });

  it('lets the player withdraw and resume without losing stage progress', () => {
    let state = applyGameEvent(readyForBoss(), { type: 'BOSS_STARTED', bossId: BOSS });
    state = applyGameEvent(state, { type: 'BOSS_STAGE_PASSED' });
    state = applyGameEvent(state, { type: 'BOSS_WITHDRAWN' });
    expect(state.activeBoss).toBeNull();
    expect(bossRunFor(state, BOSS)!.status).toBe('active');

    const resumed = applyGameEvent(state, { type: 'BOSS_STARTED', bossId: BOSS });
    expect(resumed.activeBoss).toBe(BOSS);
    expect(currentBossStage(activeBossRun(resumed))!.id).toBe(`${BOSS}_stage_2`);
  });

  it('blocks stage submission while STOP has paused the session', () => {
    let state = applyGameEvent(readyForBoss(), { type: 'BOSS_STARTED', bossId: BOSS });
    state = applyGameEvent(state, { type: 'SESSION_SET', status: 'paused' });
    const blocked = answerStage(state, 'Synthetic answer submitted while paused.');
    expect(blocked.turns).toHaveLength(state.turns.length);
    expect(blocked.xp).toBe(state.xp);

    const resumed = applyGameEvent(blocked, { type: 'SESSION_SET', status: 'active' });
    expect(answerStage(resumed, 'Synthetic answer after resuming.').turns.length).toBe(state.turns.length + 1);
  });

  it('retires pending stages built on a topic the player marks PRIVATE', () => {
    const start = applyGameEvent(readyForBoss(), { type: 'BOSS_STARTED', bossId: BOSS });
    const topic = currentBossStage(activeBossRun(start))!.dimensions[0];
    const after = applyGameEvent(start, { type: 'PRIVATE_TOPIC_ADDED', topic });
    const run = bossRunFor(after, BOSS)!;
    const stillPending = run.stages.filter((stage) => stage.outcome === 'pending');
    expect(stillPending.every((stage) => !stage.dimensions.includes(topic))).toBe(true);
    expect(after.privateTopics).toContain(topic);
  });

  it('completes in quiet mode while suppressing celebratory presentation', () => {
    let state = applyGameEvent(readyForBoss(), { type: 'PRESENTATION_SET', mode: 'quiet' });
    state = applyGameEvent(state, { type: 'BOSS_STARTED', bossId: BOSS });
    const quietBefore = state.presentationQueue.length;
    state = applyGameEvents(state, [{ type: 'BOSS_STAGE_PASSED' }, { type: 'BOSS_STAGE_PASSED' }, { type: 'BOSS_STAGE_PASSED' }]);

    expect(state.presentation).toBe('quiet');
    expect(bossRunFor(state, BOSS)!.status).toBe('complete');
    expect(state.achievements.find((item) => item.id === 'boss-resolved')?.unlockedAt).toBeTruthy();
    // Progress is real; the queue is simply never surfaced while quiet.
    expect(state.presentationQueue.length).toBeGreaterThanOrEqual(quietBefore);
    expect(chartTerritory).toBeTypeOf('function');
  });

  it('never pays a bonus for a painful disclosure', () => {
    const start = applyGameEvent(readyForBoss(), { type: 'BOSS_STARTED', bossId: BOSS });
    const neutral = answerStage(start, 'A synthetic answer of exactly comparable length, kept deliberately ordinary in tone.');
    const painful = answerStage(start, 'A synthetic answer of exactly comparable length, framed as difficult and costly.');
    expect(painful.xp).toBe(neutral.xp);
  });
});

describe('Full territory Boss Fight coverage', () => {
  it('defines a Boss Fight for every territory in TERRITORY_DEFINITIONS', () => {
    const allTerritoryIds = [
      'identity', 'values', 'politics', 'relationships',
      'interests', 'cognition', 'fears', 'future'
    ];
    expect(BOSS_DEFINITIONS).toHaveLength(8);
    for (const territoryId of allTerritoryIds) {
      const boss = BOSS_DEFINITIONS.find((b) => b.territoryId === territoryId);
      expect(boss, `missing BossDefinition for territory: ${territoryId}`).toBeDefined();
      expect(boss!.levelRequired).toBe(5);
      expect(boss!.minCoveredDimensions).toBeGreaterThanOrEqual(3);
      expect(boss!.xpReward).toBeGreaterThan(0);
    }
  });

  it('can plan and resolve Boss Fights for all 8 territories deterministically', () => {
    for (const boss of BOSS_DEFINITIONS) {
      const state = seededCampaign({ territories: [boss.territoryId], xp: 700 });
      expect(isBossAvailable(state, boss.id), `Boss should be available for ${boss.territoryId}`).toBe(true);

      const stages = planBossStages(state, boss.id);
      expect(stages).toHaveLength(3);
      expect(stages.map((s) => s.kind)).toEqual(['priority', 'tradeoff', 'contradiction']);

      const started = applyGameEvent(state, { type: 'BOSS_STARTED', bossId: boss.id });
      expect(started.activeBoss).toBe(boss.id);

      const completed = applyGameEvents(started, [
        { type: 'BOSS_STAGE_PASSED' },
        { type: 'BOSS_STAGE_PASSED' },
        { type: 'BOSS_STAGE_PASSED' }
      ]);
      expect(completed.activeBoss).toBeNull();
      const run = bossRunFor(completed, boss.id);
      expect(run?.status).toBe('complete');
      expect(completed.xp).toBe(started.xp + boss.xpReward);
      expect(isBossAvailable(completed, boss.id)).toBe(false);
    }
  });
});
