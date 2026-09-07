/**
 * Workers AI model configuration.
 *
 * This file is the ONE replaceable location for the production model id and for
 * the candidate registry the bakeoff scores. Nothing in `src/game/` may import
 * it: provider selection is a Cartographer concern and never enters deterministic
 * game logic.
 *
 * Every number below is transcribed from Cloudflare's published Workers AI model
 * and pricing documentation. `structuredOutput` records what the documentation
 * claims, not what a live request proved — see `liveProbe`.
 */

/** Cloudflare bills Workers AI in neurons at a published USD rate. */
export const USD_PER_1K_NEURONS = 0.011;

/**
 * Workers Free complimentary allocation. Exceeding it requires the Workers Paid
 * plan, which the zero-dollar rule forbids, so this is a hard ceiling and not a
 * soft budget: Atlas must degrade rather than cross it.
 */
export const FREE_NEURONS_PER_DAY = 10_000;

/**
 * How confident we are that a model honours `response_format: { type: 'json_schema' }`.
 *
 * - `legacy-json-mode`: named on Cloudflare's JSON Mode support page.
 * - `documented-parameter`: the model page lists `response_format` among its
 *   inputs and advertises function calling, but it is absent from the JSON Mode
 *   page. Treated as "probably works, must not be relied upon".
 * - `unknown`: neither source says anything.
 */
export type StructuredOutputSupport = 'legacy-json-mode' | 'documented-parameter' | 'unknown';

export interface ModelCandidate {
  id: string;
  label: string;
  /** Maximum context window in tokens, per the model's documentation page. */
  contextTokens: number;
  /** Published USD per million input tokens. */
  usdPerMillionInput: number;
  /** Published USD per million output tokens. */
  usdPerMillionOutput: number;
  /**
   * False when Cloudflare's pricing page lists the model as requiring the
   * Workers Paid plan or prepaid AI Gateway credits. Those are excluded outright.
   */
  freePlanEligible: boolean;
  structuredOutput: StructuredOutputSupport;
  /** Whether a real request has ever been made to this model from Atlas. */
  liveProbe: 'not-run' | 'passed' | 'failed';
  notes: string;
}

/**
 * Candidates verified to exist in the Workers AI catalogue. Models excluded for
 * requiring a paid plan are recorded in EXCLUDED_MODELS rather than silently
 * dropped, so the exclusion is auditable.
 */
export const MODEL_CANDIDATES: ModelCandidate[] = [
  {
    id: '@cf/google/gemma-4-26b-a4b-it',
    label: 'Gemma 4 26B A4B IT',
    contextTokens: 256_000,
    usdPerMillionInput: 0.1,
    usdPerMillionOutput: 0.3,
    freePlanEligible: true,
    structuredOutput: 'documented-parameter',
    liveProbe: 'failed',
    notes: 'Former provisional default. Failed live Stage A smoke test due to output token truncation (700 max_tokens exhausted across initial and repair attempts without completing JSON structure).'
  },
  {
    id: '@cf/zai-org/glm-4.7-flash',
    label: 'GLM 4.7 Flash',
    contextTokens: 131_072,
    usdPerMillionInput: 0.06,
    usdPerMillionOutput: 0.4,
    freePlanEligible: true,
    structuredOutput: 'documented-parameter',
    liveProbe: 'failed',
    notes: 'Failed live Stage A smoke test due to output token truncation (700 max_tokens exhausted across both attempts).'
  },
  {
    id: '@cf/openai/gpt-oss-20b',
    label: 'GPT-OSS 20B',
    contextTokens: 128_000,
    usdPerMillionInput: 0.2,
    usdPerMillionOutput: 0.3,
    freePlanEligible: true,
    structuredOutput: 'documented-parameter',
    liveProbe: 'failed',
    notes: 'Failed live Stage A smoke test: reasoning output exhausted the 700-token output limit before completing JSON structure.'
  },
  {
    id: '@cf/qwen/qwen3-30b-a3b-fp8',
    label: 'Qwen3 30B A3B FP8',
    contextTokens: 32_768,
    usdPerMillionInput: 0.051,
    usdPerMillionOutput: 0.34,
    freePlanEligible: true,
    structuredOutput: 'documented-parameter',
    liveProbe: 'passed',
    notes: 'Measured bakeoff winner. Passed Stage A smoke test, ranked #1 in Stage B with 0 privacy violations, and proved real-provider synthetic campaign in Stage C with valid JSON schema adherence.'
  },
  {
    id: '@cf/nvidia/nemotron-3-120b-a12b',
    label: 'Nemotron 3 120B A12B',
    contextTokens: 256_000,
    usdPerMillionInput: 0.5,
    usdPerMillionOutput: 1.5,
    freePlanEligible: true,
    structuredOutput: 'documented-parameter',
    liveProbe: 'failed',
    notes: 'Failed live Stage A smoke test structured output acceptance; per-turn cost also exceeds free daily allocation for 100 turns.'
  }
];

