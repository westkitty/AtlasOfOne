import type { CampaignState, EvidenceBasis, EvidenceRecord, PresentationMode, SassLevel } from '../game/types';

/**
 * The deterministic context compiler.
 *
 * Two properties matter more than anything else here:
 *
 * 1. PRIVATE EXCLUSION IS STRUCTURAL. A private dimension is filtered out while
 *    the context object is being built, so private material never exists inside
 *    the outgoing payload. Atlas does not send private content followed by an
 *    instruction to ignore it, because that is not privacy — it is a request.
 *
 * 2. THE CONTEXT IS BOUNDED. Selection is capped by the constants below, so a
 *    600-turn campaign compiles to roughly the same payload as a 40-turn one.
 *    Nothing here grows linearly with transcript length.
 *
 * Retracted material is excluded for the same reason private material is: the
 * player took it back.
 */

/** Explicit context budget. These are the only knobs that decide payload size. */
export const CONTEXT_BUDGET = {
  /** Recent conversational continuity, newest last. */
  recentTurns: 4,
  /** Characters kept from a recalled answer. The current answer is not truncated to this. */
  recalledAnswerChars: 280,
  /** Evidence directly relevant to the current dimension/territory. */
  relevantEvidence: 12,
  counterEvidence: 4,
  revisions: 4,
  contradictions: 4,
  confirmedInsights: 5,
  rejectedInsights: 5,
  /** Hard cap on the player's current answer. Long answers are the point, but not unbounded. */
  answerChars: 4000,
  claimChars: 240
} as const;

export interface CompiledEvidence {
  id: string;
  dimension: string;
  claim: string;
  basis: EvidenceBasis;
  strength: 1 | 2 | 3;
  territories: string[];
}

export interface CompiledTurn {
  dimension: string;
  question: string;
  answer: string;
  /** True when the recalled answer was truncated to fit the budget. */
  truncated: boolean;
}

export interface CompiledTerritory {
  id: string;
  label: string;
  status: string;
  covered: number;
  total: number;
}

export interface CompiledEncounter {
  kind: 'boss' | 'door';
  heading: string;
  step: string;
  /** Claims the player already produced, which the encounter wording must lean on. */
  evidenceClaims: string[];
}

export interface CartographerContext {
  /** Rules the model is told it may not step over. Mirrors the deterministic boundary. */
  agencyRules: string[];
  task: {
    kind: 'question' | 'boss-stage' | 'door';
    territoryId: string;
    territoryLabel: string;
    dimension: string;
    question: string;
    answer: string;
    answerTruncated: boolean;
  };
  campaign: {
    level: number;
    activeTerritoryStatus: string;
    coveredDimensions: string[];
    remainingDimensions: string[];
  };
  territories: CompiledTerritory[];
  recentTurns: CompiledTurn[];
  relevantEvidence: CompiledEvidence[];
  counterEvidence: CompiledEvidence[];
  revisions: CompiledEvidence[];
  contradictions: Array<{ claim: string; status: string }>;
  confirmedInsights: string[];
  rejectedInsights: string[];
  presentation: PresentationMode;
  sass: SassLevel;
  sessionStatus: 'active' | 'paused';
  encounter?: CompiledEncounter;
  /**
   * Dimensions the model must never ask about again. Only the DIMENSION LABELS
   * appear here — never the answers, evidence or claims behind them — because the
   * model has to know what not to ask without being handed what it must not see.
   */
  retiredDimensions: string[];
}

export interface CompileOptions {
  kind?: 'question' | 'boss-stage' | 'door';
  encounter?: CompiledEncounter;
}

const AGENCY_RULES = [
  'You propose language and evidence only. You never award or mention XP, levels, unlocks, achievements, quests, map fragments, territory completion or campaign completion.',
  'Evidence must be grounded in what the player actually wrote. Mark anything you inferred as an inference rather than stating it as fact.',
  'Preserve uncertainty. If the answer is ambiguous, say so instead of resolving it.',
  'Never restate, guess at, or circle back to a retired dimension.',
  'PASS, PRIVATE, STOP, SERIOUS, HELP and sass are always available to the player and are never earned.',
  'In quiet presentation, drop celebration entirely and stay plain.'
];

