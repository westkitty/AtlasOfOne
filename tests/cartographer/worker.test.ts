import { describe, expect, it } from 'vitest';
import { compileContext } from '../../src/cartographer/context';
import { DEFAULT_MODEL_ID } from '../../src/cartographer/models';
import type { WorkersAiBinding } from '../../src/cartographer/workersai';
import { createInitialCampaign } from '../../src/game/engine';
import worker, { type Env } from '../../worker/index';

/**
 * Worker boundary tests.
 *
 * These call the exported fetch handler directly, so they prove request
 * handling, typed degradation and the zero-dollar refusal without a Cloudflare
 * account. They are NOT a claim that the deployed runtime was exercised.
 */

const state = createInitialCampaign();
const context = compileContext(state, { territoryId: 'identity', dimension: 'self-description', question: 'Synthetic question?' }, 'Curious, mostly patient.');

const validTurn = {
  reply: 'Noted.',
  nextQuestion: 'What does patience cost you when it runs out?',
  presentation: 'normal',
  evidence: [{ dimension: 'self-description', claim: 'Synthetic claim.', basis: 'explicit', strength: 1, territories: ['identity'] }],
  connections: [],
  quoteCandidates: [],
  summaryPatch: '',
  achievementCandidates: []
};

const okBinding: WorkersAiBinding = { run: async () => ({ response: JSON.stringify(validTurn), usage: { prompt_tokens: 900, completion_tokens: 220 } }) };

const post = (body: unknown, env: Env) =>
  worker.fetch(new Request('https://atlas.test/api/turn', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), env);

const get = (path: string, env: Env) => worker.fetch(new Request(`https://atlas.test${path}`), env);

describe('/api/health', () => {
  it('reports the disabled Cartographer when no AI is bound', async () => {
    const body = await (await get('/api/health', {})).json() as Record<string, unknown>;
    expect(body.ok).toBe(true);
    expect(body.cartographer).toBe('disabled');
    expect(body.model).toBeNull();
  });

  it('reports the live model when AI is bound', async () => {
    const body = await (await get('/api/health', { AI: okBinding })).json() as Record<string, unknown>;
    expect(body.cartographer).toBe('workers-ai');
    expect(body.model).toBe(DEFAULT_MODEL_ID);
  });

  it('honours the explicit disable switch', async () => {
    const body = await (await get('/api/health', { AI: okBinding, ATLAS_AI_ENABLED: 'false' })).json() as Record<string, unknown>;
    expect(body.cartographer).toBe('disabled');
  });
});

describe('/api/turn', () => {
  it('returns a validated turn when the provider succeeds', async () => {
    const response = await post(context, { AI: okBinding });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, any>;
    expect(body.ok).toBe(true);
    expect(body.turn.reply).toBe('Noted.');
    expect(body.usage.neurons).toBeGreaterThan(0);
  });

  it('rejects a body that is not a compiled context', async () => {
    const response = await post({ hello: 'world' }, { AI: okBinding });
    expect(response.status).toBe(400);
    const body = await response.json() as Record<string, unknown>;
    expect(body.ok).toBe(false);
    expect(body.code).toBe('bad-request');
  });

  it('rejects an oversized context before it can become a request', async () => {
    const bloated = { ...context, agencyRules: Array.from({ length: 40 }, () => 'x'.repeat(50)) };
    const response = await post(bloated, { AI: okBinding });
    expect(response.status).toBe(400);
  });

  it('degrades typed when no AI binding exists', async () => {
    const response = await post(context, {});
    expect(response.status).toBe(503);
    const body = await response.json() as Record<string, unknown>;
    expect(body.code).toBe('binding-missing');
    expect(String(body.message)).not.toMatch(/binding|worker|http/i);
  });

  it('degrades typed when the provider is switched off', async () => {
    const response = await post(context, { AI: okBinding, ATLAS_AI_ENABLED: 'false' });
    expect((await response.json() as Record<string, unknown>).code).toBe('provider-disabled');
  });

  it('refuses a model outside the free-plan registry without calling it', async () => {
    let called = false;
    const binding: WorkersAiBinding = { run: async () => { called = true; return {}; } };
    const response = await post(context, { AI: binding, ATLAS_MODEL_ID: '@cf/zai-org/glm-5.3' });
    expect(response.status).toBe(503);
    expect((await response.json() as Record<string, unknown>).code).toBe('not-configured');
    expect(called).toBe(false);
  });

  it('maps quota exhaustion to 429 with player-safe copy', async () => {
    const binding: WorkersAiBinding = { run: async () => { throw new Error('daily neuron allocation exhausted'); } };
    const response = await post(context, { AI: binding });
    expect(response.status).toBe(429);
    const body = await response.json() as Record<string, unknown>;
    expect(body.code).toBe('quota-exhausted');
    expect(body.retryable).toBe(false);
    expect(String(body.message)).toMatch(/tomorrow/i);
  });

  it('never echoes the request body back on rejection', async () => {
    const response = await post({ secret: 'SYNTHETICWORKERCANARY' }, { AI: okBinding });
    expect(await response.text()).not.toContain('SYNTHETICWORKERCANARY');
  });

  it('rejects a non-POST turn request', async () => {
    expect((await get('/api/turn', { AI: okBinding })).status).toBe(405);
  });

  it('404s unknown API routes', async () => {
    expect((await get('/api/nope', {})).status).toBe(404);
  });
});
