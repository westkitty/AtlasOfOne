import { z } from 'zod';
import type { CampaignState, EvidenceRecord, InsightRecord } from '../game/types';
import { createEvidenceVisibility, type EvidenceVisibility } from './context';
import { findAuthorityFields, PROGRESSION_CLAIMS } from './validate';

export const assessmentDomainSectionSchema = z.object({
  title: z.string(),
  summary: z.string(),
  establishedEvidence: z.array(z.string()),
  supportedInferences: z.array(z.object({
    hypothesis: z.string(),
    confidence: z.enum(['low', 'moderate', 'strong'])
  })),
  openQuestionsAndUncertainty: z.array(z.string())
});
export type AssessmentDomainSection = z.infer<typeof assessmentDomainSectionSchema>;

export const contradictionEntrySchema = z.object({
  tension: z.string(),
  evidence: z.array(z.string()),
  status: z.enum(['open', 'reconciled'])
});
export type ContradictionEntry = z.infer<typeof contradictionEntrySchema>;

export const frameworkEstimateSchema = z.object({
  framework: z.string(),
  estimate: z.string(),
  caveat: z.string()
});
export type FrameworkEstimate = z.infer<typeof frameworkEstimateSchema>;

export const finalAssessmentSchema = z.object({
  id: z.string(),
  generatedAt: z.string(),
  provider: z.string(),
  whoIsGreyson: z.string().min(1),
  temperament: assessmentDomainSectionSchema,
  valuesAndMorals: assessmentDomainSectionSchema,
  politicalAndIdeology: assessmentDomainSectionSchema,
  relationshipsAndSocial: assessmentDomainSectionSchema,
  cognitiveStyle: assessmentDomainSectionSchema,
  interestsAndPreferences: assessmentDomainSectionSchema,
  fearsAndHopes: assessmentDomainSectionSchema,
  idealFutureAndAmbition: assessmentDomainSectionSchema,
  contradictionsAndTensions: z.array(contradictionEntrySchema),
  frameworkEstimates: z.array(frameworkEstimateSchema),
  representativeQuotes: z.array(z.string()),
  openQuestions: z.array(z.string())
});
export type FinalAssessment = z.infer<typeof finalAssessmentSchema>;

export const finalizeContextSchema = z.object({
  territorySummaries: z.array(z.object({
    id: z.string(),
    label: z.string(),
    status: z.string(),
    coveredDimensions: z.array(z.string())
  })),
  evidence: z.array(z.object({
    dimension: z.string(),
    claim: z.string(),
    basis: z.string(),
    strength: z.number(),
    origin: z.string()
  })),
  insights: z.array(z.object({
    title: z.string(),
    summary: z.string(),
    confidence: z.string(),
    status: z.string()
  })),
  contradictions: z.array(z.object({
    claim: z.string(),
    status: z.string()
  })),
  revisions: z.array(z.string()),
  representativeQuotes: z.array(z.string()),
  privateTopics: z.array(z.string())
});
export type FinalizeContext = z.infer<typeof finalizeContextSchema>;

/**
 * Compiles the context for final assessment synthesis.
 * CANARY RULE: Private topics and retracted turns/evidence are structurally omitted.
 */
export function compileFinalizeContext(state: CampaignState): FinalizeContext {
  // Same boundary the per-turn context uses, so the two payloads cannot drift.
  const visibility = createEvidenceVisibility(state);
  const isPrivate = visibility.isPrivateDimension;

  const territorySummaries = state.territories.map((t) => ({
    id: t.id,
    label: t.label,
    status: t.status,
    coveredDimensions: t.coveredDimensions.filter((d) => !isPrivate(d))
  }));

  const activeEvidence = visibility.visibleEvidence.map((e) => ({
    dimension: e.dimension,
    claim: e.claim,
    basis: e.basis,
    strength: e.strength,
    origin: e.origin
  }));

  // An Insight is a reading of evidence, so it is exactly as private as the
  // evidence beneath it. Status alone says nothing about privacy.
  const activeInsights = state.insights
    .filter((i) => i.status !== 'rejected' && visibility.derivedIsVisible(i.evidenceIds))
    .map((i) => ({
      title: i.title,
      summary: i.summary,
      confidence: i.confidence,
      status: i.status
    }));

  // Provenance, not prose. A contradiction can be entirely about a private
  // dimension without ever naming it, so its wording is not the boundary.
  const contradictions = state.contradictions
    .filter((c) => visibility.derivedIsVisible(c.evidenceIds))
    .map((c) => ({ claim: c.claim, status: c.status }));

  const revisions = state.turns
    .filter((t) => t.revision && !t.retracted && !isPrivate(t.dimension))
    .map((t) => `Dimension ${t.dimension}: revised answer`);

  const representativeQuotes = state.turns
    .filter((t) => t.substantive && !t.retracted && !isPrivate(t.dimension) && t.answer.trim().length > 10)
    .slice(-6)
    .map((t) => t.answer.trim().slice(0, 160));

  return {
    territorySummaries,
    evidence: activeEvidence,
    insights: activeInsights,
    contradictions,
    revisions,
    representativeQuotes,
    privateTopics: [...state.privateTopics]
  };
}