const clip = (value: string, limit: number) => (value.length > limit ? `${value.slice(0, limit)}…` : value);

/**
 * A single predicate deciding whether a dimension may leave this device.
 * Everything below routes through it, so there is one place to audit.
 */
const isPrivate = (state: CampaignState, dimension: string) => state.privateTopics.includes(dimension);

/**
 * The one definition of "may this material leave the device".
 *
 * Both outgoing payloads — the per-turn context and the final assessment context
 * — must answer that question the same way, so it is answered once, here.
 *
 * Privacy is decided by PROVENANCE, never by reading prose. A derived record
 * (an Insight, a Contradiction) is a *reading* of evidence, so it is exactly as
 * private as the evidence underneath it. Searching its wording for the name of a
 * private topic is not a boundary: a claim can be entirely about a private
 * dimension without ever naming it.
 *
 * A derived record with no evidence ids has no provenance to check, so it is
 * withheld rather than assumed safe.
 */
export interface EvidenceVisibility {
  /** True when the dimension has been marked PRIVATE by the player. */
  isPrivateDimension: (dimension: string) => boolean;
  /** Active, non-retracted evidence on a dimension the player has not closed. */
  visibleEvidence: EvidenceRecord[];
  /** Whether one evidence id resolves to a record that may travel. */
  evidenceIsVisible: (evidenceId: string) => boolean;
  /** Whether a derived record's whole provenance chain may travel. */
  derivedIsVisible: (evidenceIds: string[]) => boolean;
}

export function createEvidenceVisibility(state: CampaignState): EvidenceVisibility {
  const evidenceById = new Map(state.evidence.map((item) => [item.id, item]));
  const isPrivateDimension = (dimension: string) => isPrivate(state, dimension);

  // `status === 'active'` is what carries retraction: ANSWER_RETRACTED marks every
  // evidence record derived from the retracted turn as 'retracted'.
  const evidenceIsVisible = (evidenceId: string) => {
    const record = evidenceById.get(evidenceId);
    return Boolean(record) && record!.status === 'active' && !isPrivateDimension(record!.dimension);
  };

  return {
    isPrivateDimension,
    visibleEvidence: state.evidence.filter((item) => item.status === 'active' && !isPrivateDimension(item.dimension)),
    evidenceIsVisible,
    derivedIsVisible: (evidenceIds: string[]) => evidenceIds.length > 0 && evidenceIds.every(evidenceIsVisible)
  };
}

const compileEvidence = (record: { id: string; dimension: string; claim: string; basis: EvidenceBasis; strength: 1 | 2 | 3; territories: string[] }): CompiledEvidence => ({
  id: record.id,
  dimension: record.dimension,
  claim: clip(record.claim, CONTEXT_BUDGET.claimChars),
  basis: record.basis,
  strength: record.strength,
  territories: [...record.territories]
});

/**
 * Compile the outgoing provider context from authoritative local state.
 *
 * `answer` is the player's current answer. `question`/`dimension` describe the
 * task being answered. Nothing derived from a private or retracted record enters
 * the returned object.
 */
