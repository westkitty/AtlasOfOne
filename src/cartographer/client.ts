import type { CartographerContext } from './context';
import { type FinalAssessment, type FinalizeContext, finalAssessmentSchema } from './finalize';
import { type AIProvider, type ProviderResult, playerMessageForFailure, providerFailure, type ProviderFailureCode } from './provider';
import { cartographerTurnSchema } from './schema';

/**
 * Browser-side provider client.
 *
 * It holds no credential and knows no model. It posts a compiled context to the
 * same-origin Worker and reads back either a validated turn or a typed failure.
 * The Worker validates before this client ever sees a response, and this client
 * validates again, because a response is untrusted input too.
 */

const FAILURE_CODES = new Set<string>([
  'provider-disabled', 'binding-missing', 'not-configured', 'model-unavailable',
  'quota-exhausted', 'rate-limited', 'capacity', 'timeout', 'network',
  'malformed-output', 'semantic-invalid', 'repair-failed', 'unauthorized'
]);

export interface RemoteProviderOptions {
  endpoint?: string;
  headers?: Record<string, string> | (() => Record<string, string>);
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createRemoteProvider(options: RemoteProviderOptions = {}): AIProvider {
  const endpoint = options.endpoint ?? '/api/turn';
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const timeoutMs = options.timeoutMs ?? 25_000;

  return {
    id: 'remote:/api/turn',
    async turn(context: CartographerContext): Promise<ProviderResult> {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const extraHeaders = typeof options.headers === 'function' ? options.headers() : (options.headers ?? {});
      let response: Response;
      try {
        response = await doFetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...extraHeaders },
          body: JSON.stringify(context),
          signal: controller.signal
        });
      } catch (error) {
        const aborted = error instanceof Error && error.name === 'AbortError';
        return providerFailure(aborted ? 'timeout' : 'network', error instanceof Error ? error.message : String(error), true);
      } finally {
        clearTimeout(timer);
      }

      const payload = await response.json().catch(() => null) as
        | { ok?: boolean; code?: string; turn?: unknown; modelId?: string; repaired?: boolean; usage?: { inputTokens: number; outputTokens: number; neurons: number } }
        | null;

      if (!payload || payload.ok !== true) {
        const code = payload?.code && FAILURE_CODES.has(payload.code) ? (payload.code as ProviderFailureCode) : (response.status === 401 ? 'unauthorized' : 'network');
        return providerFailure(code, `Worker returned ${response.status}.`, code === 'rate-limited' || code === 'capacity' || code === 'timeout');
      }

      const parsed = cartographerTurnSchema.safeParse(payload.turn);
      if (!parsed.success) return providerFailure('malformed-output', 'Worker returned a turn that failed local validation.', false);

      return { ok: true, turn: parsed.data, modelId: payload.modelId ?? 'unknown', repaired: Boolean(payload.repaired), usage: payload.usage };
    }
  };
}

export interface TranscribeAudioOptions {
  endpoint?: string;
  headers?: Record<string, string> | (() => Record<string, string>);
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function transcribeAudio(
  audioBlob: Blob,
  options: TranscribeAudioOptions = {}
): Promise<{ ok: true; text: string; modelId?: string } | { ok: false; code: string; message: string; retryable?: boolean }> {
  const endpoint = options.endpoint ?? '/api/transcribe';
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const timeoutMs = options.timeoutMs ?? 30_000;
  const extraHeaders = typeof options.headers === 'function' ? options.headers() : (options.headers ?? {});

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await doFetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': audioBlob.type || 'audio/webm',
        ...extraHeaders
      },
      body: audioBlob,
      signal: controller.signal
    });

    const payload = await response.json().catch(() => null) as { ok?: boolean; code?: string; text?: string; message?: string; modelId?: string } | null;

    if (!response.ok || !payload || payload.ok !== true) {
      const code = payload?.code ?? (response.status === 401 ? 'unauthorized' : 'network');
      const message = payload?.message ?? playerMessageForFailure(code as ProviderFailureCode) ?? 'Transcription failed.';
      return { ok: false, code, message, retryable: code === 'rate-limited' || code === 'timeout' };
    }

    return { ok: true, text: payload.text ?? '', modelId: payload.modelId };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    const code = aborted ? 'timeout' : 'network';
    return { ok: false, code, message: playerMessageForFailure(code), retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

export interface FinalizeAssessmentOptions {
  endpoint?: string;
  headers?: Record<string, string> | (() => Record<string, string>);
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export async function requestFinalAssessment(
  context: FinalizeContext,
  options: FinalizeAssessmentOptions = {}
): Promise<{ ok: true; assessment: FinalAssessment; modelId?: string } | { ok: false; code: string; message: string; retryable?: boolean }> {
  const endpoint = options.endpoint ?? '/api/finalize';
  const doFetch = options.fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));
  const timeoutMs = options.timeoutMs ?? 30_000;
  const extraHeaders = typeof options.headers === 'function' ? options.headers() : (options.headers ?? {});

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await doFetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...extraHeaders
      },
      body: JSON.stringify(context),
      signal: controller.signal
    });

    const payload = await response.json().catch(() => null) as { ok?: boolean; code?: string; assessment?: unknown; message?: string; modelId?: string } | null;
    if (!response.ok || !payload || payload.ok !== true) {
      const code = payload?.code ?? (response.status === 401 ? 'unauthorized' : 'network');
      const message = payload?.message ?? playerMessageForFailure(code as ProviderFailureCode) ?? 'Final assessment generation failed.';
      return { ok: false, code, message, retryable: code === 'rate-limited' || code === 'capacity' || code === 'timeout' };
    }

    const parsed = finalAssessmentSchema.safeParse(payload.assessment);
    if (!parsed.success) {
      return { ok: false, code: 'malformed-output', message: playerMessageForFailure('malformed-output'), retryable: false };
    }

    return { ok: true, assessment: parsed.data, modelId: payload.modelId };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    const code = aborted ? 'timeout' : 'network';
    return { ok: false, code, message: playerMessageForFailure(code), retryable: true };
  } finally {
    clearTimeout(timer);
  }
}

export { playerMessageForFailure };
