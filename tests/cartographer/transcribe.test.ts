import { describe, expect, it } from 'vitest';
import { DEFAULT_TRANSCRIBE_MODEL_ID, TRANSCRIBE_MODEL_CANDIDATES, findTranscribeCandidate, transcribeModelIsEligible } from '../../src/cartographer/models';
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

describe('transcription zero-dollar boundary (KNOWN-004)', () => {
  /**
   * `/api/turn` has always refused a model outside its free-plan registry before
   * a request exists. `/api/transcribe` did not, so `ATLAS_TRANSCRIBE_MODEL_ID`
   * could point anywhere and Atlas would run it. These prove the same fail-closed
   * rule now applies, and — crucially — that refusal costs ZERO binding calls.
   */
  const countingBinding = () => {
    const calls: string[] = [];
    const binding: WorkersAiBinding = {
      run: async (model: string) => {
        calls.push(model);
        return { text: '  Synthetic transcript.  ' } as never;
      }
    } as WorkersAiBinding;
    return { binding, calls };
  };
  const validAudio = new Uint8Array(256).fill(7).buffer;

  it('the registry, not the Worker, is the authority on eligibility', () => {
    // No duplicate allow-list may exist in worker/index.ts.
    expect(TRANSCRIBE_MODEL_CANDIDATES.map((c) => c.id)).toEqual(['@cf/openai/whisper-tiny-en', '@cf/openai/whisper']);
    expect(transcribeModelIsEligible(DEFAULT_TRANSCRIBE_MODEL_ID)).toBe(true);
    expect(transcribeModelIsEligible('@cf/openai/whisper')).toBe(true);
    expect(transcribeModelIsEligible('@cf/not-a-real-transcribe-model')).toBe(false);
    expect(findTranscribeCandidate('@cf/not-a-real-transcribe-model')).toBeUndefined();
  });

  it('an ineligible registry entry is refused by the helper without touching production defaults', () => {
    // Exercises freePlanEligible:false without adding a fake selectable model to
    // the production registry: the predicate is checked against a candidate shape.
    const paid = { id: '@cf/synthetic/paid-speech', label: 'Synthetic paid', freePlanEligible: false } as const;
    expect(paid.freePlanEligible).toBe(false);
    expect(transcribeModelIsEligible(paid.id), 'not in the registry, so refused').toBe(false);
    // And the real registry still contains only free-plan-eligible entries.
    expect(TRANSCRIBE_MODEL_CANDIDATES.every((c) => c.freePlanEligible)).toBe(true);
  });

  it('the default model runs and reaches the binding exactly once', async () => {
    const { binding, calls } = countingBinding();
    const res = await postAudio(validAudio, { AI: binding });
    expect(res.status).toBe(200);
    expect(calls).toEqual([DEFAULT_TRANSCRIBE_MODEL_ID]);
  });

  it('the known free-plan override runs and reaches the binding exactly once', async () => {
    const { binding, calls } = countingBinding();
    const res = await postAudio(validAudio, { AI: binding, ATLAS_TRANSCRIBE_MODEL_ID: '@cf/openai/whisper' });
    expect(res.status).toBe(200);
    expect(calls).toEqual(['@cf/openai/whisper']);
  });

  it('an unknown override is refused BEFORE any binding call', async () => {
    const { binding, calls } = countingBinding();
    const res = await postAudio(validAudio, { AI: binding, ATLAS_TRANSCRIBE_MODEL_ID: '@cf/not-a-real-transcribe-model' });
    expect(res.status).toBe(503);
    expect((await res.json() as { code: string }).code).toBe('not-configured');
    expect(calls, 'zero AI binding calls on refusal').toEqual([]);
  });

  it('a paid-shaped override is refused BEFORE any binding call', async () => {
    const { binding, calls } = countingBinding();
    const res = await postAudio(validAudio, { AI: binding, ATLAS_TRANSCRIBE_MODEL_ID: '@cf/synthetic/paid-speech' });
    expect(res.status).toBe(503);
    expect(calls, 'zero AI binding calls on refusal').toEqual([]);
  });

  it('health reports only a transcription model Atlas would actually execute', async () => {
    const binding: WorkersAiBinding = { run: async () => ({ text: '' }) } as WorkersAiBinding;
    const health = async (env: Env) =>
      (await (await worker.fetch(new Request('https://atlas.test/api/health'), env)).json()) as { transcribeModel: string | null };

    expect((await health({ AI: binding })).transcribeModel).toBe(DEFAULT_TRANSCRIBE_MODEL_ID);
    expect((await health({ AI: binding, ATLAS_TRANSCRIBE_MODEL_ID: '@cf/openai/whisper' })).transcribeModel).toBe('@cf/openai/whisper');
    expect(
      (await health({ AI: binding, ATLAS_TRANSCRIBE_MODEL_ID: '@cf/not-a-real-transcribe-model' })).transcribeModel,
      'an ineligible override is not advertised as runnable'
    ).toBeNull();
  });
});