export function compileContext(
  state: CampaignState,
  task: { territoryId: string; dimension: string; question: string },
  answer: string,
  options: CompileOptions = {}
): CartographerContext {
  const territory = state.territories.find((item) => item.id === task.territoryId) ?? state.territories[0];

  // Everything downstream reads from these two filtered pools. Private and
  // retracted material is removed here, once, before any selection happens.
  const visibility = createEvidenceVisibility(state);
  const visibleEvidence = visibility.visibleEvidence;
  const visibleTurns = state.turns.filter((item) => !item.retracted && !isPrivate(state, item.dimension));

  const sameDimension = visibleEvidence.filter((item) => item.dimension === task.dimension);
  const sameTerritory = visibleEvidence.filter((item) => item.dimension !== task.dimension && item.territories.includes(territory.id));
  const elsewhere = visibleEvidence.filter((item) => item.dimension !== task.dimension && !item.territories.includes(territory.id));

  // Selection order is the documented priority: current-turn necessities first,
  // then directly relevant evidence, then everything else newest-first.
  const relevant = [...sameDimension, ...sameTerritory, ...elsewhere.slice().reverse()].slice(0, CONTEXT_BUDGET.relevantEvidence);

  const relevantIds = new Set(relevant.map((item) => item.id));
  const counterIds = new Set(relevant.flatMap((item) => item.counterEvidenceIds));
  const counter = visibleEvidence
    .filter((item) => (counterIds.has(item.id) && !relevantIds.has(item.id)) || item.status === 'contested')
    .slice(0, CONTEXT_BUDGET.counterEvidence);

  const revisions = visibleEvidence
    .filter((item) => item.basis === 'revision')
    .slice(-CONTEXT_BUDGET.revisions);

  /** An insight is withheld whenever any evidence behind it is private or gone. */
  const insightIsVisible = visibility.derivedIsVisible;

  const confirmedInsights = state.insights
    .filter((item) => item.status === 'confirmed' && insightIsVisible(item.evidenceIds))
    .slice(-CONTEXT_BUDGET.confirmedInsights)
    .map((item) => clip(item.summary, CONTEXT_BUDGET.claimChars));

  const rejectedInsights = state.insights
    .filter((item) => item.status === 'rejected' && insightIsVisible(item.evidenceIds))
    .slice(-CONTEXT_BUDGET.rejectedInsights)
    .map((item) => clip(item.title, CONTEXT_BUDGET.claimChars));

  const contradictions = state.contradictions
    .filter((item) => item.status === 'open' && insightIsVisible(item.evidenceIds))
    .slice(-CONTEXT_BUDGET.contradictions)
    .map((item) => ({ claim: clip(item.claim, CONTEXT_BUDGET.claimChars), status: item.status }));

  const recentTurns = visibleTurns.slice(-CONTEXT_BUDGET.recentTurns).map((item): CompiledTurn => ({
    dimension: item.dimension,
    question: item.question,
    answer: clip(item.answer, CONTEXT_BUDGET.recalledAnswerChars),
    truncated: item.answer.length > CONTEXT_BUDGET.recalledAnswerChars
  }));

  const trimmedAnswer = answer.trim();

  return {
    agencyRules: AGENCY_RULES,
    task: {
      kind: options.kind ?? 'question',
      territoryId: territory.id,
      territoryLabel: territory.label,
      dimension: task.dimension,
      question: task.question,
      answer: clip(trimmedAnswer, CONTEXT_BUDGET.answerChars),
      answerTruncated: trimmedAnswer.length > CONTEXT_BUDGET.answerChars
    },
    campaign: {
      level: state.level,
      activeTerritoryStatus: territory.status,
      coveredDimensions: territory.coveredDimensions.filter((dimension) => !isPrivate(state, dimension)),
      remainingDimensions: territory.requiredDimensions.filter(
        (dimension) => !territory.coveredDimensions.includes(dimension) && !isPrivate(state, dimension)
      )
    },
    territories: state.territories.map((item): CompiledTerritory => ({
      id: item.id,
      label: item.label,
      status: item.status,
      covered: item.coveredDimensions.filter((dimension) => !isPrivate(state, dimension)).length,
      total: item.requiredDimensions.filter((dimension) => !isPrivate(state, dimension)).length
    })),
    recentTurns,
    relevantEvidence: relevant.map(compileEvidence),
    counterEvidence: counter.map(compileEvidence),
    revisions: revisions.map(compileEvidence),
    contradictions,
    confirmedInsights,
    rejectedInsights,
    presentation: state.presentation,
    sass: state.settings.sass,
    sessionStatus: state.sessionStatus,
    encounter: options.encounter,
    retiredDimensions: [...state.privateTopics]
  };
}

