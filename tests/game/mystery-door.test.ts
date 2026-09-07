import { describe, expect, it } from 'vitest';
import { describeDoor, doorInsightFrom, encounterTurnRecord } from '../../src/cartographer/mock';
import { DOOR_LEVEL_REQUIRED, DOOR_XP_REWARD } from '../../src/game/data';
import { activeDoorRun, availableDoors, doorIdFor, doorRunFor, doorRunIsPresentable, usableEvidence } from '../../src/game/encounters';
import { applyGameEvent, applyGameEvents } from '../../src/game/engine';
import type { CampaignState, GameEvent } from '../../src/game/types';
import { answerCurrentPrompt, seededCampaign } from '../fixtures/synthetic';

const LABELS: Record<string, string> = { identity: 'Identity', values: 'Values', politics: 'The Republic of Greyson', cognition: 'Cognition' };

function readyForDoors(): CampaignState {
  return seededCampaign({ territories: ['identity', 'values', 'cognition'], xp: 700 });
}

function openFirstDoor(state: CampaignState) {
  const candidate = availableDoors(state)[0];
  return { candidate, next: applyGameEvent(state, { type: 'DOOR_OPENED', doorId: candidate.doorId }) };
}

function answerDoor(state: CampaignState, answer: string): CampaignState {
  const run = activeDoorRun(state)!;
  const wording = describeDoor(state, run, LABELS);
  const turn = encounterTurnRecord(run.territoryIds[0], run.dimensions[0], wording.question, answer);
  return applyGameEvent(state, { type: 'DOOR_ANSWERED', turn, insight: doorInsightFrom(run, wording) });
}

describe('Mystery Door eligibility', () => {
  it('is decided by TypeScript state and requires evidence on both sides', () => {
    const single = seededCampaign({ territories: ['identity'], xp: 700 });
    expect(availableDoors(single)).toHaveLength(0);

    const ready = readyForDoors();
    const doors = availableDoors(ready);
    expect(doors.length).toBeGreaterThan(0);
    for (const door of doors) {
      expect(door.territoryIds).toHaveLength(2);
      expect(new Set(door.territoryIds).size).toBe(2);
      expect(door.evidenceIds).toHaveLength(2);
    }
  });

  it('stays unavailable below the required level', () => {
    const lowLevel = seededCampaign({ territories: ['identity', 'values', 'cognition'] });
    expect(lowLevel.level).toBeLessThan(DOOR_LEVEL_REQUIRED);
    expect(availableDoors(lowLevel)).toHaveLength(0);
    expect(applyGameEvent(lowLevel, { type: 'DOOR_OPENED', doorId: doorIdFor('identity', 'values') }).activeDoor).toBeNull();
  });

  it('uses stable, order-independent identifiers', () => {
    expect(doorIdFor('values', 'identity')).toBe(doorIdFor('identity', 'values'));
    expect(doorIdFor('identity', 'values')).toBe('door_identity__values');
  });

  it('builds doors from real evidence relationships rather than a question count', () => {
    const state = readyForDoors();
    for (const door of availableDoors(state)) {
      const [leftId, rightId] = door.evidenceIds;
      const left = state.evidence.find((item) => item.id === leftId)!;
      const right = state.evidence.find((item) => item.id === rightId)!;
      expect(left.territories).toContain(door.territoryIds[0]);
      expect(right.territories).toContain(door.territoryIds[1]);
      expect(left.status).toBe('active');
      expect(right.status).toBe('active');
    }
  });

  it('offers a deterministic candidate list for identical state', () => {
    const state = readyForDoors();
    expect(availableDoors(state)).toEqual(availableDoors(state));
  });
});

describe('Mystery Door privacy', () => {
  it('never builds a door out of private material', () => {
    const state = readyForDoors();
    const topic = availableDoors(state)[0].dimensions[0];
    const withPrivate = applyGameEvent(state, { type: 'PRIVATE_TOPIC_ADDED', topic });

    expect(usableEvidence(withPrivate).some((item) => item.dimension === topic)).toBe(false);
    for (const door of availableDoors(withPrivate)) {
      expect(door.dimensions).not.toContain(topic);
      for (const id of door.evidenceIds) {
        expect(withPrivate.evidence.find((item) => item.id === id)!.dimension).not.toBe(topic);
      }
    }
  });

  it('never requires a private topic to open or complete a door', () => {
    let state = readyForDoors();
    for (const topic of ['self-description', 'temperament']) {
      state = applyGameEvent(state, { type: 'PRIVATE_TOPIC_ADDED', topic });
    }
    const doors = availableDoors(state);
    expect(doors.length).toBeGreaterThan(0);
    expect(doors.every((door) => door.dimensions.every((dimension) => !state.privateTopics.includes(dimension)))).toBe(true);

    const opened = applyGameEvent(state, { type: 'DOOR_OPENED', doorId: doors[0].doorId });
    expect(answerDoor(opened, 'Synthetic cross-territory answer.').doorRuns.find((run) => run.doorId === doors[0].doorId)!.status).toBe('complete');
  });

  it('retires an already-open door when its material becomes private', () => {
    const { candidate, next } = openFirstDoor(readyForDoors());
    expect(next.activeDoor).toBe(candidate.doorId);

    const closed = applyGameEvent(next, { type: 'PRIVATE_TOPIC_ADDED', topic: candidate.dimensions[0] });
    expect(closed.activeDoor).toBeNull();
    expect(doorRunFor(closed, candidate.doorId)).toBeUndefined();
  });

  it('refuses to present a door whose evidence was retracted', () => {
    let state = readyForDoors();
    const { candidate, next } = openFirstDoor(state);
    const run = activeDoorRun(next)!;
    const turnId = state.evidence.find((item) => item.id === candidate.evidenceIds[0])!.sourceTurnIds[0];

    expect(doorRunIsPresentable(next, run)).toBe(true);
    state = applyGameEvent(next, { type: 'ANSWER_RETRACTED', turnId });
    expect(state.activeDoor).toBeNull();
    expect(doorRunIsPresentable(state, run)).toBe(false);
  });
});

