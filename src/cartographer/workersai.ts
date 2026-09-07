import type { CartographerContext } from './context';
import { DEFAULT_MODEL_ID, estimateNeurons, findCandidate } from './models';
import { type AIProvider, type ProviderResult, providerFailure } from './provider';
import { validateProviderResponse } from './validate';

/**
 * The Workers AI provider. Runs Worker-side only: it takes the `AI` binding, so
 * no Cloudflare credential ever exists in browser code.
 *
 * It has exactly the authority the MockCartographer has. Everything it returns
 * goes through `validateProviderResponse` first, and the caller still decides
 * whether any of it becomes a deterministic event.
 */

/** Minimal structural type for the Workers AI binding. */
export interface WorkersAiBinding {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

/** Exactly one repair attempt is permitted, and only for malformed structure. */
export const MAX_REPAIR_ATTEMPTS = 1;

const MAX_OUTPUT_TOKENS = 700;
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * JSON Schema mirroring `cartographerTurnSchema`. Sent as `response_format` where
 * the model honours it. Zod remains authoritative either way — this is a hint to
 * the model, never a substitute for validation.
 */
export const CARTOGRAPHER_JSON_SCHEMA = {
  type: 'object',
  properties: {
    reply: { type: 'string' },
    nextQuestion: { type: 'string' },
    presentation: { type: 'string', enum: ['normal', 'quiet'] },
    evidence: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          dimension: { type: 'string' },
          claim: { type: 'string' },
          basis: { type: 'string', enum: ['explicit', 'example', 'inference', 'revision'] },
          strength: { type: 'integer', enum: [1, 2, 3] },
          territories: { type: 'array', items: { type: 'string' } }
        },
        required: ['dimension', 'claim', 'basis', 'strength', 'territories']
      }
    },
    connections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          evidenceIds: { type: 'array', items: { type: 'string' } },
          hypothesis: { type: 'string' },
          confidence: { type: 'string', enum: ['low', 'moderate', 'strong'] }
        },
        required: ['evidenceIds', 'hypothesis', 'confidence']
      }
    },
    quoteCandidates: { type: 'array', items: { type: 'string' } },
    summaryPatch: { type: 'string' },
    achievementCandidates: { type: 'array', items: { type: 'string' } }
  },
  required: ['reply', 'nextQuestion', 'presentation', 'evidence', 'connections', 'quoteCandidates', 'summaryPatch', 'achievementCandidates']
} as const;

const SASS_GUIDANCE: Record<string, string> = {
  low: 'Warm, plain and unshowy. No jokes at the player\'s expense.',
  medium: 'Dry wit is welcome. Never at the player\'s expense, never sarcastic about what they disclosed.',
  'risks-understood': 'Sharp and funny, aimed at the map and at yourself — never at the player. Cruelty is not sass.'
};

export function buildSystemPrompt(context: CartographerContext): string {
  const quiet = context.presentation === 'quiet';
  return [
    'You are the Cartographer in Atlas of One, mapping one person as terrain rather than scoring them.',
    'Return ONLY a JSON object matching the required schema. No prose outside the JSON.',
    ...context.agencyRules.map((rule) => `- ${rule}`),
    quiet
      ? 'The player has asked for SERIOUS mode. Be plain and quiet. No celebration, no flourish, no jokes.'
      : `Sass level: ${context.sass}. ${SASS_GUIDANCE[context.sass] ?? ''}`,
    context.retiredDimensions.length
      ? `Never ask about or refer to these retired dimensions: ${context.retiredDimensions.join(', ')}.`
      : 'No dimensions are retired yet.',
    'Evidence must quote or paraphrase what the player actually wrote. Use basis "inference" for anything you deduced, and keep ambiguity ambiguous.',
    'quoteCandidates must be exact substrings of the player answer, or an empty array.'
  ].join('\n');
}

export function buildUserPrompt(context: CartographerContext): string {
  return JSON.stringify(context);
}

/** Repair prompt for the single permitted retry. Structure only, never authority. */
function buildRepairPrompt(rawText: string, detail: string): string {
  return [
    'Your previous response could not be parsed as the required JSON object.',
    `Problem: ${detail}`,
    'Return the same content again as a single valid JSON object matching the schema, with no prose, no markdown fence and no commentary.',
    'Previous response follows between the markers.',
    '---BEGIN---',
    rawText.slice(0, 4000),
    '---END---'
  ].join('\n');
}

/**
 * Map an unknown thrown value onto a typed failure. Workers AI surfaces
 * different shapes for different faults; this is deliberately conservative and
 * falls back to a non-retryable network failure rather than guessing.
 *
 * NOTE: this mapping is written from Cloudflare's documented error vocabulary and
 * has NOT been exercised against a live account. Treat the specific code
 * discrimination as unverified.
 */