const DOMAIN_DIMENSIONS: Record<string, string[]> = {
  temperament: ['identity', 'temperament', 'conflict', 'vulnerability', 'strengths'],
  valuesAndMorals: ['morals', 'ethics', 'justice', 'responsibility', 'values'],
  politicalAndIdeology: [
    'politics', 'ideology', 'authority', 'state', 'democracy', 'economics',
    'property', 'labor', 'speech', 'institutions', 'borders', 'social-liberty',
    'equality', 'environment', 'technology', 'change'
  ],
  relationshipsAndSocial: ['relationships', 'social', 'community', 'attachment', 'trust'],
  cognitiveStyle: ['cognitive', 'logic', 'intuition', 'reflection', 'revision', 'doubt'],
  interestsAndPreferences: ['interests', 'preferences', 'art', 'curiosity', 'craft'],
  fearsAndHopes: ['fears', 'hopes', 'aversions', 'anxieties', 'aspirations'],
  idealFutureAndAmbition: ['future', 'ambition', 'work', 'legacy', 'purpose']
};

/** Does an evidence dimension belong to this assessment domain? */
function dimensionMatchesDomain(dimension: string, domainKey: string): boolean {
  const allowed = DOMAIN_DIMENSIONS[domainKey] ?? [];
  return allowed.includes(dimension) || allowed.some((dim) => dimension.includes(dim));
}

/** Claims from already-visible evidence that belong to this domain. */
function claimsForDomain(visibleEvidence: EvidenceRecord[], domainKey: string): string[] {
  return visibleEvidence
    .filter((e) => dimensionMatchesDomain(e.dimension, domainKey))
    .map((e) => e.claim);
}

/**
 * Inferences for one domain.
 *
 * An Insight reaches a domain only when its own provenance is visible AND that
 * provenance actually sits in the domain. The previous implementation ignored
 * the domain entirely and repeated the first three Insights under all eight
 * headings, which both fabricated relevance and carried private material.
 */
function inferencesForDomain(
  insights: InsightRecord[],
  visibility: EvidenceVisibility,
  evidenceById: Map<string, EvidenceRecord>,
  domainKey: string
): Array<{ hypothesis: string; confidence: 'low' | 'moderate' | 'strong' }> {
  return insights
    .filter((i) => i.status !== 'rejected' && visibility.derivedIsVisible(i.evidenceIds))
    .filter((i) => i.evidenceIds.some((id) => {
      const record = evidenceById.get(id);
      return Boolean(record) && dimensionMatchesDomain(record!.dimension, domainKey);
    }))
    .slice(0, 3)
    .map((i) => ({ hypothesis: `${i.title}: ${i.summary}`, confidence: i.confidence }));
}

/**
 * Local deterministic synthesizer fallback.
 *
 * It runs offline, and it is what the player sees whenever the remote synthesis
 * is unavailable or refused — so it is held to the same standard as the model:
 * it reports what the campaign actually recorded and says so plainly when the
 * campaign recorded nothing.
 *
 * It states no personality conclusion, invents no contradiction, estimates no
 * psychometric profile and fabricates no quotation. An empty axis is reported as
 * an empty axis. Silence is the honest output for an unmapped campaign, and a
 * confident paragraph would be a lie with the player's name on it.
 */
