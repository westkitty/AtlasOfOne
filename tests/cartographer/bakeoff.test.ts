import { describe, expect, it } from 'vitest';
import { lexicalGrounding, rank, scoreTurn, summarize, type MachineScore } from '../../src/cartographer/bakeoff';
import { compileContext } from '../../src/cartographer/context';
import { providerFailure, type ProviderResult } from '../../src/cartographer/provider';
import type { CartographerTurn } from '../../src/cartographer/schema';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import { PERSONA_FIXTURES } from '../fixtures/personas';

const state = createInitialCampaign();
const uncertainty = PERSONA_FIXTURES.find((item) => item.id === 'uncertainty')!;
const context = compileContext(state, uncertainty, uncertainty.answer);

const turn = (overrides: Partial<CartographerTurn> = {}): CartographerTurn => ({
  reply: 'That reads as genuinely unsettled rather than evasive.',
  nextQuestion: 'What tends to tip it towards moving rather than stalling?',
  presentation: 'normal',
  evidence: [{ dimension: 'uncertainty', claim: 'Does not know what decides between moving and stalling.', basis: 'explicit', strength: 2, territories: ['cognition'] }],
  connections: [],
  quoteCandidates: [],
  summaryPatch: '',
  achievementCandidates: [],
  ...overrides
});

const ok = (t: CartographerTurn): ProviderResult => ({ ok: true, turn: t, modelId: 'test-model', repaired: false, usage: { inputTokens: 1200, outputTokens: 300, neurons: 19 } });

describe('bakeoff fixture suite', () => {
  it('covers every Atlas-specific behaviour the bakeoff must exercise', () => {
    const focuses = new Set(PERSONA_FIXTURES.map((item) => item.focus));
    for (const required of ['short', 'long-nuanced', 'uncertainty', 'contradiction', 'revision', 'values', 'political', 'relationships', 'cognition', 'interests', 'fears', 'future', 'ambiguous', 'cross-territory', 'boss', 'door', 'adversarial', 'malformed']) {
      expect(focuses, required).toContain(required);
    }
  });

  it('contains only synthetic material', () => {
    // A guard against a future edit pasting real campaign content in here.
    const text = JSON.stringify(PERSONA_FIXTURES);
    expect(text).not.toMatch(/greyson/i);
    expect(PERSONA_FIXTURES.every((item) => item.expectation.length > 20)).toBe(true);
  });
});

