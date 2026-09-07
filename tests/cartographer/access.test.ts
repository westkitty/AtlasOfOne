import { describe, expect, it } from 'vitest';
import { compileContext } from '../../src/cartographer/context';
import type { WorkersAiBinding } from '../../src/cartographer/workersai';
import { createInitialCampaign } from '../../src/game/engine';
import { clearAccessSecret, getAccessHeaders, getAccessSecret, setAccessSecret } from '../../src/voice/access';
import worker, { type Env } from '../../worker/index';

const SECRET = 'test-access-token-98765';
const state = createInitialCampaign();
const context = compileContext(state, { territoryId: 'identity', dimension: 'self-description', question: 'Test question?' }, 'Test answer.');

const validTurn = {
  reply: 'Noted.',
  nextQuestion: 'Next question?',
  presentation: 'normal',
  evidence: [],
  connections: [],
  quoteCandidates: [],
  summaryPatch: '',
  achievementCandidates: []
};

const okBinding: WorkersAiBinding = {
  run: async () => ({
    response: JSON.stringify(validTurn),
    usage: { prompt_tokens: 100, completion_tokens: 20 }
  })
};

const postTurn = (body: unknown, env: Env, headers: Record<string, string> = {}) =>
  worker.fetch(
    new Request('https://atlas.test/api/turn', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body)
    }),
    env
  );

const postTranscribe = (env: Env, headers: Record<string, string> = {}) =>
  worker.fetch(
    new Request('https://atlas.test/api/transcribe', {
      method: 'POST',
      headers: { 'content-type': 'audio/webm', ...headers },
      body: new Uint8Array(120).buffer
    }),
    env
  );

describe('access secret gate on Cloudflare Worker', () => {
  it('allows access when ATLAS_ACCESS_SECRET is unconfigured', async () => {
    const response = await postTurn(context, { AI: okBinding });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, any>;
    expect(body.ok).toBe(true);
  });

  it('rejects request with 401 when ATLAS_ACCESS_SECRET is set and no secret is provided', async () => {
    const response = await postTurn(context, { AI: okBinding, ATLAS_ACCESS_SECRET: SECRET });
    expect(response.status).toBe(401);
    const body = await response.json() as Record<string, any>;
    expect(body.ok).toBe(false);
    expect(body.code).toBe('unauthorized');
    expect(String(body.message)).toMatch(/access/i);
  });

  it('rejects request with 401 when an incorrect secret is provided', async () => {
    const response = await postTurn(context, { AI: okBinding, ATLAS_ACCESS_SECRET: SECRET }, { 'x-atlas-access-secret': 'wrong-secret' });
    expect(response.status).toBe(401);
  });

  it('accepts request when valid x-atlas-access-secret header is supplied', async () => {
    const response = await postTurn(context, { AI: okBinding, ATLAS_ACCESS_SECRET: SECRET }, { 'x-atlas-access-secret': SECRET });
    expect(response.status).toBe(200);
    const body = await response.json() as Record<string, any>;
    expect(body.ok).toBe(true);
  });

  it('accepts request when valid Authorization Bearer token is supplied', async () => {
    const response = await postTurn(context, { AI: okBinding, ATLAS_ACCESS_SECRET: SECRET }, { authorization: `Bearer ${SECRET}` });
    expect(response.status).toBe(200);
  });

  it('guards /api/transcribe with the identical secret check', async () => {
    const transcribeBinding: WorkersAiBinding = { run: async () => ({ text: 'Transcribed voice.' }) };
    const unauth = await postTranscribe({ AI: transcribeBinding, ATLAS_ACCESS_SECRET: SECRET });
    expect(unauth.status).toBe(401);

    const auth = await postTranscribe({ AI: transcribeBinding, ATLAS_ACCESS_SECRET: SECRET }, { 'x-atlas-access-secret': SECRET });
    expect(auth.status).toBe(200);
    const body = await auth.json() as Record<string, any>;
    expect(body.ok).toBe(true);
    expect(body.text).toBe('Transcribed voice.');
  });

  it('health endpoint reports accessProtected flag without revealing the secret', async () => {
    const healthUnprotected = await (await worker.fetch(new Request('https://atlas.test/api/health'), { AI: okBinding })).json() as Record<string, any>;
    expect(healthUnprotected.accessProtected).toBe(false);

    const resProtected = await worker.fetch(new Request('https://atlas.test/api/health'), { AI: okBinding, ATLAS_ACCESS_SECRET: SECRET });
    const textProtected = await resProtected.text();
    const jsonProtected = JSON.parse(textProtected);

    expect(jsonProtected.accessProtected).toBe(true);
    // CRITICAL: The secret string must NEVER appear in the response text
    expect(textProtected).not.toContain(SECRET);
  });
});

describe('local client access storage isolation', () => {
  it('stores and retrieves access secret in localStorage without polluting CampaignState', () => {
    // Stub localStorage
    const store: Record<string, string> = {};
    (globalThis as any).window = {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; }
      }
    };

    clearAccessSecret();
    expect(getAccessSecret()).toBeNull();
    expect(getAccessHeaders()).toEqual({});

    setAccessSecret('client-secret-abc');
    expect(getAccessSecret()).toBe('client-secret-abc');
    expect(getAccessHeaders()).toEqual({ 'x-atlas-access-secret': 'client-secret-abc' });

    // Ensure CampaignState has no access secret field
    const campaign = createInitialCampaign();
    expect((campaign as any).accessSecret).toBeUndefined();
    expect(JSON.stringify(campaign)).not.toContain('client-secret-abc');

    clearAccessSecret();
    expect(getAccessSecret()).toBeNull();

    delete (globalThis as any).window;
  });
});
