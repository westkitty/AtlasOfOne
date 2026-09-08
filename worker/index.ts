import { cartographerContextSchema } from '../src/cartographer/context';
import { finalAssessmentSchema, finalizeContextSchema, validateFinalAssessment } from '../src/cartographer/finalize';
import { DEFAULT_MODEL_ID, DEFAULT_TRANSCRIBE_MODEL_ID, findCandidate, transcribeModelIsEligible } from '../src/cartographer/models';
import { playerMessageForFailure, type ProviderFailureCode } from '../src/cartographer/provider';
import { createWorkersAiProvider, type WorkersAiBinding } from '../src/cartographer/workersai';

/**
 * The Atlas Worker.
 *
 * Real inference happens here and nowhere else, so no Cloudflare credential or
 * privileged configuration is ever shipped to the browser.
 *
 * This Worker persists nothing. The compiled context arrives, is used for one
 * request, and is discarded with the request scope. There is no database binding,
 * no transcript log, and no request body is written to the console.
 */

export interface Env {
  /** Workers AI binding. Absent when the deployment has no AI configured. */
  AI?: WorkersAiBinding;
  /** Overrides the default model id without a code change. */
  ATLAS_MODEL_ID?: string;
  /** Set to "false" to force the disabled provider even where AI is bound. */
  ATLAS_AI_ENABLED?: string;
  /** Access secret protecting inference endpoints. */
  ATLAS_ACCESS_SECRET?: string;
  /** Overrides the default speech recognition model without a code change. */
  ATLAS_TRANSCRIBE_MODEL_ID?: string;
}

/** Largest accepted request body for context. A compiled context is far smaller than this. */
const MAX_BODY_BYTES = 64_000;

/** Maximum accepted audio body for transcription (~2 MB). */
const MAX_AUDIO_BYTES = 2_000_000;

async function readBoundedJson(request: Request, maxBytes: number): Promise<{ ok: true; data: unknown } | { ok: false; code: 'payload-too-large' | 'bad-request' }> {
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > maxBytes) {
    return { ok: false, code: 'payload-too-large' };
  }
  if (!request.body) return { ok: false, code: 'bad-request' };
  if (typeof request.body.getReader === 'function') {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            await reader.cancel();
            return { ok: false, code: 'payload-too-large' };
          }
          chunks.push(value);
        }
      }
    } catch {
      return { ok: false, code: 'bad-request' };
    }
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      const text = new TextDecoder('utf-8').decode(merged);
      const data = JSON.parse(text);
      return { ok: true, data };
    } catch {
      return { ok: false, code: 'bad-request' };
    }
  } else {
    try {
      const text = await request.text();
      const bytes = new TextEncoder().encode(text).byteLength;
      if (bytes > maxBytes) return { ok: false, code: 'payload-too-large' };
      const data = JSON.parse(text);
      return { ok: true, data };
    } catch {
      return { ok: false, code: 'bad-request' };
    }
  }
}

async function readBoundedBuffer(request: Request, maxBytes: number): Promise<{ ok: true; buffer: ArrayBuffer } | { ok: false; code: 'payload-too-large' | 'bad-request' }> {
  const lengthHeader = request.headers.get('content-length');
  if (lengthHeader && Number(lengthHeader) > maxBytes) {
    return { ok: false, code: 'payload-too-large' };
  }
  if (!request.body) return { ok: false, code: 'bad-request' };
  if (typeof request.body.getReader === 'function') {
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let totalBytes = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          totalBytes += value.byteLength;
          if (totalBytes > maxBytes) {
            await reader.cancel();
            return { ok: false, code: 'payload-too-large' };
          }
          chunks.push(value);
        }
      }
    } catch {
      return { ok: false, code: 'bad-request' };
    }
    const merged = new Uint8Array(totalBytes);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return { ok: true, buffer: merged.buffer };
  } else {
    try {
      const buf = await request.arrayBuffer();
      if (buf.byteLength > maxBytes) return { ok: false, code: 'payload-too-large' };
      return { ok: true, buffer: buf };
    } catch {
      return { ok: false, code: 'bad-request' };
    }
  }
}

const HTTP_STATUS: Record<ProviderFailureCode, number> = {
  'provider-disabled': 503,
  'binding-missing': 503,
  'not-configured': 503,
  'model-unavailable': 503,
  'quota-exhausted': 429,
  'rate-limited': 429,
  capacity: 503,
  timeout: 504,
  network: 502,
  'malformed-output': 502,
  'semantic-invalid': 422,
  'repair-failed': 502,
  unauthorized: 401
};

