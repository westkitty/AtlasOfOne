import { describe, expect, it } from 'vitest';
import { eventsFromTurn } from '../../src/cartographer/apply';
import { compileContext, contextSizeChars, type CartographerContext } from '../../src/cartographer/context';
import { getMockPrompt } from '../../src/cartographer/mock';
import { DEFAULT_MODEL_ID, estimateNeurons, FREE_NEURONS_PER_DAY } from '../../src/cartographer/models';
import type { AIProvider, ProviderResult } from '../../src/cartographer/provider';
import { providerFailure } from '../../src/cartographer/provider';
import { createWorkersAiProvider, type WorkersAiBinding } from '../../src/cartographer/workersai';
import { applyGameEvents, createInitialCampaign, levelForXp } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { PERSONA_FIXTURES } from '../fixtures/personas';

/**
 * A sustained campaign driven through the REAL provider pipeline —
 * compileContext, the Workers AI provider, decode, Zod, semantic validation and
 * eventsFromTurn — with a scripted binding standing in for Workers AI.
 *
 * This proves the pipeline, NOT the model. Scripted turns are not real inference
 * and do not count towards the real-provider gate.
 */

/** A scripted binding that answers any context with a schema-valid turn. */
const scriptedBinding: WorkersAiBinding = {
  async run(_model, input) {
    const context = JSON.parse((input.messages as Array<{ role: string; content: string }>)[1].content) as CartographerContext;
    const turn = {
      reply: 'Logged. That gives the map another edge to work from.',
      nextQuestion: `What does ${context.campaign.remainingDimensions[0] ?? 'that'} cost you in practice?`,
      presentation: context.presentation,
      evidence: [{
        dimension: context.task.dimension,
        claim: `Scripted reading of the ${context.task.dimension} answer.`,
        basis: 'explicit',
        strength: context.task.answer.length > 120 ? 3 : 2,
        territories: [context.task.territoryId]
      }],
      connections: [],
      quoteCandidates: [],
      summaryPatch: `Coverage advanced in ${context.task.territoryLabel}.`,
      achievementCandidates: []
    };
    return { response: JSON.stringify(turn), usage: { prompt_tokens: Math.ceil(JSON.stringify(context).length / 4), completion_tokens: 320 } };
  }
};

const ANSWERS = PERSONA_FIXTURES.map((fixture) => fixture.answer);

async function runCampaign(provider: AIProvider, turns: number) {
  let state: CampaignState = createInitialCampaign();
  const sizes: number[] = [];
  const results: ProviderResult[] = [];
  let totalNeurons = 0;

  for (let index = 0; index < turns; index += 1) {
    // Cycle territories so coverage spreads the way a real campaign would.
    const territory = state.territories[index % state.territories.length];
    state = applyGameEvents(state, [{ type: 'ACTIVE_TERRITORY_SET', territoryId: territory.id }]);
    const prompt = getMockPrompt(state);
    const answer = `${ANSWERS[index % ANSWERS.length]} (synthetic turn ${index})`;

    const context = compileContext(state, prompt, answer);
    sizes.push(contextSizeChars(context));

    const result = await provider.turn(context);
    results.push(result);
    if (result.ok) {
      totalNeurons += result.usage?.neurons ?? 0;
      state = applyGameEvents(state, eventsFromTurn(prompt, answer, result.turn, `workers-ai:${result.modelId}`));
    } else {
      // Degraded path: the answer is still recorded, exactly as the app does.
      state = applyGameEvents(state, eventsFromTurn(prompt, answer, {
        reply: '', nextQuestion: prompt.question, presentation: state.presentation,
        evidence: [], connections: [], quoteCandidates: [], summaryPatch: '', achievementCandidates: []
      }, 'mock'));
    }
  }
  return { state, sizes, results, totalNeurons };
}

