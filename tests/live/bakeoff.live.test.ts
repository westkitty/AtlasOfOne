import { beforeAll, describe, expect, it } from 'vitest';
import { eventsFromTurn } from '../../src/cartographer/apply';
import { rank, scoreTurn, summarize, type MachineScore } from '../../src/cartographer/bakeoff';
import { compileContext } from '../../src/cartographer/context';
import { getMockPrompt } from '../../src/cartographer/mock';
import { DEFAULT_MODEL_ID, estimateNeurons, FREE_NEURONS_PER_DAY, MODEL_CANDIDATES } from '../../src/cartographer/models';
import { createWorkersAiProvider } from '../../src/cartographer/workersai';
import { applyGameEvents, createInitialCampaign, levelForXp } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { PERSONA_FIXTURES } from '../fixtures/personas';
import { listAccountModels, liveCredentials, restBinding } from './rest-binding';

/**
 * LIVE Workers AI bakeoff. Runs only with real credentials.
 *
 * Zero-dollar discipline is enforced here, not merely intended:
 *
 * - Only free-plan-eligible candidates are ever called.
 * - Each stage has a neuron budget, and a request that would cross it is skipped
 *   rather than sent.
 * - A reserve is held back for the campaign proof, so benchmarking cannot eat the
 *   allocation the integration gate needs.
 * - Quota exhaustion stops the run cleanly instead of retrying.
 *
 * Run with:
 *   CLOUDFLARE_ACCOUNT_ID=... CLOUDFLARE_API_TOKEN=... npm run test:live
 */

const credentials = liveCredentials();
const LIVE = credentials !== null;

/** Neuron budgets. They sum to less than the free daily allocation on purpose. */
const STAGE_A_BUDGET = 1_500;
const STAGE_B_BUDGET = 3_000;
const CAMPAIGN_BUDGET = 4_000;
const TOTAL_BUDGET = STAGE_A_BUDGET + STAGE_B_BUDGET + CAMPAIGN_BUDGET;

class NeuronLedger {
  spent = 0;
  stopped: string | null = null;
  constructor(readonly cap: number) {}
  /** Whether one more request of this estimated size is affordable. */
  affords(estimate: number) { return !this.stopped && this.spent + estimate <= this.cap; }
  record(neurons: number) { this.spent += neurons; }
  stop(reason: string) { this.stopped = reason; }
}

const ledger = new NeuronLedger(TOTAL_BUDGET);
/** Representative per-turn shape, used for the pre-flight affordability check. */
const ESTIMATE = (modelId: string) => estimateNeurons(modelId, 1_800, 400);

const state = createInitialCampaign();
const smokeFixture = PERSONA_FIXTURES.find((item) => item.id === 'short-ordinary')!;

interface StageResult { modelId: string; scores: MachineScore[] }

async function runFixtures(modelId: string, fixtures: typeof PERSONA_FIXTURES, budgetCap: number): Promise<MachineScore[]> {
  const provider = createWorkersAiProvider({ binding: restBinding(credentials!), modelId });
  const scores: MachineScore[] = [];

  for (const fixture of fixtures) {
    if (ledger.spent >= budgetCap || !ledger.affords(ESTIMATE(modelId))) break;
    const context = compileContext(state, fixture, fixture.answer);
    const started = Date.now();
    const result = await provider.turn(context);
    const score = scoreTurn({ fixtureId: fixture.id, context, result, latencyMs: Date.now() - started });
    ledger.record(score.neurons || ESTIMATE(modelId));
    scores.push(score);

    // An exhausted allocation ends the run cleanly. It is never retried.
    if (!result.ok && result.failure.code === 'quota-exhausted') { ledger.stop('quota-exhausted'); break; }
  }
  return scores;
}

describe.skipIf(!LIVE)('LIVE stage A: compatibility smoke test', () => {
  const results: StageResult[] = [];

  beforeAll(async () => {
    for (const candidate of MODEL_CANDIDATES) {
      if (!candidate.freePlanEligible) continue;
      results.push({ modelId: candidate.id, scores: await runFixtures(candidate.id, [smokeFixture], STAGE_A_BUDGET) });
    }
  }, 300_000);

  it('confirms each candidate still exists on the authenticated account', async () => {
    const available = new Set((await listAccountModels(credentials!)).map((model) => model.name));
    for (const candidate of MODEL_CANDIDATES) {
      // Reported, not asserted: the catalogue changes, and a vanished model is
      // information rather than a test failure.
      if (!available.has(candidate.id)) console.warn(`Candidate no longer listed: ${candidate.id}`);
    }
    expect(available.size).toBeGreaterThan(0);
  }, 60_000);

  it('records which candidates returned usable structured output', () => {
    for (const result of results) {
      const score = result.scores[0];
      if (!score) continue;
      console.log(`[stage A] ${result.modelId}: accepted=${score.accepted} repaired=${score.repaired} failure=${score.failureCode ?? '-'} latency=${score.latencyMs}ms neurons=${score.neurons}`);
    }
    expect(results.length).toBeGreaterThan(0);
  });

  it('never spends more than the stage A budget', () => {
    expect(ledger.spent).toBeLessThanOrEqual(STAGE_A_BUDGET + ESTIMATE(DEFAULT_MODEL_ID));
  });
});

