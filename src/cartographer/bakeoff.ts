import type { CartographerContext } from './context';
import type { ProviderResult } from './provider';
import type { CartographerTurn } from './schema';
import { findAuthorityFields } from './validate';

/**
 * Atlas-specific bakeoff scoring.
 *
 * Everything here is MACHINE-MEASURED: it is computed from the response and the
 * context, with no judgement. Qualitative dimensions — whether the Cartographer
 * actually sounds like itself, whether a question is a good question — are left
 * as explicit nulls in `QualitativeScore` for a human to fill in, so a measured
 * number is never confused with an opinion.
 *
 * This harness runs against any provider. It does not require a live account,
 * which is what lets the scoring itself be tested offline.
 */

export interface MachineScore {
  fixtureId: string;
  modelId: string;
  /** The response decoded, validated and was accepted. */
  accepted: boolean;
  /** It took the one permitted repair attempt to get there. */
  repaired: boolean;
  failureCode?: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  neurons: number;
  /** Progression-looking fields present in the raw response. Should always be 0. */
  authorityFieldsSeen: number;
  /** A retired dimension appeared anywhere in the response. Should always be false. */
  privacyViolation: boolean;
  /** Quote candidates that are genuinely substrings of the player's answer. */
  quoteFidelity: number;
  /**
   * Lexical grounding of claims marked `explicit`: the share of a claim's
   * content words that also appear in the player's answer. A low score on an
   * `explicit` claim means the model asserted something the player did not say.
   */
  explicitClaimGrounding: number;
  /** Share of evidence marked as inference. High is not bad; unlabelled inference is. */
  inferenceRatio: number;
  /** The response preserved hedging where the player hedged. */
  uncertaintyPreserved: boolean;
  /** The next question repeats one already asked in the recent window. */
  repeatsRecentQuestion: boolean;
  evidenceCount: number;
  replyChars: number;
}

/** Left for a human. Never inferred, never auto-filled. */
export interface QualitativeScore {
  fixtureId: string;
  modelId: string;
  cartographerVoice: number | null;
  nextQuestionQuality: number | null;
  connectionQuality: number | null;
  sassControl: number | null;
  seriousBehaviour: number | null;
  notes: string | null;
}

const STOP_WORDS = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'if', 'is', 'are', 'was', 'were', 'to', 'of', 'in', 'on', 'it', 'that', 'this', 'i', 'you', 'my', 'me', 'for', 'as', 'at', 'be', 'with', 'not', 'they', 'them', 'so', 'what', 'when', 'do', 'does', 'has', 'have', 'would', 'which', 'their', 'there', 'from', 'by', 'about']);

/**
 * Light suffix stripping so "stalling" matches "stall". Without it the metric
 * punishes a model for ordinary paraphrase, which is not what it is measuring.
 */
const stem = (word: string): string =>
  word.replace(/(ingly|edly|ing|ies|ied|ed|es|ly|s)$/, '').replace(/(.)\1$/, '$1').replace(/e$/, '');

const contentWords = (text: string): string[] =>
  text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))
    .map(stem)
    .filter((word) => word.length > 2);

/** Share of a claim's content words that also occur in the source answer. */
export function lexicalGrounding(claim: string, answer: string): number {
  const claimWords = contentWords(claim);
  if (!claimWords.length) return 0;
  const answerWords = new Set(contentWords(answer));
  return claimWords.filter((word) => answerWords.has(word)).length / claimWords.length;
}

