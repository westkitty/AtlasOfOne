import { describe, expect, it } from 'vitest';
import { DEFAULT_TRANSCRIBE_MODEL_ID } from '../../src/cartographer/models';
import type { WorkersAiBinding } from '../../src/cartographer/workersai';
import worker, { type Env } from '../../worker/index';

const postAudio = (body: ArrayBuffer | null, env: Env, headers: Record<string, string> = {}) =>
  worker.fetch(
    new Request('https://atlas.test/api/transcribe', {
      method: 'POST',
      headers: { 'content-type': 'audio/webm', ...headers },
      body
    }),
    env
  );

describe('Worker /api/transcribe endpoint', () => {
  it('rejects non-POST method with 405', async () => {
    const res = await worker.fetch(new Request('https://atlas.test/api/transcribe', { method: 'GET' }), {});
    expect(res.status).toBe(405);
  });

  it('rejects an empty or undersized audio buffer with 400', async () => {
    const empty = new Uint8Array(10).buffer;
    const res = await postAudio(empty, {});
    expect(res.status).toBe(400);
    const body = await res.json() as Record<string, any>;
    expect(body.code).toBe('bad-request');
  });

  it('rejects oversized audio payload exceeding 2MB with 413', async () => {
    const res = await worker.fetch(
      new Request('https://atlas.test/api/transcribe', {
        method: 'POST',
        headers: { 'content-type': 'audio/webm', 'content-length': '2500000' },
        body: new Uint8Array(100).buffer
      }),
      {}
    );
    expect(res.status).toBe(413);
    const body = await res.json() as Record<string, any>;
    expect(body.code).toBe('payload-too-large');
  });

  it('degrades typed when AI binding is missing', async () => {
    const validAudio = new Uint8Array(200).buffer;
    const res = await postAudio(validAudio, {});
    expect(res.status).toBe(503);
    const body = await res.json() as Record<string, any>;
    expect(body.code).toBe('binding-missing');
  });

  it('degrades typed when ATLAS_AI_ENABLED is false', async () => {
    const validAudio = new Uint8Array(200).buffer;
    const okBinding: WorkersAiBinding = { run: async () => ({ text: 'Ignored' }) };
    const res = await postAudio(validAudio, { AI: okBinding, ATLAS_AI_ENABLED: 'false' });
    expect(res.status).toBe(503);
    const body = await res.json() as Record<string, any>;
    expect(body.code).toBe('provider-disabled');
  });

  it('executes transcription using the default model and returns clean text', async () => {
    let calledModel = '';
    let audioBytesLength = 0;
    const okBinding: WorkersAiBinding = {
      run: async (model, input: any) => {
        calledModel = model;
        audioBytesLength = input?.audio?.length ?? 0;
        return { text: '  I prefer to make decisions carefully.  ' };
      }
    };

    const validAudio = new Uint8Array(300).buffer;
    const res = await postAudio(validAudio, { AI: okBinding });
    expect(res.status).toBe(200);
    const body = await res.json() as Record<string, any>;
    expect(body.ok).toBe(true);
    expect(body.text).toBe('I prefer to make decisions carefully.');
    expect(calledModel).toBe(DEFAULT_TRANSCRIBE_MODEL_ID);
    expect(audioBytesLength).toBe(300);
  });

  it('honours ATLAS_TRANSCRIBE_MODEL_ID override', async () => {
    let calledModel = '';
    const okBinding: WorkersAiBinding = {
      run: async (model) => {
        calledModel = model;
        return { text: 'Spoken answer.' };
      }
    };

    const validAudio = new Uint8Array(200).buffer;
    const res = await postAudio(validAudio, { AI: okBinding, ATLAS_TRANSCRIBE_MODEL_ID: '@cf/openai/whisper' });
    expect(res.status).toBe(200);
    expect(calledModel).toBe('@cf/openai/whisper');
  });

  it('maps quota exhaustion to 429', async () => {
    const failingBinding: WorkersAiBinding = {
      run: async () => { throw new Error('daily neuron allocation exhausted'); }
    };
    const validAudio = new Uint8Array(200).buffer;
    const res = await postAudio(validAudio, { AI: failingBinding });
    expect(res.status).toBe(429);
    const body = await res.json() as Record<string, any>;
    expect(body.code).toBe('quota-exhausted');
  });

  it('maps rate limit to 429', async () => {
    const failingBinding: WorkersAiBinding = {
      run: async () => { throw new Error('429 Too Many Requests: rate limit exceeded'); }
    };
    const validAudio = new Uint8Array(200).buffer;
    const res = await postAudio(validAudio, { AI: failingBinding });
    expect(res.status).toBe(429);
    const body = await res.json() as Record<string, any>;
    expect(body.code).toBe('rate-limited');
  });
});