describe('Mystery Door progression authority', () => {
  it('awards its fixed reward only through engine completion', () => {
    const { candidate, next } = openFirstDoor(readyForDoors());
    const before = next.xp;
    const done = answerDoor(next, 'Synthetic cross-territory answer that is long enough to register as developed material for the crossing.');

    expect(doorRunFor(done, candidate.doorId)!.status).toBe('complete');
    expect(done.activeDoor).toBeNull();
    expect(done.xp).toBe(before + 8 + DOOR_XP_REWARD);
    expect(done.achievements.find((item) => item.id === 'door-opener')?.unlockedAt).toBeTruthy();
    expect(done.insights.some((insight) => insight.title.startsWith('Crossing:'))).toBe(true);
  });

  it('cannot be opened, completed or rewarded by model-shaped events', () => {
    const state = readyForDoors();
    const forged: GameEvent[] = [
      { type: 'ACHIEVEMENT_UNLOCKED', achievementId: 'door-opener' },
      { type: 'ABILITY_UNLOCKED', unlockId: 'mystery-door' },
      { type: 'LEVEL_UP', level: 8 }
    ];
    const after = applyGameEvents(state, forged);
    expect(after.doorRuns).toHaveLength(0);
    expect(after.activeDoor).toBeNull();
    expect(after.xp).toBe(state.xp);
    expect(after.achievements.find((item) => item.id === 'door-opener')?.unlockedAt).toBeUndefined();
  });

  it('rejects a door id that deterministic state does not offer', () => {
    const state = readyForDoors();
    const bogus = applyGameEvent(state, { type: 'DOOR_OPENED', doorId: 'door_nowhere__elsewhere' });
    expect(bogus.activeDoor).toBeNull();
    expect(bogus.doorRuns).toHaveLength(0);
  });

  it('does not offer the same door twice once resolved', () => {
    const { candidate, next } = openFirstDoor(readyForDoors());
    const done = answerDoor(next, 'Synthetic cross-territory answer.');
    expect(availableDoors(done).some((door) => door.doorId === candidate.doorId)).toBe(false);
  });
});

describe('Mystery Door agency', () => {
  it('can be left closed indefinitely without blocking campaign completion', () => {
    let state = seededCampaign({ territories: [] });
    for (const territory of state.territories) {
      let next = applyGameEvents(state, [{ type: 'ACTIVE_TERRITORY_SET', territoryId: territory.id }]);
      const required = next.territories.find((item) => item.id === territory.id)!.requiredDimensions.length;
      for (let index = 0; index < required; index += 1) next = answerCurrentPrompt(next);
      state = next;
    }

    expect(state.doorRuns).toHaveLength(0);
    expect(availableDoors(state).length).toBeGreaterThan(0);
    // Charting every territory exactly is worth level 7; no Door is needed to get there.
    expect(state.level).toBe(7);
    expect(state.territories.every((item) => item.status === 'deeply-charted')).toBe(true);
    expect(applyGameEvent(state, { type: 'CAMPAIGN_COMPLETED' }).campaignCompleted).toBe(true);
  });

  it('lets the player walk away and keeps the pairing available', () => {
    const { candidate, next } = openFirstDoor(readyForDoors());
    const left = applyGameEvent(next, { type: 'DOOR_CLOSED' });
    expect(left.activeDoor).toBeNull();
    expect(left.doorRuns).toHaveLength(0);
    expect(availableDoors(left).some((door) => door.doorId === candidate.doorId)).toBe(true);
  });

  it('blocks submission while STOP has paused the session', () => {
    const { next } = openFirstDoor(readyForDoors());
    const paused = applyGameEvent(next, { type: 'SESSION_SET', status: 'paused' });
    const blocked = answerDoor(paused, 'Synthetic answer submitted while paused.');
    expect(blocked.xp).toBe(paused.xp);
    expect(blocked.activeDoor).toBe(paused.activeDoor);
  });

  it('completes in quiet mode without celebratory presentation', () => {
    const quiet = applyGameEvent(readyForDoors(), { type: 'PRESENTATION_SET', mode: 'quiet' });
    const { candidate, next } = openFirstDoor(quiet);
    const done = answerDoor(next, 'Synthetic cross-territory answer recorded quietly.');
    expect(done.presentation).toBe('quiet');
    expect(doorRunFor(done, candidate.doorId)!.status).toBe('complete');
  });

  it('never pays a bonus for a painful disclosure', () => {
    const { next } = openFirstDoor(readyForDoors());
    const neutral = answerDoor(next, 'A synthetic crossing answer of a deliberately ordinary and comparable length.');
    const painful = answerDoor(next, 'A synthetic crossing answer of a deliberately costly and comparable length..');
    expect(painful.xp).toBe(neutral.xp);
  });
});
