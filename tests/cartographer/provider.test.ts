import { describe, expect, it } from 'vitest';
import { compileContext } from '../../src/cartographer/context';
import { DEFAULT_MODEL_ID, estimateNeurons, EXCLUDED_MODELS, eligibleCandidates, findCandidate, FREE_NEURONS_PER_DAY, freeTurnsPerDay, MODEL_CANDIDATES } from '../../src/cartographer/models';
import { disabledProvider, playerMessageForFailure } from '../../src/cartographer/provider';
import { classifyProviderError, createWorkersAiProvider, MAX_REPAIR_ATTEMPTS, type WorkersAiBinding } from '../../src/cartographer/workersai';
import { createInitialCampaign } from '../../src/game/engine';

const state = createInitialCampaign();
const task = { territoryId: 'identity', dimension: 'self-description', question: 'Synthetic question?' };
const context = compileContext(state, task, 'Curious, mostly patient, bad at pretending to agree.');

const validTurn = {
  reply: 'Noted. That reads as a preference for friction over false agreement.',
  nextQuestion: 'What does patience cost you when it runs out?',
  presentation: 'normal',
  evidence: [{ dimension: 'self-description', claim: 'Prefers open disagreement.', basis: 'explicit', strength: 2, territories: ['identity'] }],
  connections: [],
  quoteCandidates: [],
  summaryPatch: 'Identity coverage advanced.',
  achievementCandidates: []
};

/** A scripted Workers AI binding. Each call shifts one response off the queue. */
function scriptedBinding(responses: unknown[]): WorkersAiBinding & { calls: number } {
  const binding = {
    calls: 0,
    async run() {
      const next = responses[binding.calls];
      binding.calls += 1;
      if (next instanceof Error) throw next;
      return next;
    }
  };
  return binding;
}

describe('disabled provider', () => {
  it('always fails with a typed, player-safe message', async () => {
    const result = await disabledProvider.turn(context);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('provider-disabled');
    expect(playerMessageForFailure('provider-disabled')).not.toMatch(/binding|schema|worker|model|http/i);
  });
});

describe('Workers AI provider: success path', () => {
  it('accepts a clean structured response and reports usage', async () => {
    const binding = scriptedBinding([{ response: JSON.stringify(validTurn), usage: { prompt_tokens: 1500, completion_tokens: 350 } }]);
    const result = await createWorkersAiProvider({ binding }).turn(context);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.repaired).toBe(false);
    expect(result.turn.reply).toBe(validTurn.reply);
    expect(result.usage?.neurons).toBeGreaterThan(0);
    expect(binding.calls).toBe(1);
  });

  it('accepts a response already decoded into an object', async () => {
    const binding = scriptedBinding([{ response: validTurn }]);
    const result = await createWorkersAiProvider({ binding }).turn(context);
    expect(result.ok).toBe(true);
  });
});

describe('Workers AI provider: bounded repair', () => {
  it('repairs malformed structure exactly once and succeeds', async () => {
    const binding = scriptedBinding([
      { response: 'Sure! Here is my analysis, in prose, with no JSON at all.' },
      { response: JSON.stringify(validTurn) }
    ]);
    const result = await createWorkersAiProvider({ binding }).turn(context);

    expect(result.ok).toBe(true);
    expect(result.ok && result.repaired).toBe(true);
    expect(binding.calls).toBe(2);
  });

  it('never attempts a second repair', async () => {
    const binding = scriptedBinding([
      { response: 'Still no JSON here.' },
      { response: 'And none here either.' },
      { response: JSON.stringify(validTurn) }
    ]);
    const result = await createWorkersAiProvider({ binding }).turn(context);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('repair-failed');
    // One original call plus exactly one repair. The third scripted response is
    // never reached, which is the bound.
    expect(binding.calls).toBe(1 + MAX_REPAIR_ATTEMPTS);
  });

  it('sums usage across the original call and the repair', async () => {
    const binding = scriptedBinding([
      { response: 'no json', usage: { prompt_tokens: 1000, completion_tokens: 50 } },
      { response: JSON.stringify(validTurn), usage: { prompt_tokens: 1200, completion_tokens: 300 } }
    ]);
    const result = await createWorkersAiProvider({ binding }).turn(context);
    expect(result.ok && result.usage?.inputTokens).toBe(2200);
    expect(result.ok && result.usage?.outputTokens).toBe(350);
  });

  it('refuses to repair a semantic violation', async () => {
    const overstep = { ...validTurn, reply: 'Great work, that is +10 XP.' };
    const binding = scriptedBinding([{ response: JSON.stringify(overstep) }, { response: JSON.stringify(validTurn) }]);
    const result = await createWorkersAiProvider({ binding }).turn(context);

    expect(result.ok).toBe(false);
    expect(!result.ok && result.failure.code).toBe('semantic-invalid');
    // A model that overstepped is not asked to try again with the same context.
    expect(binding.calls).toBe(1);
  });
});