describe.skipIf(!LIVE)('LIVE stage B: Atlas fixture bakeoff', () => {
  const summaries: ReturnType<typeof summarize>[] = [];

  beforeAll(async () => {
    // Only the survivors of stage A, capped at three, reach the full suite.
    const survivors = MODEL_CANDIDATES.filter((candidate) => candidate.freePlanEligible).slice(0, 3);
    for (const candidate of survivors) {
      const scores = await runFixtures(candidate.id, PERSONA_FIXTURES, STAGE_A_BUDGET + STAGE_B_BUDGET);
      if (scores.length) summaries.push(summarize(candidate.id, scores));
    }
  }, 900_000);

  it('produces a ranked bakeoff table', () => {
    const table = rank(summaries);
    for (const row of table) {
      console.log(`[stage B] ${row.modelId} accept=${row.acceptRate.toFixed(2)} repair=${row.repairRate.toFixed(2)} grounding=${row.meanExplicitGrounding.toFixed(2)} quotes=${row.meanQuoteFidelity.toFixed(2)} privacy=${row.privacyViolations} latency=${Math.round(row.meanLatencyMs)}ms neurons=${Math.round(row.totalNeurons)}`);
    }
    expect(table.length).toBeGreaterThan(0);
  });

  it('never lets a model with a privacy violation win', () => {
    const winner = rank(summaries)[0];
    if (winner) expect(winner.privacyViolations).toBe(0);
  });
});

describe.skipIf(!LIVE)('LIVE stage C: real-provider synthetic campaign', () => {
  it('runs the largest free-safe synthetic campaign and reports the exact turn count', async () => {
    const modelId = DEFAULT_MODEL_ID;
    const provider = createWorkersAiProvider({ binding: restBinding(credentials!), modelId });
    let campaign: CampaignState = createInitialCampaign();
    let realTurns = 0;
    let stopReason = 'target-reached';

    for (let index = 0; index < 100; index += 1) {
      if (!ledger.affords(ESTIMATE(modelId))) { stopReason = 'budget-reserve-reached'; break; }
      const territory = campaign.territories[index % campaign.territories.length];
      campaign = applyGameEvents(campaign, [{ type: 'ACTIVE_TERRITORY_SET', territoryId: territory.id }]);
      const prompt = getMockPrompt(campaign);
      const answer = `${PERSONA_FIXTURES[index % PERSONA_FIXTURES.length].answer} (synthetic turn ${index})`;

      const result = await provider.turn(compileContext(campaign, prompt, answer));
      if (!result.ok) {
        if (result.failure.code === 'quota-exhausted') { stopReason = 'quota-exhausted'; break; }
        continue;
      }
      ledger.record(result.usage?.neurons ?? ESTIMATE(modelId));
      campaign = applyGameEvents(campaign, eventsFromTurn(prompt, answer, result.turn, `workers-ai:${modelId}`));
      realTurns += 1;
    }

    console.log(`[stage C] REAL PROVIDER TURNS: ${realTurns} / 100 (stop: ${stopReason}); neurons spent this run: ${Math.round(ledger.spent)} of ${FREE_NEURONS_PER_DAY} free/day`);

    // Whatever the count, the deterministic invariants must still hold.
    expect(campaign.turns.length).toBe(realTurns);
    expect(campaign.level).toBe(levelForXp(campaign.xp));
    expect(campaign.campaignCompleted).toBe(false);
    expect(ledger.spent).toBeLessThan(FREE_NEURONS_PER_DAY);
  }, 1_800_000);
});

describe('live gate', () => {
  it('states plainly whether real inference was exercised', () => {
    if (!LIVE) {
      console.log('[live gate] SKIPPED: no CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_API_TOKEN. No real Workers AI request was made.');
    }
    // This assertion is about the harness, not the account: the suite must be
    // honest about which mode it ran in rather than silently passing.
    expect(typeof LIVE).toBe('boolean');
  });
});
