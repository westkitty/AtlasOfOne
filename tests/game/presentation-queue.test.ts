import { describe, expect, it } from 'vitest';
import { createMockTurn, getMockPrompt, recordsFromMockTurn } from '../../src/cartographer/mock';
import { applyGameEvent, applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, GameEvent } from '../../src/game/types';
import { syntheticDevelopedAnswer } from '../fixtures/synthetic';

/**
 * Milestones used to be destroyed on the way out.
 *
 * Only `presentationQueue[0]` was ever rendered, and dismissing it dispatched
 * `PRESENTATION_QUEUE_CLEARED`, which emptied the entire array. In the ten-turn
 * diagnostic, one answer granted Level 2, the Go Deeper unlock, a completed
 * quest, the Identity Fragment, a charted territory and an achievement — and the
 * player was shown "Level 2" and nothing else, permanently.
 */

function answerCurrentQuestion(state: CampaignState, answer = syntheticDevelopedAnswer): CampaignState {
  const prompt = getMockPrompt(state);
  const records = recordsFromMockTurn(prompt, answer, createMockTurn(state, prompt, answer));
  return applyGameEvents(state, [
    { type: 'ANSWER_ACCEPTED', turn: records.turnRecord },
    ...records.evidence.map((evidence) => ({ type: 'EVIDENCE_ADDED', evidence }) as GameEvent)
  ]);
}

/** What the UI does when the player taps Continue: acknowledge what was shown. */
function acknowledgeAll(state: CampaignState): CampaignState {
  return applyGameEvents(state, state.presentationQueue.map((notice) => ({ type: 'PRESENTATION_NOTICE_ACKNOWLEDGED', noticeId: notice.id }) as GameEvent));
}

/**
 * Play to the turn that grants several things at once, clearing the previous
 * turn's card first the way a player would. Without that acknowledgement the
 * queue legitimately still holds turn 1's achievement — losslessness means
 * notices persist until they are actually seen.
 */
function stateWithMultipleNotices(): CampaignState {
  let state = acknowledgeAll(answerCurrentQuestion(createInitialCampaign()));
  state = answerCurrentQuestion(state);
  return state;
}

describe('milestone queue is lossless', () => {
  it('queues every class of grant a single answer produced', () => {
    const state = stateWithMultipleNotices();
    const kinds = state.presentationQueue.map((notice) => notice.kind);

    expect(state.presentationQueue.length).toBeGreaterThanOrEqual(5);
    // Each of these reached state; each must also have been announced.
    expect(kinds).toContain('level');
    expect(kinds).toContain('unlock');
    expect(kinds).toContain('quest');
    expect(kinds).toContain('fragment');
    expect(kinds).toContain('territory');
    expect(kinds).toContain('achievement');

    // The headline is the level-up, so the card leads with the biggest thing.
    expect(state.presentationQueue[0].kind).toBe('level');
  });

  it('acknowledging one notice leaves its siblings untouched', () => {
    const state = stateWithMultipleNotices();
    const [first, ...rest] = state.presentationQueue;
    expect(rest.length).toBeGreaterThan(0);

    const after = applyGameEvent(state, { type: 'PRESENTATION_NOTICE_ACKNOWLEDGED', noticeId: first.id });

    expect(after.presentationQueue.map((n) => n.id)).toEqual(rest.map((n) => n.id));
    expect(after.presentationQueue).toHaveLength(rest.length);
    // This is the exact regression: the old whole-queue clear would leave zero.
    expect(after.presentationQueue.length).toBeGreaterThan(0);
  });

  it('acknowledging every shown notice drains the queue exactly once', () => {
    const state = stateWithMultipleNotices();
    const shown = [...state.presentationQueue];
    const after = applyGameEvents(state, shown.map((notice) => ({ type: 'PRESENTATION_NOTICE_ACKNOWLEDGED', noticeId: notice.id }) as GameEvent));
    expect(after.presentationQueue).toHaveLength(0);
  });

  it('acknowledging an unknown notice id changes nothing', () => {
    const state = stateWithMultipleNotices();
    const after = applyGameEvent(state, { type: 'PRESENTATION_NOTICE_ACKNOWLEDGED', noticeId: 'notice_does_not_exist' });
    expect(after.presentationQueue.map((n) => n.id)).toEqual(state.presentationQueue.map((n) => n.id));
  });

  it('grants and queues milestones in quiet mode without losing them', () => {
    let state = applyGameEvent(createInitialCampaign(), { type: 'PRESENTATION_SET', mode: 'quiet' });
    state = acknowledgeAll(answerCurrentQuestion(state));
    state = answerCurrentQuestion(state);

    // Progression is untouched by presentation mode...
    expect(state.presentation).toBe('quiet');
    expect(state.xp).toBeGreaterThan(0);
    expect(state.level).toBeGreaterThan(1);
    expect(state.mapFragments.length).toBeGreaterThan(0);
    // ...and the record of what was earned still exists to be read.
    expect(state.presentationQueue.length).toBeGreaterThan(0);
  });

  it('does not announce a milestone that was not earned', () => {
    const state = createInitialCampaign();
    const idle = applyGameEvent(state, { type: 'ACTIVE_TERRITORY_SET', territoryId: 'values' });
    expect(idle.presentationQueue).toHaveLength(0);
  });
});
