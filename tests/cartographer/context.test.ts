import { describe, expect, it } from 'vitest';
import { compileContext, CONTEXT_BUDGET, contextSizeChars, contextTextFragments } from '../../src/cartographer/context';
import { createMockTurn, recordsFromMockTurn, type MockPrompt } from '../../src/cartographer/mock';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, GameEvent } from '../../src/game/types';
import { PRIVATE_FIXTURE } from '../fixtures/personas';
import { syntheticDevelopedAnswer } from '../fixtures/synthetic';

/** Answer one named dimension directly, bypassing the mock's own selection order. */
function answerDimension(state: CampaignState, territoryId: string, dimension: string, answer: string): CampaignState {
  const territory = state.territories.find((item) => item.id === territoryId)!;
  const prompt: MockPrompt = {
    id: `prompt_${territoryId}_${dimension}`,
    territoryId,
    territoryLabel: territory.label,
    dimension,
    question: `Synthetic question about ${dimension}?`
  };
  const records = recordsFromMockTurn(prompt, answer, createMockTurn(state, prompt, answer));
  const events: GameEvent[] = [
    { type: 'ANSWER_ACCEPTED', turn: records.turnRecord },
    ...records.evidence.map((evidence) => ({ type: 'EVIDENCE_ADDED', evidence }) as GameEvent)
  ];
  if (records.insight) events.push({ type: 'INSIGHT_ADDED', insight: records.insight });
  return applyGameEvents(state, events);
}

const task = { territoryId: 'identity', dimension: 'self-description', question: 'Synthetic current question?' };

describe('context compiler: PRIVATE exclusion', () => {
  it('never places private content in the outgoing payload', () => {
    let state = createInitialCampaign();
    state = answerDimension(state, PRIVATE_FIXTURE.territoryId, PRIVATE_FIXTURE.dimension, PRIVATE_FIXTURE.answer);
    // The answer exists locally before it is closed off.
    expect(JSON.stringify(state)).toContain(PRIVATE_FIXTURE.canary);

    state = applyGameEvents(state, [{ type: 'PRIVATE_TOPIC_ADDED', topic: PRIVATE_FIXTURE.dimension }]);
    const context = compileContext(state, task, 'A synthetic ordinary answer.');

    // The whole serialized payload, not just the fields we remembered to check.
    expect(JSON.stringify(context)).not.toContain(PRIVATE_FIXTURE.canary);
  });

  it('excludes the private dimension from every evidence and continuity slot', () => {
    let state = createInitialCampaign();
    state = answerDimension(state, 'fears', 'boundaries', PRIVATE_FIXTURE.answer);
    state = applyGameEvents(state, [{ type: 'PRIVATE_TOPIC_ADDED', topic: 'boundaries' }]);
    const context = compileContext(state, task, 'Synthetic answer.');

    expect(context.relevantEvidence.some((item) => item.dimension === 'boundaries')).toBe(false);
    expect(context.counterEvidence.some((item) => item.dimension === 'boundaries')).toBe(false);
    expect(context.revisions.some((item) => item.dimension === 'boundaries')).toBe(false);
    expect(context.recentTurns.some((item) => item.dimension === 'boundaries')).toBe(false);
    expect(context.campaign.coveredDimensions).not.toContain('boundaries');
    expect(context.campaign.remainingDimensions).not.toContain('boundaries');
  });

  it('still names the retired dimension so the model knows what not to ask', () => {
    let state = createInitialCampaign();
    state = answerDimension(state, 'fears', 'boundaries', PRIVATE_FIXTURE.answer);
    state = applyGameEvents(state, [{ type: 'PRIVATE_TOPIC_ADDED', topic: 'boundaries' }]);
    const context = compileContext(state, task, 'Synthetic answer.');

    // The label travels; the content behind it does not.
    expect(context.retiredDimensions).toContain('boundaries');
    expect(contextTextFragments(context).join(' ')).not.toContain(PRIVATE_FIXTURE.canary);
  });

  it('withholds an insight whose evidence has become private', () => {
    let state = createInitialCampaign();
    state = answerDimension(state, 'fears', 'boundaries', PRIVATE_FIXTURE.answer);
    const insight = state.insights.at(-1)!;
    state = applyGameEvents(state, [{ type: 'INSIGHT_CONFIRMED', insightId: insight.id }]);
    expect(compileContext(state, task, 'x').confirmedInsights.length).toBe(1);

    state = applyGameEvents(state, [{ type: 'PRIVATE_TOPIC_ADDED', topic: 'boundaries' }]);
    expect(compileContext(state, task, 'x').confirmedInsights.length).toBe(0);
  });

  it('excludes retracted material for the same reason', () => {
    let state = createInitialCampaign();
    state = answerDimension(state, 'identity', 'temperament', 'SYNTHETICRETRACTEDCANARY answer text.');
    const turn = state.turns.at(-1)!;
    state = applyGameEvents(state, [{ type: 'ANSWER_RETRACTED', turnId: turn.id }]);
    expect(JSON.stringify(compileContext(state, task, 'x'))).not.toContain('SYNTHETICRETRACTEDCANARY');
  });
});

