import { describe, expect, it } from 'vitest';
import { createMockTurn, getMockPrompt, recordsFromMockTurn } from '../../src/cartographer/mock';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, GameEvent } from '../../src/game/types';
import { syntheticDevelopedAnswer } from '../fixtures/synthetic';

function answerCurrentPrompt(state: CampaignState): CampaignState {
  const prompt = getMockPrompt(state);
  const modelTurn = createMockTurn(state, prompt, syntheticDevelopedAnswer);
  const records = recordsFromMockTurn(prompt, syntheticDevelopedAnswer, modelTurn);
  const events: GameEvent[] = [
    { type: 'ANSWER_ACCEPTED', turn: records.turnRecord },
    ...records.evidence.map((evidence) => ({ type: 'EVIDENCE_ADDED', evidence }) as GameEvent)
  ];
  if (records.insight) events.push({ type: 'INSIGHT_ADDED', insight: records.insight });
  return applyGameEvents(state, events);
}

describe('synthetic long campaign', () => {
  it('can chart every bootstrap territory and remain deterministic through 100 turns', () => {
    let state = createInitialCampaign();
    let turns = 0;

    for (const territory of state.territories) {
      state = applyGameEvents(state, [{ type: 'ACTIVE_TERRITORY_SET', territoryId: territory.id }]);
      const required = state.territories.find((item) => item.id === territory.id)!.requiredDimensions.length;
      for (let index = 0; index < required; index += 1) {
        state = answerCurrentPrompt(state);
        turns += 1;
      }
    }

    while (turns < 100) {
      state = answerCurrentPrompt(state);
      turns += 1;
    }

    expect(state.turns).toHaveLength(100);
    expect(state.territories.every((territory) => territory.status === 'deeply-charted')).toBe(true);
    expect(state.mapFragments).toHaveLength(state.territories.length);
    expect(new Set(state.mapFragments.map((fragment) => fragment.territoryId)).size).toBe(state.territories.length);
    expect(state.level).toBe(8);
    expect(state.unlocks.every((unlock) => Boolean(unlock.unlockedAt))).toBe(true);
    expect(state.achievements.find((achievement) => achievement.id === 'cartographer')?.unlockedAt).toBeTruthy();
    expect(state.quests.every((quest) => quest.status === 'complete')).toBe(true);
  });
});