/**
 * Validates request access secret against the environment secret when configured.
 * Open when ATLAS_ACCESS_SECRET is unconfigured.
 */
function isAuthorized(request: Request, env: Env): boolean {
  if (!env.ATLAS_ACCESS_SECRET) return true;
  const secretHeader = request.headers.get('x-atlas-access-secret');
  if (secretHeader && secretHeader === env.ATLAS_ACCESS_SECRET) return true;
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token === env.ATLAS_ACCESS_SECRET) return true;
  }
  return false;
}

/**
 * Typed failure response. `message` is the player-facing sentence; `code` is for
 * the client's own branching. No provider detail or model id is returned, so
 * backend jargon cannot reach the UI by accident.
 */
const failure = (code: ProviderFailureCode) =>
  Response.json({ ok: false, code, message: playerMessageForFailure(code), retryable: code === 'rate-limited' || code === 'capacity' || code === 'timeout' }, { status: HTTP_STATUS[code] });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/health') {
      const enabled = env.ATLAS_AI_ENABLED !== 'false' && Boolean(env.AI);
      // `transcribeModel` already reports null whenever transcription cannot run,
      // so the field means "the model Atlas would actually execute" rather than
      // "whatever is configured". An ineligible override would be refused at
      // request time, so reporting it here would be an operational lie.
      const transcribeModelId = env.ATLAS_TRANSCRIBE_MODEL_ID ?? DEFAULT_TRANSCRIBE_MODEL_ID;
      const transcribeReady = enabled && transcribeModelIsEligible(transcribeModelId);
      return Response.json({
        ok: true,
        service: 'atlas-of-one',
        cartographer: enabled ? 'workers-ai' : 'disabled',
        model: enabled ? (env.ATLAS_MODEL_ID ?? DEFAULT_MODEL_ID) : null,
        transcribeModel: transcribeReady ? transcribeModelId : null,
        accessProtected: Boolean(env.ATLAS_ACCESS_SECRET)
      });
    }

    if (url.pathname === '/api/turn') {
      if (request.method !== 'POST') return Response.json({ ok: false, code: 'method-not-allowed' }, { status: 405 });
      if (!isAuthorized(request, env)) return failure('unauthorized');

      const bodyRes = await readBoundedJson(request, MAX_BODY_BYTES);
      if (!bodyRes.ok) {
        if (bodyRes.code === 'payload-too-large') return Response.json({ ok: false, code: 'payload-too-large' }, { status: 413 });
        return Response.json({ ok: false, code: 'bad-request', message: 'That request was not a valid Cartographer context.' }, { status: 400 });
      }

      const parsed = cartographerContextSchema.safeParse(bodyRes.data);
      // The request shape is rejected without echoing any of it back.
      if (!parsed.success) return Response.json({ ok: false, code: 'bad-request', message: 'That request was not a valid Cartographer context.' }, { status: 400 });

      if (env.ATLAS_AI_ENABLED === 'false') return failure('provider-disabled');
      if (!env.AI) return failure('binding-missing');

      const modelId = env.ATLAS_MODEL_ID ?? DEFAULT_MODEL_ID;
      const candidate = findCandidate(modelId);
      // A model outside the eligible free-plan registry is refused here, before a
      // request exists, so a misconfiguration cannot create cost.
      if (!candidate || !candidate.freePlanEligible) return failure('not-configured');

      const provider = createWorkersAiProvider({ binding: env.AI, modelId });
      const result = await provider.turn(parsed.data);
      if (!result.ok) return failure(result.failure.code);

      return Response.json({ ok: true, turn: result.turn, modelId: result.modelId, repaired: result.repaired, usage: result.usage });
    }

    if (url.pathname === '/api/transcribe') {
      if (request.method !== 'POST') return Response.json({ ok: false, code: 'method-not-allowed' }, { status: 405 });
      if (!isAuthorized(request, env)) return failure('unauthorized');

      const bufRes = await readBoundedBuffer(request, MAX_AUDIO_BYTES);
      if (!bufRes.ok) {
        if (bufRes.code === 'payload-too-large') return Response.json({ ok: false, code: 'payload-too-large', message: 'Audio recording exceeds the maximum length.' }, { status: 413 });
        return Response.json({ ok: false, code: 'bad-request', message: 'Audio recording was empty or unreadable.' }, { status: 400 });
      }

      const buffer = bufRes.buffer;
      if (buffer.byteLength < 50) return Response.json({ ok: false, code: 'bad-request', message: 'Audio recording was empty or unreadable.' }, { status: 400 });

      if (env.ATLAS_AI_ENABLED === 'false') return failure('provider-disabled');
      if (!env.AI) return failure('binding-missing');

      const modelId = env.ATLAS_TRANSCRIBE_MODEL_ID ?? DEFAULT_TRANSCRIBE_MODEL_ID;
      // Same fail-closed gate the turn path applies, refused BEFORE any binding
      // call exists. An id outside the free-plan transcription registry — unknown
      // or paid — cannot create provider work by misconfiguration.
      if (!transcribeModelIsEligible(modelId)) return failure('not-configured');

      try {
        const bytes = new Uint8Array(buffer);
        const result = await env.AI.run(modelId, { audio: [...bytes] }) as { text?: string };
        const text = (result?.text ?? '').trim();
        return Response.json({ ok: true, text, modelId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/quota|neuron/i.test(message)) return failure('quota-exhausted');
        if (/rate limit|too many/i.test(message)) return failure('rate-limited');
        return failure('network');
      }
    }

    if (url.pathname === '/api/finalize') {
      if (request.method !== 'POST') return Response.json({ ok: false, code: 'method-not-allowed' }, { status: 405 });
      if (!isAuthorized(request, env)) return failure('unauthorized');

      const bodyRes = await readBoundedJson(request, MAX_BODY_BYTES);
      if (!bodyRes.ok) {
        if (bodyRes.code === 'payload-too-large') return Response.json({ ok: false, code: 'payload-too-large' }, { status: 413 });
        return Response.json({ ok: false, code: 'bad-request', message: 'That request was not a valid finalize context.' }, { status: 400 });
      }

      const parsed = finalizeContextSchema.safeParse(bodyRes.data);
      if (!parsed.success) return Response.json({ ok: false, code: 'bad-request', message: 'That request was not a valid finalize context.' }, { status: 400 });

      if (env.ATLAS_AI_ENABLED === 'false') return failure('provider-disabled');
      if (!env.AI) return failure('binding-missing');

      const modelId = env.ATLAS_MODEL_ID ?? DEFAULT_MODEL_ID;
      const candidate = findCandidate(modelId);
      if (!candidate || !candidate.freePlanEligible) return failure('not-configured');

      try {
        const systemPrompt = [
          'You are the Cartographer in Atlas of One synthesizing the final holistic assessment ("The Greyson Map") for Greyson (he/they).',
          'Return ONLY a valid JSON object matching the required schema. No prose or markdown outside the JSON.',
          'IMPORTANT RULES:',
          '1. Strictly separate established evidence (facts stated by player), supported inferences (hypotheses with confidence "low" | "moderate" | "strong"), and open questions / uncertainty.',
          '2. NEVER reference, mention, or hypothesize about these private topics: ' + (parsed.data.privateTopics.join(', ') || 'none'),
          '3. Do NOT diagnose, score, or reduce the person to a static label.',
          '4. Framework estimates must always include explicit caveats that they are working hypotheses, not clinical diagnoses.'
        ].join('\n');

        const userPrompt = JSON.stringify(parsed.data);
        const raw = await env.AI.run(modelId, {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          max_tokens: 1500
        });

        const responseText = typeof raw === 'string' ? raw : (raw as { response?: string })?.response ?? JSON.stringify(raw);
        let parsedJson: unknown;
        try {
          const cleaned = responseText.replace(/```(?:json)?/g, '').trim();
          parsedJson = JSON.parse(cleaned);
        } catch {
          return failure('malformed-output');
        }

        const valid = finalAssessmentSchema.safeParse(parsedJson);
        if (!valid.success) {
          return failure('malformed-output');
        }

        // Shape is not honesty. A schema-valid assessment that names a closed
        // topic, invents a quotation or narrates progression is refused outright
        // and never repaired, exactly as on the per-turn path. The caller falls
        // back to the deterministic local synthesis, so nothing is lost.
        const semantic = validateFinalAssessment(valid.data, parsed.data);
        if (!semantic.ok) return failure('semantic-invalid');

        return Response.json({ ok: true, assessment: valid.data, modelId });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (/quota|neuron/i.test(message)) return failure('quota-exhausted');
        if (/rate limit|too many/i.test(message)) return failure('rate-limited');
        return failure('network');
      }
    }

    if (url.pathname.startsWith('/api/')) return Response.json({ ok: false, code: 'NOT_IMPLEMENTED' }, { status: 404 });
    return new Response(null, { status: 404 });
  }
};