describe('Workers AI provider: failure states', () => {
  it('maps thrown errors onto typed failures', () => {
    const cases: Array<[string, string]> = [
      ['Request timed out after 20000ms', 'timeout'],
      ['Daily neuron allocation exhausted', 'quota-exhausted'],
      ['429 Too Many Requests', 'rate-limited'],
      ['Model is at capacity', 'capacity'],
      ['No such model: @cf/nope', 'model-unavailable'],
      ['401 Unauthorized', 'not-configured'],
      ['socket hang up', 'network']
    ];
    for (const [message, code] of cases) {
      const result = classifyProviderError(new Error(message));
      expect(!result.ok && result.failure.code, message).toBe(code);
    }
  });

  it('treats an exhausted allocation as non-retryable', () => {
    const result = classifyProviderError(new Error('daily limit reached for neurons'));
    expect(!result.ok && result.failure.code).toBe('quota-exhausted');
    // Retrying an exhausted allocation would only spend the next day's budget.
    expect(!result.ok && result.failure.retryable).toBe(false);
  });

  it('surfaces a thrown binding error rather than a crash', async () => {
    const binding = scriptedBinding([new Error('429 Too Many Requests')]);
    const result = await createWorkersAiProvider({ binding }).turn(context);
    expect(!result.ok && result.failure.code).toBe('rate-limited');
    expect(!result.ok && result.failure.retryable).toBe(true);
  });

  it('times out rather than hanging', async () => {
    const binding: WorkersAiBinding = { run: () => new Promise(() => {}) };
    const result = await createWorkersAiProvider({ binding, timeoutMs: 20 }).turn(context);
    expect(!result.ok && result.failure.code).toBe('timeout');
  });

  it('refuses a model that is not in the eligible registry', async () => {
    const binding = scriptedBinding([{ response: JSON.stringify(validTurn) }]);
    const result = await createWorkersAiProvider({ binding, modelId: '@cf/some/unlisted-model' }).turn(context);
    expect(!result.ok && result.failure.code).toBe('not-configured');
    // Refused before any request exists, so a misconfiguration cannot create cost.
    expect(binding.calls).toBe(0);
  });

  it('has player-facing copy for every failure code, free of backend jargon', () => {
    const codes = ['provider-disabled', 'binding-missing', 'not-configured', 'model-unavailable', 'quota-exhausted', 'rate-limited', 'capacity', 'timeout', 'network', 'malformed-output', 'semantic-invalid', 'repair-failed', 'unauthorized'] as const;
    for (const code of codes) {
      const message = playerMessageForFailure(code);
      expect(message.length, code).toBeGreaterThan(10);
      expect(message, code).not.toMatch(/binding|zod|schema|http|429|json|neuron|worker|@cf\//i);
    }
  });
});

describe('zero-dollar model registry', () => {
  it('offers only free-plan-eligible candidates', () => {
    expect(eligibleCandidates().length).toBe(MODEL_CANDIDATES.length);
    expect(MODEL_CANDIDATES.every((candidate) => candidate.freePlanEligible)).toBe(true);
  });

  it('keeps paid-only models out of the candidate set entirely', () => {
    const candidateIds = new Set(MODEL_CANDIDATES.map((item) => item.id));
    for (const excluded of EXCLUDED_MODELS) expect(candidateIds.has(excluded.id)).toBe(false);
  });

  it('has a default that is itself an eligible candidate', () => {
    const candidate = findCandidate(DEFAULT_MODEL_ID);
    expect(candidate).toBeDefined();
    expect(candidate!.freePlanEligible).toBe(true);
  });

  it('estimates a 100-turn campaign against the free daily allocation', () => {
    // A representative Atlas turn: a compiled context in, one structured turn out.
    const IN = 1500;
    const OUT = 350;
    const budget = MODEL_CANDIDATES.map((candidate) => ({
      id: candidate.id,
      neurons: estimateNeurons(candidate.id, IN, OUT),
      turns: freeTurnsPerDay(candidate.id, IN, OUT)
    }));

    // Every estimate must be real, and the default must afford 100 turns free.
    for (const row of budget) expect(row.neurons).toBeGreaterThan(0);
    expect(budget.find((row) => row.id === DEFAULT_MODEL_ID)!.turns).toBeGreaterThanOrEqual(100);

    // Nemotron is documented as eligible but cannot afford a 100-turn campaign,
    // which is exactly why free-allocation efficiency is a selection criterion.
    expect(budget.find((row) => row.id === '@cf/nvidia/nemotron-3-120b-a12b')!.turns).toBeLessThan(100);
  });

  it('derives neurons from the published rate', () => {
    // 1M input tokens on a $0.10/M model at $0.011 per 1,000 neurons.
    expect(estimateNeurons('@cf/google/gemma-4-26b-a4b-it', 1_000_000, 0)).toBeCloseTo(9090.91, 1);
    expect(FREE_NEURONS_PER_DAY).toBe(10_000);
  });
});