export function generateLocalAssessment(state: CampaignState): FinalAssessment {
  const visibility = createEvidenceVisibility(state);
  const visibleEvidence = visibility.visibleEvidence;
  const evidenceById = new Map(state.evidence.map((item) => [item.id, item]));
  const visibleClaimById = new Map(visibleEvidence.map((item) => [item.id, item.claim]));

  const buildSection = (key: string, title: string, openQ: string): AssessmentDomainSection => {
    const claims = claimsForDomain(visibleEvidence, key);
    const inferences = inferencesForDomain(state.insights, visibility, evidenceById, key);
    return {
      title,
      summary: claims.length > 0
        ? `Mapped through ${claims.length} recorded position${claims.length > 1 ? 's' : ''}.`
        : 'Not yet sufficiently mapped. No recorded evidence sits on this axis, so Atlas draws no conclusion here.',
      establishedEvidence: claims.length > 0 ? claims : ['No explicit evidence recorded on this axis yet.'],
      // Empty is correct and expected. An inference with no evidence under it is
      // not a weak inference; it is an invention.
      supportedInferences: inferences,
      openQuestionsAndUncertainty: [openQ]
    };
  };

  const temperament = buildSection(
    'temperament',
    'Personality and Temperament',
    'How do stress and high demands shift baseline interaction style?'
  );

  const valuesAndMorals = buildSection(
    'valuesAndMorals',
    'Values and Moral Architecture',
    'Under acute resource constraints, which foundational values take priority?'
  );

  const politicalAndIdeology = buildSection(
    'politicalAndIdeology',
    'Political Constellation and Ideology',
    'What institutional reforms are viewed as viable short-term compromises?'
  );

  const relationshipsAndSocial = buildSection(
    'relationshipsAndSocial',
    'Relationships and Social World',
    'What conditions make vulnerability in social circles easiest to sustain?'
  );

  const cognitiveStyle = buildSection(
    'cognitiveStyle',
    'Cognitive Style and Revision',
    'Which domains prompt the fastest willingness to reverse a conclusion?'
  );

  const interestsAndPreferences = buildSection(
    'interestsAndPreferences',
    'Interests and Aesthetic Preferences',
    'What unexplored mediums or topics generate latent curiosity?'
  );

  const fearsAndHopes = buildSection(
    'fearsAndHopes',
    'Fears and Hopes',
    'Which protective habits might outlive their original purpose?'
  );

  const idealFutureAndAmbition = buildSection(
    'idealFutureAndAmbition',
    'Ideal Future and Ambition',
    'What steps feel most urgent in shaping the next expedition phase?'
  );

  // Only contradictions the campaign actually recorded, each carrying its OWN
  // evidence rather than whichever two claims happened to be first. No default.
  const contradictionsAndTensions: ContradictionEntry[] = state.contradictions
    .filter((c) => visibility.derivedIsVisible(c.evidenceIds))
    .map((c) => ({
      tension: c.claim,
      evidence: c.evidenceIds.map((id) => visibleClaimById.get(id)).filter((claim): claim is string => Boolean(claim)),
      status: c.status === 'open' ? 'open' as const : 'reconciled' as const
    }));

  // The deterministic synthesizer has no principled basis for a Big Five or any
  // other psychometric reading, so it offers none. A schema slot is not evidence.
  const frameworkEstimates: FrameworkEstimate[] = [];

  // Real player words only. No placeholder is ever presented as a quotation.
  const representativeQuotes = state.turns
    .filter((t) => t.substantive && !t.retracted && !visibility.isPrivateDimension(t.dimension) && t.answer.trim().length > 15)
    .slice(-5)
    .map((t) => `"${t.answer.trim()}"`);

  const uncompletedTerritories = state.territories.filter((t) => t.status !== 'charted' && t.status !== 'deeply-charted');
  const openQuestions = uncompletedTerritories.length > 0
    ? uncompletedTerritories.map((t) => `Territory "${t.label}" remains in ${t.status} state, holding unmapped coordinates.`)
    : ['All primary territories charted. Ongoing discovery continues through deeper life revisions.'];

  const chartedCount = state.territories.length - uncompletedTerritories.length;
  const coveredDimensions = new Set(visibleEvidence.map((item) => item.dimension));

  // Grounded in counts the campaign can prove, or an explicit statement that it
  // cannot be written yet. Never a character reading dressed as a summary.
  const whoIsGreyson = visibleEvidence.length === 0
    ? `Atlas does not yet have enough mapped evidence to write a responsible synthesis of Greyson (${state.player.pronouns}). Nothing here is a conclusion about who he is — the coordinates simply have not been charted yet.`
    : `Greyson (${state.player.pronouns}) is described here strictly by what this campaign recorded: ${visibleEvidence.length} visible piece${visibleEvidence.length > 1 ? 's' : ''} of evidence across ${coveredDimensions.size} dimension${coveredDimensions.size > 1 ? 's' : ''}, with ${chartedCount} of ${state.territories.length} territories charted. What follows reports those coordinates and the uncertainty around them, and nothing beyond them.`;

  return {
    id: `assessment_${crypto.randomUUID()}`,
    generatedAt: new Date().toISOString(),
    provider: 'local-synthesizer',
    whoIsGreyson,
    temperament,
    valuesAndMorals,
    politicalAndIdeology,
    relationshipsAndSocial,
    cognitiveStyle,
    interestsAndPreferences,
    fearsAndHopes,
    idealFutureAndAmbition,
    contradictionsAndTensions,
    frameworkEstimates,
    representativeQuotes,
    openQuestions
  };
}