describe('machine scoring', () => {
  it('measures lexical grounding of a claim against the answer', () => {
    expect(lexicalGrounding('moving and stalling', uncertainty.answer)).toBeGreaterThan(0.5);
    expect(lexicalGrounding('decisive confident commanding general', uncertainty.answer)).toBeLessThan(0.3);
  });

  it('scores a clean turn well', () => {
    const score = scoreTurn({ fixtureId: 'uncertainty', context, result: ok(turn()), latencyMs: 800 });
    expect(score.accepted).toBe(true);
    expect(score.privacyViolation).toBe(false);
    expect(score.uncertaintyPreserved).toBe(true);
    expect(score.explicitClaimGrounding).toBeGreaterThan(0.4);
    expect(score.neurons).toBe(19);
  });

  it('flags a turn that resolves the player uncertainty away', () => {
    const decisive = turn({
      reply: 'You are a decisive person who acts fast.',
      evidence: [{ dimension: 'uncertainty', claim: 'Acts fast under pressure without hesitation.', basis: 'explicit', strength: 3, territories: ['cognition'] }]
    });
    const score = scoreTurn({ fixtureId: 'uncertainty', context, result: ok(decisive), latencyMs: 800 });
    expect(score.uncertaintyPreserved).toBe(false);
    expect(score.explicitClaimGrounding).toBeLessThan(0.4);
  });

  it('flags an invented quote', () => {
    const score = scoreTurn({ fixtureId: 'uncertainty', context, result: ok(turn({ quoteCandidates: ['a sentence never written'] })), latencyMs: 10 });
    expect(score.quoteFidelity).toBe(0);
  });

  it('flags a privacy violation', () => {
    let closed = createInitialCampaign();
    closed = applyGameEvents(closed, [{ type: 'PRIVATE_TOPIC_ADDED', topic: 'fears' }]);
    const retiredContext = compileContext(closed, uncertainty, uncertainty.answer);
    const score = scoreTurn({ fixtureId: 'private', context: retiredContext, result: ok(turn({ reply: 'Tell me about your fears.' })), latencyMs: 10 });
    expect(score.privacyViolation).toBe(true);
  });

  it('counts progression fields present in the raw payload', () => {
    const score = scoreTurn({ fixtureId: 'adversarial', context, result: ok(turn()), latencyMs: 10, raw: { ...turn(), xp: 100, campaignCompleted: true } });
    expect(score.authorityFieldsSeen).toBe(2);
  });

  it('records a failure without pretending it succeeded', () => {
    const score = scoreTurn({ fixtureId: 'x', context, result: providerFailure('quota-exhausted', 'synthetic'), latencyMs: 5 });
    expect(score.accepted).toBe(false);
    expect(score.failureCode).toBe('quota-exhausted');
    expect(score.neurons).toBe(0);
  });

  it('detects a repeated question', () => {
    let repeated = createInitialCampaign();
    const asked = 'What tends to tip it towards moving rather than stalling?';
    repeated = { ...repeated, turns: [{ id: 't1', createdAt: '', territoryId: 'cognition', dimension: 'uncertainty', question: asked, answer: 'a', substantive: true, behavioralExample: false, revision: false, retracted: false }] };
    const repeatContext = compileContext(repeated, uncertainty, uncertainty.answer);
    const score = scoreTurn({ fixtureId: 'x', context: repeatContext, result: ok(turn({ nextQuestion: asked })), latencyMs: 5 });
    expect(score.repeatsRecentQuestion).toBe(true);
  });
});

describe('summary and ranking', () => {
  const base: MachineScore = {
    fixtureId: 'f', modelId: 'a', accepted: true, repaired: false, latencyMs: 500,
    inputTokens: 1000, outputTokens: 300, neurons: 20, authorityFieldsSeen: 0,
    privacyViolation: false, quoteFidelity: 1, explicitClaimGrounding: 0.8,
    inferenceRatio: 0.2, uncertaintyPreserved: true, repeatsRecentQuestion: false,
    evidenceCount: 2, replyChars: 60
  };

  it('aggregates rates and failure codes', () => {
    const summary = summarize('a', [base, { ...base, accepted: false, failureCode: 'timeout' }, { ...base, repaired: true }]);
    expect(summary.runs).toBe(3);
    expect(summary.acceptRate).toBeCloseTo(2 / 3);
    expect(summary.repairRate).toBeCloseTo(1 / 3);
    expect(summary.failureCodes.timeout).toBe(1);
    expect(summary.totalNeurons).toBe(60);
  });

  it('disqualifies any model with a privacy violation, however good otherwise', () => {
    const clean = summarize('clean', [{ ...base, explicitClaimGrounding: 0.5 }]);
    const leaky = summarize('leaky', [{ ...base, modelId: 'leaky', explicitClaimGrounding: 1, quoteFidelity: 1, privacyViolation: true }]);
    expect(rank([leaky, clean])[0].modelId).toBe('clean');
  });

  it('prefers evidence fidelity over everything that is not privacy', () => {
    const grounded = summarize('grounded', [{ ...base, explicitClaimGrounding: 0.95 }]);
    const fast = summarize('fast', [{ ...base, explicitClaimGrounding: 0.3, latencyMs: 10, neurons: 1 }]);
    expect(rank([fast, grounded])[0].modelId).toBe('grounded');
  });
});
