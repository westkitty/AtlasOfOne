import type { CartographerContext } from './context';
import type { CartographerTurn } from './schema';

/**
 * The provider boundary.
 *
 * A provider proposes language and evidence. It has exactly the authority the
 * MockCartographer has, which is none: `CartographerTurn` carries no progression
 * field, and the only code that turns a proposal into state is `src/game/`.
 *
 * Deliberately small. Atlas needs a mock, a Workers AI implementation, and a
 * disabled state — not a multi-provider framework.
 */

export type ProviderFailureCode =
  /** No provider is switched on; the local mock is answering instead. */
  | 'provider-disabled'
  /** The Worker has no `AI` binding, so Workers AI is not reachable at all. */
  | 'binding-missing'
  /** Bound but unconfigured: no model id, or an id outside the eligible set. */
  | 'not-configured'
  /** The requested model is gone, renamed, or not available on Workers Free. */
  | 'model-unavailable'
  /** The free daily neuron allocation is spent. Never escalate this to a paid plan. */
  | 'quota-exhausted'
  | 'rate-limited'
  | 'capacity'
  | 'timeout'
  | 'network'
  /** The response could not be decoded into JSON at all. */
  | 'malformed-output'
  /** Decoded and schema-valid, but it violated an Atlas rule (e.g. a private dimension). */
  | 'semantic-invalid'
  /** The single permitted repair attempt also failed. */
  | 'repair-failed'
  /** The Worker requires an access secret that was missing or invalid. */
  | 'unauthorized';

export interface ProviderFailure {
  code: ProviderFailureCode;
  /** Engineering detail. Never rendered to the player. */
  detail: string;
  /** True when trying the same turn again could plausibly succeed. */
  retryable: boolean;
}

export interface ProviderUsage {
  inputTokens: number;
  outputTokens: number;
  /** Derived from the model's published rate; 0 when the model id is unknown. */
  neurons: number;
}

export type ProviderResult =
  | { ok: true; turn: CartographerTurn; modelId: string; usage?: ProviderUsage; repaired: boolean }
  | { ok: false; failure: ProviderFailure };

export interface AIProvider {
  readonly id: string;
  turn(context: CartographerContext): Promise<ProviderResult>;
}

export const providerFailure = (code: ProviderFailureCode, detail: string, retryable = false): ProviderResult => ({
  ok: false,
  failure: { code, detail, retryable }
});

/**
 * Player-facing copy for every failure code.
 *
 * Atlas's own voice, no backend jargon: the player never reads "binding",
 * "429", "schema" or a model id. Quota exhaustion in particular has to read as a
 * boundary the app respects on purpose, not as a fault.
 */
const PLAYER_MESSAGES: Record<ProviderFailureCode, string> = {
  'provider-disabled': 'The Cartographer is running on its offline script right now. Your answer was still mapped.',
  'binding-missing': 'The Cartographer cannot reach its wider mind from here. Your answer was still mapped.',
  'not-configured': 'The Cartographer cannot reach its wider mind from here. Your answer was still mapped.',
  'model-unavailable': 'The Cartographer cannot reach its wider mind from here. Your answer was still mapped.',
  'quota-exhausted': "That is the Cartographer's thinking for today. It keeps mapping on its own script, and it will be sharper tomorrow.",
  'rate-limited': 'The Cartographer needs a moment to catch up. Try that again shortly.',
  capacity: 'The Cartographer is overloaded right now. Try that again shortly.',
  timeout: 'The Cartographer took too long to answer. Try that again.',
  network: 'The Cartographer could not be reached. Your answer is safe on this device.',
  'malformed-output': 'The Cartographer lost the thread of that one. Your answer was still mapped.',
  'semantic-invalid': 'The Cartographer overstepped and its reply was discarded. Your answer was still mapped.',
  'repair-failed': 'The Cartographer lost the thread of that one. Your answer was still mapped.',
  unauthorized: 'The Cartographer requires an access code to connect. Your answer was still mapped.'
};

export const playerMessageForFailure = (code: ProviderFailureCode): string => PLAYER_MESSAGES[code];

/**
 * Whether a failure should leave the player on a degraded-but-playable path.
 * Every code does: a provider failure must never cost the player their answer,
 * so the caller always falls back to the deterministic local turn.
 */
export const failureIsRecoverable = (_failure: ProviderFailure): true => true;

/** A provider that is switched off. Used when no AI is configured at all. */
export const disabledProvider: AIProvider = {
  id: 'disabled',
  turn: async () => providerFailure('provider-disabled', 'No AI provider is enabled.', false)
};