/** Serialized size of the compiled context. Used by the boundedness test. */
export const contextSizeChars = (context: CartographerContext): number => JSON.stringify(context).length;

/**
 * Every free-text region of a compiled context, for privacy assertions.
 * `retiredDimensions` is excluded on purpose: it holds dimension LABELS the model
 * must avoid, never the private content itself.
 */
export function contextTextFragments(context: CartographerContext): string[] {
  return [
    context.task.question,
    context.task.answer,
    context.task.dimension,
    context.task.territoryLabel,
    ...context.campaign.coveredDimensions,
    ...context.campaign.remainingDimensions,
    ...context.territories.flatMap((item) => [item.id, item.label]),
    ...context.recentTurns.flatMap((item) => [item.dimension, item.question, item.answer]),
    ...[...context.relevantEvidence, ...context.counterEvidence, ...context.revisions].flatMap((item) => [item.dimension, item.claim]),
    ...context.contradictions.map((item) => item.claim),
    ...context.confirmedInsights,
    ...context.rejectedInsights,
    ...(context.encounter ? [context.encounter.heading, context.encounter.step, ...context.encounter.evidenceClaims] : [])
  ];
}

// ---------------------------------------------------------------------------
// Wire validation
//
// The Worker receives a compiled context from the browser. That is untrusted
// input like any other request body, so it is parsed rather than assumed. Bounds
// mirror CONTEXT_BUDGET so an oversized payload is rejected before it can be
// turned into an expensive provider request.
// ---------------------------------------------------------------------------

import { z } from 'zod';

const compiledEvidenceSchema = z.object({
  id: z.string(),
  dimension: z.string().min(1),
  claim: z.string(),
  basis: z.enum(['explicit', 'example', 'inference', 'revision']),
  strength: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  territories: z.array(z.string()).max(16)
});

export const cartographerContextSchema = z.object({
  agencyRules: z.array(z.string()).max(16),
  task: z.object({
    kind: z.enum(['question', 'boss-stage', 'door']),
    territoryId: z.string().min(1),
    territoryLabel: z.string(),
    dimension: z.string().min(1),
    question: z.string().min(1),
    answer: z.string().max(CONTEXT_BUDGET.answerChars + 1),
    answerTruncated: z.boolean()
  }),
  campaign: z.object({
    level: z.number().int().min(1).max(8),
    activeTerritoryStatus: z.string(),
    coveredDimensions: z.array(z.string()).max(32),
    remainingDimensions: z.array(z.string()).max(32)
  }),
  territories: z.array(z.object({ id: z.string(), label: z.string(), status: z.string(), covered: z.number(), total: z.number() })).max(32),
  recentTurns: z.array(z.object({ dimension: z.string(), question: z.string(), answer: z.string(), truncated: z.boolean() })).max(CONTEXT_BUDGET.recentTurns),
  relevantEvidence: z.array(compiledEvidenceSchema).max(CONTEXT_BUDGET.relevantEvidence),
  counterEvidence: z.array(compiledEvidenceSchema).max(CONTEXT_BUDGET.counterEvidence),
  revisions: z.array(compiledEvidenceSchema).max(CONTEXT_BUDGET.revisions),
  contradictions: z.array(z.object({ claim: z.string(), status: z.string() })).max(CONTEXT_BUDGET.contradictions),
  confirmedInsights: z.array(z.string()).max(CONTEXT_BUDGET.confirmedInsights),
  rejectedInsights: z.array(z.string()).max(CONTEXT_BUDGET.rejectedInsights),
  presentation: z.enum(['normal', 'quiet']),
  sass: z.enum(['low', 'medium', 'risks-understood']),
  sessionStatus: z.enum(['active', 'paused']),
  encounter: z.object({ kind: z.enum(['boss', 'door']), heading: z.string(), step: z.string(), evidenceClaims: z.array(z.string()).max(8) }).optional(),
  retiredDimensions: z.array(z.string()).max(64)
});