describe('context compiler: boundedness', () => {
  /** Drive a long campaign without relying on mock selection order. */
  function longCampaign(turns: number): CampaignState {
    let state = createInitialCampaign();
    const territories = state.territories.map((item) => ({ id: item.id, dimensions: item.requiredDimensions }));
    for (let index = 0; index < turns; index += 1) {
      const territory = territories[index % territories.length];
      const dimension = territory.dimensions[index % territory.dimensions.length];
      state = answerDimension(state, territory.id, dimension, `${syntheticDevelopedAnswer} Turn ${index}.`);
    }
    return state;
  }

  it('does not grow linearly with transcript length', () => {
    const short = compileContext(longCampaign(20), task, syntheticDevelopedAnswer);
    const long = compileContext(longCampaign(300), task, syntheticDevelopedAnswer);

    const shortSize = contextSizeChars(short);
    const longSize = contextSizeChars(long);

    // 15x the turns must not produce anything close to 15x the payload.
    expect(longSize).toBeLessThan(shortSize * 1.5);
    expect(long.recentTurns.length).toBeLessThanOrEqual(CONTEXT_BUDGET.recentTurns);
    expect(long.relevantEvidence.length).toBeLessThanOrEqual(CONTEXT_BUDGET.relevantEvidence);
  });

  it('stays under an absolute ceiling even at 600 turns', () => {
    const context = compileContext(longCampaign(600), task, syntheticDevelopedAnswer);
    // Well inside the smallest eligible model's 32k-token window.
    expect(contextSizeChars(context)).toBeLessThan(20_000);
  });

  it('caps recalled answers but never truncates the current one below the budget', () => {
    let state = createInitialCampaign();
    const longAnswer = `A${'b'.repeat(2000)}`;
    state = answerDimension(state, 'identity', 'temperament', longAnswer);
    const context = compileContext(state, task, longAnswer);

    expect(context.recentTurns[0].answer.length).toBeLessThanOrEqual(CONTEXT_BUDGET.recalledAnswerChars + 1);
    expect(context.recentTurns[0].truncated).toBe(true);
    expect(context.task.answer.length).toBe(longAnswer.length);
    expect(context.task.answerTruncated).toBe(false);
  });

  it('clips an answer that exceeds the hard cap', () => {
    const state = createInitialCampaign();
    const huge = 'z'.repeat(CONTEXT_BUDGET.answerChars + 500);
    const context = compileContext(state, task, huge);
    expect(context.task.answerTruncated).toBe(true);
    expect(context.task.answer.length).toBeLessThanOrEqual(CONTEXT_BUDGET.answerChars + 1);
  });
});

describe('context compiler: selection and carried state', () => {
  it('puts evidence on the current dimension first', () => {
    let state = createInitialCampaign();
    state = answerDimension(state, 'values', 'loyalty', 'Synthetic loyalty answer.');
    state = answerDimension(state, 'identity', 'self-description', 'Synthetic identity answer.');
    const context = compileContext(state, task, 'Current answer.');
    expect(context.relevantEvidence[0].dimension).toBe('self-description');
  });

  it('carries presentation, sass, session and encounter state', () => {
    let state = createInitialCampaign();
    state = applyGameEvents(state, [
      { type: 'PRESENTATION_SET', mode: 'quiet' },
      { type: 'SASS_SET', sass: 'risks-understood' },
      { type: 'SESSION_SET', status: 'paused' }
    ]);
    const context = compileContext(state, task, 'x', {
      kind: 'boss-stage',
      encounter: { kind: 'boss', heading: 'The Tribunal of Values', step: 'Stage 1 of 3', evidenceClaims: ['Synthetic claim.'] }
    });
    expect(context.presentation).toBe('quiet');
    expect(context.sass).toBe('risks-understood');
    expect(context.sessionStatus).toBe('paused');
    expect(context.task.kind).toBe('boss-stage');
    expect(context.encounter?.evidenceClaims).toEqual(['Synthetic claim.']);
  });

  it('is deterministic for identical state', () => {
    const state = createInitialCampaign();
    expect(JSON.stringify(compileContext(state, task, 'x'))).toBe(JSON.stringify(compileContext(state, task, 'x')));
  });
});
