export const syntheticShortAnswer = 'I tend to describe myself by what I choose, not by a formal role.';
export const syntheticDevelopedAnswer = 'For example, when a group has to make a difficult choice, I usually slow down, ask what each option would cost the people with the least power, and then decide from there rather than chasing the fastest answer.';
export const syntheticRevisionAnswer = 'Actually, I used to think certainty was necessary before acting, but I changed my mind after seeing how often waiting for certainty simply handed the decision to somebody else.';

import { getMockPrompt, createMockTurn, recordsFromMockTurn } from '../../src/cartographer/mock';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, GameEvent } from '../../src/game/types';

/** Answer the current mock prompt with synthetic material. */
export function answerCurrentPrompt(state: CampaignState, answer = syntheticDevelopedAnswer): CampaignState {
  const prompt = getMockPrompt(state);
  const modelTurn = createMockTurn(state, prompt, answer);
  const records = recordsFromMockTurn(prompt, answer, modelTurn);
  const events: GameEvent[] = [
    { type: 'ANSWER_ACCEPTED', turn: records.turnRecord },
    ...records.evidence.map((evidence) => ({ type: 'EVIDENCE_ADDED', evidence }) as GameEvent)
  ];
  if (records.insight) events.push({ type: 'INSIGHT_ADDED', insight: records.insight });
  return applyGameEvents(state, events);
}

/** Fully chart one territory with synthetic answers. */
export function chartTerritory(state: CampaignState, territoryId: string): CampaignState {
  let next = applyGameEvents(state, [{ type: 'ACTIVE_TERRITORY_SET', territoryId }]);
  const required = next.territories.find((item) => item.id === territoryId)?.requiredDimensions.length ?? 0;
  for (let index = 0; index < required; index += 1) next = answerCurrentPrompt(next);
  return next;
}

/**
 * Build a synthetic campaign with the named territories charted. `xp` tops the
 * campaign up afterwards so level-gated encounters can be exercised directly.
 */
export function seededCampaign(options: { territories: string[]; xp?: number }): CampaignState {
  let state = createInitialCampaign();
  for (const territoryId of options.territories) state = chartTerritory(state, territoryId);
  if (options.xp !== undefined && options.xp > state.xp) {
    state = applyGameEvents({ ...state, xp: options.xp }, [{ type: 'PRESENTATION_QUEUE_CLEARED' }]);
  }
  return state;
}
