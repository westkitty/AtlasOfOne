import { describe, expect, it } from 'vitest';
import { createMockTurn, getMockPrompt, recordsFromMockTurn } from '../../src/cartographer/mock';
import { applyGameEvent, applyGameEvents, createInitialCampaign, nextViableTerritory, territoryIsViable } from '../../src/game/engine';
import type { CampaignState, GameEvent } from '../../src/game/types';
import { syntheticDevelopedAnswer } from '../fixtures/synthetic';

/**
 * The campaign used to run out of questions.
 *
 * Once every Identity dimension was covered, `activeTerritory` stayed on
 * Identity forever and `getMockPrompt` fell back to the first available
 * dimension — so the fifth answer onwards re-asked the self-description
 * question indefinitely. These tests pin the deterministic rule that ended it.
 */

/** Answer the question the engine is currently asking, through the ordinary path. */
function answerCurrentQuestion(state: CampaignState, answer = syntheticDevelopedAnswer): CampaignState {
  const prompt = getMockPrompt(state);
  const records = recordsFromMockTurn(prompt, answer, createMockTurn(state, prompt, answer));
  return applyGameEvents(state, [
    { type: 'ANSWER_ACCEPTED', turn: records.turnRecord },
    ...records.evidence.map((evidence) => ({ type: 'EVIDENCE_ADDED', evidence }) as GameEvent)
  ]);
}

describe('territory continuity', () => {
  it('leaves a territory once its dimensions are exhausted', () => {
    let state = createInitialCampaign();
    expect(state.activeTerritory).toBe('identity');

    const asked: string[] = [];
    for (let turn = 0; turn < 4; turn += 1) {
      asked.push(getMockPrompt(state).dimension);
      state = answerCurrentQuestion(state);
    }

    // All four Identity dimensions, each asked exactly once.
    expect(new Set(asked).size).toBe(4);
    expect(state.territories.find((t) => t.id === 'identity')!.coveredDimensions).toHaveLength(4);

    // The fifth question is somewhere else entirely.
    expect(state.activeTerritory).not.toBe('identity');
    const fifth = getMockPrompt(state);
    expect(fifth.territoryId).toBe(state.activeTerritory);
    expect(asked).not.toContain(fifth.dimension);
    expect(fifth.dimension).not.toBe('self-description');
  });

  it('never repeats the exhausted prompt across a ten-turn campaign', () => {
    let state = createInitialCampaign();
    const questions: string[] = [];
    for (let turn = 0; turn < 10; turn += 1) {
      questions.push(getMockPrompt(state).question);
      state = answerCurrentQuestion(state);
    }
    // The old defect produced six identical self-description questions.
    expect(new Set(questions).size).toBe(10);
    expect(state.territories.filter((t) => t.coveredDimensions.length > 0).length).toBeGreaterThan(1);
  });

  it('relocates deterministically in campaign order, awarding nothing for the move', () => {
    let state = createInitialCampaign();
    for (let turn = 0; turn < 4; turn += 1) state = answerCurrentQuestion(state);
    const first = state.activeTerritory;

    // Same inputs, same destination: selection carries no randomness.
    let repeat = createInitialCampaign();
    for (let turn = 0; turn < 4; turn += 1) repeat = answerCurrentQuestion(repeat);
    expect(repeat.activeTerritory).toBe(first);

    // Moving is not an accomplishment.
    const before = { xp: state.xp, level: state.level, turns: state.turns.length };
    const moved = applyGameEvent(state, { type: 'ACTIVE_TERRITORY_SET', territoryId: 'future' });
    expect(moved.activeTerritory).toBe('future');
    expect(moved.xp).toBe(before.xp);
    expect(moved.level).toBe(before.level);
    expect(moved.turns).toHaveLength(before.turns);
  });

  it('honours a manual territory choice instead of bouncing the player out of it', () => {
    let state = createInitialCampaign();
    for (let turn = 0; turn < 4; turn += 1) state = answerCurrentQuestion(state);
    // Identity is exhausted, but looking at it is a legitimate player decision.
    const revisited = applyGameEvent(state, { type: 'ACTIVE_TERRITORY_SET', territoryId: 'identity' });
    expect(revisited.activeTerritory).toBe('identity');
  });

  it('escapes a territory whose remaining dimensions are all private', () => {
    let state = createInitialCampaign();
    // Retire every Identity dimension by marking it private rather than answering.
    for (const dimension of state.territories.find((t) => t.id === 'identity')!.requiredDimensions) {
      state = applyGameEvent(state, { type: 'PRIVATE_TOPIC_ADDED', topic: dimension });
    }
    expect(state.activeTerritory).not.toBe('identity');

    const prompt = getMockPrompt(state);
    expect(state.privateTopics).not.toContain(prompt.dimension);
    expect(prompt.territoryId).not.toBe('identity');
  });

  it('reports no viable territory rather than inventing another question loop', () => {
    const state = createInitialCampaign();
    const exhausted: CampaignState = {
      ...state,
      territories: state.territories.map((territory) => ({ ...territory, coveredDimensions: [...territory.requiredDimensions] }))
    };
    expect(exhausted.territories.every((t) => !territoryIsViable(t, exhausted.privateTopics))).toBe(true);
    expect(nextViableTerritory(exhausted)).toBeNull();
  });
});
