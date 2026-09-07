import type { CartographerContext } from './context';
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
  'malformed-output', 'semantic-invalid', 'repair-failed'
]);

export interface RemoteProviderOptions {
  endpoint?: string;
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
      let response: Response;
      try {
        response = await doFetch(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
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
        const code = payload?.code && FAILURE_CODES.has(payload.code) ? (payload.code as ProviderFailureCode) : 'network';
        return providerFailure(code, `Worker returned ${response.status}.`, code === 'rate-limited' || code === 'capacity' || code === 'timeout');
      }

      const parsed = cartographerTurnSchema.safeParse(payload.turn);
      if (!parsed.success) return providerFailure('malformed-output', 'Worker returned a turn that failed local validation.', false);

      return { ok: true, turn: parsed.data, modelId: payload.modelId ?? 'unknown', repaired: Boolean(payload.repaired), usage: payload.usage };
    }
  };
}

export { playerMessageForFailure };
