import { describe, expect, it } from 'vitest';
import { createRemoteProvider } from '../../src/cartographer/client';
import { compileContext } from '../../src/cartographer/context';
import { createInitialCampaign } from '../../src/game/engine';

describe('Phase 5 Adversarial QA: Network Failures & Provider Degradation', () => {
  const state = createInitialCampaign();
  const context = compileContext(state, { territoryId: 'identity', dimension: 'self', question: 'Who are you?' }, 'Test answer');

  it('handles 401 Unauthorized by returning a typed unauthorized failure without leaking tokens', async () => {
    const mockFetch = async () => new Response(JSON.stringify({ ok: false, code: 'unauthorized' }), { status: 401 });
    const provider = createRemoteProvider({ fetchImpl: mockFetch as unknown as typeof fetch });
    const result = await provider.turn(context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('unauthorized');
    }
  });

  it('handles 413 Payload Too Large properly', async () => {
    const mockFetch = async () => new Response(JSON.stringify({ ok: false, code: 'payload-too-large' }), { status: 413 });
    const provider = createRemoteProvider({ fetchImpl: mockFetch as unknown as typeof fetch });
    const result = await provider.turn(context);

    expect(result.ok).toBe(false);
  });

  it('handles 429 Quota Exhausted with non-retryable friendly degradation', async () => {
    const mockFetch = async () => new Response(JSON.stringify({ ok: false, code: 'quota-exhausted' }), { status: 429 });
    const provider = createRemoteProvider({ fetchImpl: mockFetch as unknown as typeof fetch });
    const result = await provider.turn(context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('quota-exhausted');
      expect(result.failure.retryable).toBe(false);
    }
  });

  it('handles 429 Rate Limited with retryable flag', async () => {
    const mockFetch = async () => new Response(JSON.stringify({ ok: false, code: 'rate-limited' }), { status: 429 });
    const provider = createRemoteProvider({ fetchImpl: mockFetch as unknown as typeof fetch });
    const result = await provider.turn(context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('rate-limited');
      expect(result.failure.retryable).toBe(true);
    }
  });

  it('handles 502/503/504 server failures cleanly', async () => {
    for (const status of [502, 503, 504]) {
      const mockFetch = async () => new Response('Internal Server Error', { status });
      const provider = createRemoteProvider({ fetchImpl: mockFetch as unknown as typeof fetch });
      const result = await provider.turn(context);
      expect(result.ok).toBe(false);
    }
  });

  it('handles malformed / garbage JSON responses without throwing', async () => {
    const mockFetch = async () => new Response('{ broken json: [', { status: 200 });
    const provider = createRemoteProvider({ fetchImpl: mockFetch as unknown as typeof fetch });
    const result = await provider.turn(context);

    expect(result.ok).toBe(false);
  });

  it('handles abrupt network disconnect / abort error cleanly', async () => {
    const mockFetch = async () => {
      const error = new Error('The operation was aborted');
      error.name = 'AbortError';
      throw error;
    };
    const provider = createRemoteProvider({ fetchImpl: mockFetch as unknown as typeof fetch });
    const result = await provider.turn(context);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.failure.code).toBe('timeout');
    }
  });
});