const HEDGES = /\b(may|might|could|perhaps|possibly|unclear|uncertain|ambiguous|not sure|unsure|unsettled|undecided|not settled|no clear|neither|not know|does not know|depends|varies|both|either|tentativ|provisional|seems|appears|suggests)\b/i;
const PLAYER_HEDGES = /\b(do not know|don't know|not sure|unsure|depends|sometimes|maybe|either|varies|would not call)\b/i;

const mean = (values: number[]) => (values.length ? values.reduce((total, value) => total + value, 0) / values.length : 1);

export interface ScoreInput {
  fixtureId: string;
  context: CartographerContext;
  result: ProviderResult;
  latencyMs: number;
  /** The raw provider payload, when available, so authority fields can be counted. */
  raw?: unknown;
}

export function scoreTurn({ fixtureId, context, result, latencyMs, raw }: ScoreInput): MachineScore {
  const base: MachineScore = {
    fixtureId,
    modelId: result.ok ? result.modelId : 'n/a',
    accepted: result.ok,
    repaired: result.ok ? result.repaired : false,
    failureCode: result.ok ? undefined : result.failure.code,
    latencyMs,
    inputTokens: result.ok ? (result.usage?.inputTokens ?? 0) : 0,
    outputTokens: result.ok ? (result.usage?.outputTokens ?? 0) : 0,
    neurons: result.ok ? (result.usage?.neurons ?? 0) : 0,
    authorityFieldsSeen: raw === undefined ? 0 : findAuthorityFields(raw).length,
    privacyViolation: false,
    quoteFidelity: 1,
    explicitClaimGrounding: 1,
    inferenceRatio: 0,
    uncertaintyPreserved: true,
    repeatsRecentQuestion: false,
    evidenceCount: 0,
    replyChars: 0
  };

  if (!result.ok) return base;

  const turn: CartographerTurn = result.turn;
  const answer = context.task.answer;
  const prose = [turn.reply, turn.nextQuestion, turn.summaryPatch, ...turn.evidence.map((item) => item.claim)].join(' ').toLowerCase();

  const explicit = turn.evidence.filter((item) => item.basis === 'explicit');
  const playerHedged = PLAYER_HEDGES.test(answer);

  return {
    ...base,
    privacyViolation: context.retiredDimensions.some((dimension) => dimension && prose.includes(dimension.toLowerCase())),
    quoteFidelity: turn.quoteCandidates.length
      ? turn.quoteCandidates.filter((quote) => answer.includes(quote.trim())).length / turn.quoteCandidates.length
      : 1,
    explicitClaimGrounding: mean(explicit.map((item) => lexicalGrounding(item.claim, answer))),
    inferenceRatio: turn.evidence.length ? turn.evidence.filter((item) => item.basis === 'inference').length / turn.evidence.length : 0,
    // Only meaningful when the player actually hedged; otherwise trivially true.
    uncertaintyPreserved: !playerHedged || HEDGES.test(prose),
    repeatsRecentQuestion: context.recentTurns.some((item) => item.question.trim() && item.question.trim() === turn.nextQuestion.trim()),
    evidenceCount: turn.evidence.length,
    replyChars: turn.reply.length
  };
}

export interface ModelSummary {
  modelId: string;
  runs: number;
  acceptRate: number;
  repairRate: number;
  privacyViolations: number;
  authorityAttempts: number;
  meanQuoteFidelity: number;
  meanExplicitGrounding: number;
  uncertaintyPreservedRate: number;
  repetitionRate: number;
  meanLatencyMs: number;
  totalNeurons: number;
  failureCodes: Record<string, number>;
}

/** Aggregate one model's scores into the row a bakeoff table needs. */
export function summarize(modelId: string, scores: MachineScore[]): ModelSummary {
  const runs = scores.length;
  const accepted = scores.filter((score) => score.accepted);
  const failureCodes: Record<string, number> = {};
  for (const score of scores) if (score.failureCode) failureCodes[score.failureCode] = (failureCodes[score.failureCode] ?? 0) + 1;

  return {
    modelId,
    runs,
    acceptRate: runs ? accepted.length / runs : 0,
    repairRate: runs ? scores.filter((score) => score.repaired).length / runs : 0,
    privacyViolations: scores.filter((score) => score.privacyViolation).length,
    authorityAttempts: scores.filter((score) => score.authorityFieldsSeen > 0).length,
    meanQuoteFidelity: mean(accepted.map((score) => score.quoteFidelity)),
    meanExplicitGrounding: mean(accepted.map((score) => score.explicitClaimGrounding)),
    uncertaintyPreservedRate: accepted.length ? accepted.filter((score) => score.uncertaintyPreserved).length / accepted.length : 0,
    repetitionRate: accepted.length ? accepted.filter((score) => score.repeatsRecentQuestion).length / accepted.length : 0,
    meanLatencyMs: mean(scores.map((score) => score.latencyMs)),
    totalNeurons: scores.reduce((total, score) => total + score.neurons, 0),
    failureCodes
  };
}

/**
 * Ranking weights, in the documented selection order. Privacy and evidence
 * fidelity dominate; latency and efficiency break ties. A model with ANY privacy
 * violation is disqualified rather than merely penalised.
 */
export function rank(summaries: ModelSummary[]): ModelSummary[] {
  const score = (row: ModelSummary) =>
    row.privacyViolations > 0
      ? -Infinity
      : row.meanExplicitGrounding * 4 +
        row.meanQuoteFidelity * 3 +
        row.acceptRate * 3 +
        row.uncertaintyPreservedRate * 2 -
        row.repairRate * 2 -
        row.repetitionRate;
  return [...summaries].sort((left, right) => score(right) - score(left));
}