export function classifyProviderError(error: unknown): ProviderResult {
  const message = error instanceof Error ? error.message : String(error);
  const lowered = message.toLowerCase();

  if (lowered.includes('abort') || lowered.includes('timeout') || lowered.includes('timed out')) {
    return providerFailure('timeout', message, true);
  }
  // Quota is checked before rate limiting: both can surface as 429, and treating
  // an exhausted allocation as retryable would burn the next day's neurons too.
  if (lowered.includes('quota') || lowered.includes('daily limit') || lowered.includes('allocation') || lowered.includes('neuron')) {
    return providerFailure('quota-exhausted', message, false);
  }
  if (lowered.includes('429') || lowered.includes('rate limit') || lowered.includes('too many requests')) {
    return providerFailure('rate-limited', message, true);
  }
  if (lowered.includes('capacity') || lowered.includes('overloaded') || lowered.includes('503')) {
    return providerFailure('capacity', message, true);
  }
  if (lowered.includes('no such model') || lowered.includes('model not found') || lowered.includes('3040') || lowered.includes('unsupported model')) {
    return providerFailure('model-unavailable', message, false);
  }
  if (lowered.includes('unauthorized') || lowered.includes('authentication') || lowered.includes('403') || lowered.includes('401')) {
    return providerFailure('not-configured', message, false);
  }
  return providerFailure('network', message, true);
}

interface WorkersAiResponse {
  response?: unknown;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

const readUsage = (raw: unknown) => {
  const usage = (raw as WorkersAiResponse | null)?.usage;
  return { inputTokens: usage?.prompt_tokens ?? 0, outputTokens: usage?.completion_tokens ?? 0 };
};

const readText = (raw: unknown): unknown => {
  if (raw && typeof raw === 'object' && 'response' in raw) return (raw as WorkersAiResponse).response;
  return raw;
};

export interface WorkersAiProviderOptions {
  binding: WorkersAiBinding;
  modelId?: string;
  /** Injected in tests so timeout handling is exercised without waiting. */
  timeoutMs?: number;
}

export function createWorkersAiProvider(options: WorkersAiProviderOptions): AIProvider {
  const modelId = options.modelId ?? DEFAULT_MODEL_ID;
  const timeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;

  const call = async (messages: Array<{ role: string; content: string }>): Promise<unknown> => {
    const request = options.binding.run(modelId, {
      messages,
      max_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0.6,
      response_format: { type: 'json_schema', json_schema: CARTOGRAPHER_JSON_SCHEMA }
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(`Workers AI request timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    try {
      return await Promise.race([request, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  return {
    id: `workers-ai:${modelId}`,
    async turn(context: CartographerContext): Promise<ProviderResult> {
      const candidate = findCandidate(modelId);
      if (!candidate) return providerFailure('not-configured', `Model "${modelId}" is not in the eligible candidate registry.`);
      // A paid-plan model must be unreachable, not merely discouraged.
      if (!candidate.freePlanEligible) return providerFailure('not-configured', `Model "${modelId}" requires a paid plan and is refused by the zero-dollar rule.`);

      const system = buildSystemPrompt(context);
      const messages = [
        { role: 'system', content: system },
        { role: 'user', content: buildUserPrompt(context) }
      ];

      let raw: unknown;
      try {
        raw = await call(messages);
      } catch (error) {
        return classifyProviderError(error);
      }

      const usageTokens = readUsage(raw);
      const first = validateProviderResponse(readText(raw), context);
      if (first.ok) {
        return {
          ok: true,
          turn: first.turn,
          modelId,
          repaired: false,
          usage: { ...usageTokens, neurons: estimateNeurons(modelId, usageTokens.inputTokens, usageTokens.outputTokens) }
        };
      }

      // Semantic failure means the model overstepped an Atlas rule. Repairing that
      // would just be asking it to overstep more politely, so it is refused outright.
      if (first.stage === 'semantic') return providerFailure('semantic-invalid', first.detail, false);

      // Exactly one repair attempt, for structure only.
      const rawText = typeof readText(raw) === 'string' ? (readText(raw) as string) : JSON.stringify(readText(raw) ?? '');
      let repairedRaw: unknown;
      try {
        repairedRaw = await call([...messages, { role: 'assistant', content: rawText.slice(0, 4000) }, { role: 'user', content: buildRepairPrompt(rawText, first.detail) }]);
      } catch (error) {
        return classifyProviderError(error);
      }

      const repairUsage = readUsage(repairedRaw);
      const totalTokens = {
        inputTokens: usageTokens.inputTokens + repairUsage.inputTokens,
        outputTokens: usageTokens.outputTokens + repairUsage.outputTokens
      };
      const second = validateProviderResponse(readText(repairedRaw), context);
      if (second.ok) {
        return {
          ok: true,
          turn: second.turn,
          modelId,
          repaired: true,
          usage: { ...totalTokens, neurons: estimateNeurons(modelId, totalTokens.inputTokens, totalTokens.outputTokens) }
        };
      }
      // No second repair. The caller falls back to the deterministic local turn.
      if (second.stage === 'semantic') return providerFailure('semantic-invalid', second.detail, false);
      return providerFailure('repair-failed', `Repair attempt failed at ${second.stage}: ${second.detail}`, false);
    }
  };
}
