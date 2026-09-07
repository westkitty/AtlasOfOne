import { cartographerContextSchema } from '../src/cartographer/context';
import { DEFAULT_MODEL_ID, DEFAULT_TRANSCRIBE_MODEL_ID, findCandidate } from '../src/cartographer/models';
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
      return Response.json({
        ok: true,
        service: 'atlas-of-one',
        cartographer: enabled ? 'workers-ai' : 'disabled',
        model: enabled ? (env.ATLAS_MODEL_ID ?? DEFAULT_MODEL_ID) : null,
        transcribeModel: enabled ? (env.ATLAS_TRANSCRIBE_MODEL_ID ?? DEFAULT_TRANSCRIBE_MODEL_ID) : null,
        accessProtected: Boolean(env.ATLAS_ACCESS_SECRET)
      });
    }

    if (url.pathname === '/api/turn') {
      if (request.method !== 'POST') return Response.json({ ok: false, code: 'method-not-allowed' }, { status: 405 });
      if (!isAuthorized(request, env)) return failure('unauthorized');

      const length = Number(request.headers.get('content-length') ?? '0');
      if (length > MAX_BODY_BYTES) return Response.json({ ok: false, code: 'payload-too-large' }, { status: 413 });

      const body = await request.json().catch(() => null);
      const parsed = cartographerContextSchema.safeParse(body);
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

      const length = Number(request.headers.get('content-length') ?? '0');
      if (length > MAX_AUDIO_BYTES) return Response.json({ ok: false, code: 'payload-too-large', message: 'Audio recording exceeds the maximum length.' }, { status: 413 });

      const buffer = await request.arrayBuffer().catch(() => null);
      if (!buffer || buffer.byteLength < 50) return Response.json({ ok: false, code: 'bad-request', message: 'Audio recording was empty or unreadable.' }, { status: 400 });
      if (buffer.byteLength > MAX_AUDIO_BYTES) return Response.json({ ok: false, code: 'payload-too-large', message: 'Audio recording exceeds the maximum length.' }, { status: 413 });

      if (env.ATLAS_AI_ENABLED === 'false') return failure('provider-disabled');
      if (!env.AI) return failure('binding-missing');

      const modelId = env.ATLAS_TRANSCRIBE_MODEL_ID ?? DEFAULT_TRANSCRIBE_MODEL_ID;
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

    if (url.pathname.startsWith('/api/')) return Response.json({ ok: false, code: 'NOT_IMPLEMENTED' }, { status: 404 });
    return new Response(null, { status: 404 });
  }
};