/**
 * Semantic validation for a Final Assessment.
 *
 * `finalAssessmentSchema` proves the SHAPE is right. It cannot prove the content
 * is honest, and the final assessment is the single most sensitive artifact
 * Atlas produces: it is long, it is about a real person, it is kept, and it is
 * printed. So the same discipline the per-turn path applies in
 * `validateProviderResponse` is applied here, adapted to this contract.
 *
 * A `CartographerTurn` validator cannot be reused directly — the shapes are
 * unrelated — so the shared primitives are reused instead and the rules are
 * restated for this contract.
 *
 * Like the turn path, a semantic failure is NEVER repaired. The response is
 * discarded and the caller falls back to the deterministic local synthesis.
 */
export type FinalAssessmentValidation = { ok: true } | { ok: false; problems: string[] };

/** Every string anywhere in the assessment, so no field escapes the scan. */
function collectStrings(value: unknown, out: string[] = []): string[] {
  if (typeof value === 'string') { out.push(value); return out; }
  if (Array.isArray(value)) { value.forEach((item) => collectStrings(item, out)); return out; }
  if (value && typeof value === 'object') { Object.values(value).forEach((item) => collectStrings(item, out)); }
  return out;
}

/** Compare quotations by content, ignoring wrapping punctuation and spacing. */
const normalizeQuote = (value: string) =>
  value.trim().replace(/^["'“”‘’\s]+|["'“”‘’\s]+$/g, '').replace(/\s+/g, ' ').toLowerCase();

export function validateFinalAssessment(assessment: FinalAssessment, context: FinalizeContext): FinalAssessmentValidation {
  const problems: string[] = [];
  const prose = collectStrings(assessment);

  // 1. A topic the player closed must not resurface anywhere in the synthesis.
  //    The labels travel in the context so the model can avoid them; using one is
  //    a refusal to avoid it.
  for (const topic of context.privateTopics) {
    const needle = topic.trim().toLowerCase();
    if (!needle) continue;
    if (prose.some((text) => text.toLowerCase().includes(needle))) {
      problems.push(`Private topic "${topic}" resurfaced in the final assessment.`);
    }
  }

  // 2. A quotation must be the player's words. The eligible set is exactly what
  //    the finalize context supplied; anything else is invented speech attributed
  //    to a real person.
  const eligible = context.representativeQuotes.map(normalizeQuote).filter(Boolean);
  for (const quote of assessment.representativeQuotes) {
    const candidate = normalizeQuote(quote);
    if (!candidate) continue;
    const grounded = eligible.some((source) => source.includes(candidate) || candidate.includes(source));
    if (!grounded) problems.push('Representative quote is not grounded in the player\'s recorded answers.');
  }

  // 3. The model owns no progression and must not narrate any, here either.
  for (const text of prose) {
    for (const pattern of PROGRESSION_CLAIMS) {
      if (pattern.test(text)) problems.push(`Final assessment narrated progression: ${pattern}`);
    }
  }

  // 4. Progression-shaped fields are stripped by Zod; an attempt is still refused
  //    rather than silently accepted.
  const authorityFields = findAuthorityFields(assessment);
  if (authorityFields.length) problems.push(`Final assessment carried authority fields: ${authorityFields.join(', ')}.`);

  // 5. MODEL_CONTRACT requires a framework estimate to be visibly a working
  //    hypothesis. An uncaveated estimate reads as a diagnosis.
  for (const estimate of assessment.frameworkEstimates) {
    if (!estimate.caveat.trim()) problems.push(`Framework estimate "${estimate.framework}" carried no caveat.`);
    if (!estimate.framework.trim() || !estimate.estimate.trim()) problems.push('Framework estimate was empty.');
  }

  const unique = [...new Set(problems)];
  return unique.length ? { ok: false, problems: unique } : { ok: true };
}
