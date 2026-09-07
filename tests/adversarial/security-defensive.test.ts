import { describe, expect, it } from 'vitest';
import worker from '../../worker/index';
import { compileContext } from '../../src/cartographer/context';
import { createInitialCampaign, applyGameEvents } from '../../src/game/engine';
import { eventsFromTurn } from '../../src/cartographer/apply';
import { cartographerTurnSchema } from '../../src/cartographer/schema';
import type { TurnRecord } from '../../src/game/types';

describe('Phase 5 Adversarial QA: Security & Defensive Boundaries', () => {
  const envWithSecret = {
    ATLAS_ACCESS_SECRET: 'super-secret-key-123'
  };

  it('rejects /api/turn with 401 when ATLAS_ACCESS_SECRET is configured and missing', async () => {
    const request = new Request('https://atlas.local/api/turn', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });
    const response = await worker.fetch(request, envWithSecret);
    expect(response.status).toBe(401);
  });

  it('rejects /api/turn with 401 when ATLAS_ACCESS_SECRET is incorrect', async () => {
    const request = new Request('https://atlas.local/api/turn', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-atlas-access-secret': 'wrong-secret'
      },
      body: JSON.stringify({})
    });
    const response = await worker.fetch(request, envWithSecret);
    expect(response.status).toBe(401);
  });

  it('accepts /api/turn with valid authorization header or secret header', async () => {
    const request = new Request('https://atlas.local/api/turn', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: 'Bearer super-secret-key-123'
      },
      body: JSON.stringify({}) // Bad request because body is empty context, but auth passed!
    });
    const response = await worker.fetch(request, envWithSecret);
    // Should be 400 bad-request, NOT 401 unauthorized!
    expect(response.status).toBe(400);
  });

  it('BUG-005: rejects oversized body without Content-Length header with 413 Payload Too Large', async () => {
    const hugeData = {
      padding: 'x'.repeat(70_000)
    };
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(JSON.stringify(hugeData)));
        controller.close();
      }
    });

    const request = new Request('https://atlas.local/api/turn', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: stream,
      // @ts-ignore
      duplex: 'half'
    });

    const response = await worker.fetch(request, {});
    expect(response.status).toBe(413);
  });

  it('strips forged progression fields from model output and grants zero engine authority', () => {
    const forgedModelOutput = {
      reply: 'You have done great work.',
      nextQuestion: 'What comes next?',
      presentation: 'normal',
      evidence: [],
      connections: [],
      quoteCandidates: [],
      summaryPatch: '',
      achievementCandidates: [],
      // Forged injection attempts:
      xp: 999999,
      level: 8,
      unlocks: ['all_unlocked'],
      campaignCompleted: true
    };

    // 1. Zod schema strips unknown fields
    const parsed = cartographerTurnSchema.parse(forgedModelOutput);
    expect(parsed).not.toHaveProperty('xp');
    expect(parsed).not.toHaveProperty('level');
    expect(parsed).not.toHaveProperty('campaignCompleted');

    // 2. eventsFromTurn produces ONLY allowed event types
    const state = createInitialCampaign();
    const prompt = { territoryId: 'identity', dimension: 'self', question: 'Test' };
    const events = eventsFromTurn(prompt, 'Test answer', parsed, 'mock');
    for (const ev of events) {
      expect(['ANSWER_ACCEPTED', 'EVIDENCE_ADDED', 'INSIGHT_ADDED']).toContain(ev.type);
    }
  });

  it('CANARY: private topic answer content is NEVER included in compiled context payload', () => {
    let state = createInitialCampaign();
    const canaryPrivateText = 'CANARY_ULTRA_CONFIDENTIAL_SECRET_12345';
    const privateDimension = 'private_dim_x';

    const turn: TurnRecord = {
      id: 'turn_private_canary',
      createdAt: new Date().toISOString(),
      territoryId: 'identity',
      dimension: privateDimension,
      question: 'Confidential topic?',
      answer: canaryPrivateText,
      substantive: true,
      behavioralExample: false,
      revision: false,
      retracted: false
    };

    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn },
      { type: 'PRIVATE_TOPIC_ADDED', topic: privateDimension }
    ]);

    const compiled = compileContext(state, { territoryId: 'values', dimension: 'fairness', question: 'Next question?' }, 'Latest answer');
    const compiledJson = JSON.stringify(compiled);

    // The private content must NOT appear anywhere in the outgoing payload
    expect(compiledJson).not.toContain(canaryPrivateText);
    // Only the dimension label may travel in retiredDimensions
    expect(compiled.retiredDimensions).toContain(privateDimension);
  });

  it('CANARY: retracted turn content is NEVER included in compiled context payload', () => {
    let state = createInitialCampaign();
    const canaryRetractedText = 'CANARY_RETRACTED_ANSWER_98765';

    const turn: TurnRecord = {
      id: 'turn_retracted_canary',
      createdAt: new Date().toISOString(),
      territoryId: 'identity',
      dimension: 'self',
      question: 'Question?',
      answer: canaryRetractedText,
      substantive: true,
      behavioralExample: false,
      revision: false,
      retracted: false
    };

    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn },
      { type: 'ANSWER_RETRACTED', turnId: 'turn_retracted_canary' }
    ]);

    const compiled = compileContext(state, { territoryId: 'identity', dimension: 'self', question: 'New question?' }, 'Latest answer');
    const compiledJson = JSON.stringify(compiled);

    expect(compiledJson).not.toContain(canaryRetractedText);
  });

  it('handles XSS and script injection safely without execution or corrupting engine state', () => {
    let state = createInitialCampaign();
    const xssPayload = '<script>alert("XSS")</script><img src="x" onerror="alert(1)"/>';
    const turn: TurnRecord = {
      id: 'turn_xss',
      createdAt: new Date().toISOString(),
      territoryId: 'identity',
      dimension: 'self',
      question: 'Question?',
      answer: xssPayload,
      substantive: true,
      behavioralExample: false,
      revision: false,
      retracted: false
    };

    state = applyGameEvents(state, [{ type: 'ANSWER_ACCEPTED', turn }]);
    expect(state.turns[0].answer).toBe(xssPayload);
  });
});