/** Models rejected before any request was considered, with the reason. */
export const EXCLUDED_MODELS: Array<{ id: string; reason: string }> = [
  { id: '@cf/zai-org/glm-5.2', reason: 'Workers Paid plan or prepaid AI Gateway credits required.' },
  { id: '@cf/zai-org/glm-5.3', reason: 'Workers Paid plan or prepaid AI Gateway credits required.' },
  { id: '@cf/zai-org/glm-5.3-flash', reason: 'Workers Paid plan or prepaid AI Gateway credits required.' },
  { id: '@cf/moonshotai/kimi-k2.6', reason: 'Workers Paid plan or prepaid AI Gateway credits required.' },
  { id: '@cf/moonshotai/kimi-k2.7-code', reason: 'Workers Paid plan or prepaid AI Gateway credits required.' },
  { id: '@cf/deepseek-ai/deepseek-v4-flash-0731', reason: 'Workers Paid plan or prepaid AI Gateway credits required.' },
  { id: '@cf/deepseek-ai/deepseek-v4-pro-0813', reason: 'Workers Paid plan or prepaid AI Gateway credits required.' },
  { id: '@cf/google/gemma-3-12b-it', reason: 'Deprecated in the Workers AI catalogue.' },
  { id: '@cf/meta/llama-3.1-8b-instruct', reason: 'Deprecated in the Workers AI catalogue.' }
];

/**
 * MEASURED winner of the live Workers AI bakeoff.
 * Replaced the provisional Gemma 4 26B configuration default after live measurement
 * proved Qwen3 30B is the only free-plan candidate to reliably generate valid
 * schema-constrained JSON within output token bounds and sustain real multi-turn campaigns.
 */
export const DEFAULT_MODEL_ID = '@cf/qwen/qwen3-30b-a3b-fp8';

export const findCandidate = (id: string): ModelCandidate | undefined =>
  MODEL_CANDIDATES.find((candidate) => candidate.id === id);

/** Eligible candidates only. A paid-plan model can never be reached from here. */
export const eligibleCandidates = (): ModelCandidate[] => MODEL_CANDIDATES.filter((candidate) => candidate.freePlanEligible);

const neuronsPerMillion = (usdPerMillion: number) => (usdPerMillion / USD_PER_1K_NEURONS) * 1000;

/** Neurons consumed by one request, derived from the model's published USD rate. */
export function estimateNeurons(modelId: string, inputTokens: number, outputTokens: number): number {
  const candidate = findCandidate(modelId);
  if (!candidate) return 0;
  const input = (inputTokens / 1_000_000) * neuronsPerMillion(candidate.usdPerMillionInput);
  const output = (outputTokens / 1_000_000) * neuronsPerMillion(candidate.usdPerMillionOutput);
  return Math.round((input + output) * 100) / 100;
}

/**
 * How many turns of a given shape fit inside one free day. Used to decide whether
 * a synthetic campaign of N turns is free-safe before any request is made.
 */
export function freeTurnsPerDay(modelId: string, inputTokens: number, outputTokens: number): number {
  const perTurn = estimateNeurons(modelId, inputTokens, outputTokens);
  return perTurn <= 0 ? 0 : Math.floor(FREE_NEURONS_PER_DAY / perTurn);
}