describe('100-turn synthetic campaign through the provider pipeline', () => {
  it('runs 100 scripted provider turns without corrupting campaign state', async () => {
    const provider = createWorkersAiProvider({ binding: scriptedBinding });
    const { state, results } = await runCampaign(provider, 100);

    expect(results.length).toBe(100);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(state.turns.length).toBe(100);
    expect(state.turns.every((turn) => !turn.retracted)).toBe(true);
    // Deterministic invariants hold across the whole run.
    expect(state.level).toBe(levelForXp(state.xp));
    expect(state.xp).toBeGreaterThan(0);
    expect(state.campaignCompleted).toBe(false);
    expect(state.evidence.every((item) => item.origin === 'model-proposed')).toBe(true);
    expect(state.evidence.every((item) => item.providerId?.startsWith('workers-ai:'))).toBe(true);
  });

  it('keeps the compiled context bounded for the whole campaign', async () => {
    const provider = createWorkersAiProvider({ binding: scriptedBinding });
    const { sizes } = await runCampaign(provider, 100);
    const early = sizes[5];
    const late = sizes[99];
    expect(late).toBeLessThan(early * 2);
    expect(Math.max(...sizes)).toBeLessThan(20_000);
  });

  it('fits 100 turns inside the free daily allocation on the default model', async () => {
    const provider = createWorkersAiProvider({ binding: scriptedBinding });
    const { totalNeurons } = await runCampaign(provider, 100);
    expect(totalNeurons).toBeGreaterThan(0);
    expect(totalNeurons).toBeLessThan(FREE_NEURONS_PER_DAY);
  });

  it('estimates the same budget before spending anything', () => {
    // The pre-flight estimate a live run must consult before it starts.
    const perTurn = estimateNeurons(DEFAULT_MODEL_ID, 1500, 350);
    expect(perTurn * 100).toBeLessThan(FREE_NEURONS_PER_DAY);
  });
});

describe('provider failure never corrupts the campaign', () => {
  it('keeps the answer and progresses deterministically when the provider fails', async () => {
    const failing: AIProvider = { id: 'failing', turn: async () => providerFailure('quota-exhausted', 'synthetic', false) };
    const { state, results } = await runCampaign(failing, 12);

    expect(results.every((result) => !result.ok)).toBe(true);
    // Every answer survived; nothing was lost to the failure.
    expect(state.turns.length).toBe(12);
    expect(state.xp).toBeGreaterThan(0);
    expect(state.level).toBe(levelForXp(state.xp));
    expect(state.campaignCompleted).toBe(false);
  });

  it('recovers mid-campaign when the provider comes back', async () => {
    let calls = 0;
    const flaky: AIProvider = {
      id: 'flaky',
      async turn(context) {
        calls += 1;
        if (calls % 3 === 0) return providerFailure('capacity', 'synthetic', true);
        return createWorkersAiProvider({ binding: scriptedBinding }).turn(context);
      }
    };
    const { state, results } = await runCampaign(flaky, 30);

    expect(results.filter((result) => !result.ok).length).toBe(10);
    expect(state.turns.length).toBe(30);
    expect(state.level).toBe(levelForXp(state.xp));
    // Evidence exists from the successful turns and nothing from the failed ones.
    expect(state.evidence.length).toBe(20);
  });

  it('does not double-award when the same turn is retried', async () => {
    const provider = createWorkersAiProvider({ binding: scriptedBinding });
    let state = createInitialCampaign();
    const prompt = getMockPrompt(state);
    const answer = 'A synthetic answer submitted once and then retried.';

    const first = await provider.turn(compileContext(state, prompt, answer));
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    state = applyGameEvents(state, eventsFromTurn(prompt, answer, first.turn, 'p'));
    const afterFirst = state.xp;

    // The identical claim on the same dimension earns no second evidence award,
    // so the retry is worth the accepted-answer 5 and nothing more. (This answer
    // is under 80 characters, so it earns no development bonus either way.)
    const second = await provider.turn(compileContext(state, prompt, answer));
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    const retried = applyGameEvents(state, eventsFromTurn(prompt, answer, second.turn, 'p'));
    expect(retried.xp - afterFirst).toBe(5);
  });
});
