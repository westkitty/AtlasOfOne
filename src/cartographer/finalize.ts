import { z } from 'zod';
import type { CampaignState, EvidenceRecord, InsightRecord, TurnRecord } from '../game/types';

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
  const isPrivate = (dim: string) => state.privateTopics.includes(dim);

  const territorySummaries = state.territories.map((t) => ({
    id: t.id,
    label: t.label,
    status: t.status,
    coveredDimensions: t.coveredDimensions.filter((d) => !isPrivate(d))
  }));

  const activeEvidence = state.evidence
    .filter((e) => e.status === 'active' && !isPrivate(e.dimension))
    .map((e) => ({
      dimension: e.dimension,
      claim: e.claim,
      basis: e.basis,
      strength: e.strength,
      origin: e.origin
    }));

  const activeInsights = state.insights
    .filter((i) => i.status !== 'rejected')
    .map((i) => ({
      title: i.title,
      summary: i.summary,
      confidence: i.confidence,
      status: i.status
    }));

  const contradictions = state.contradictions
    .filter((c) => !state.privateTopics.some((p) => c.claim.toLowerCase().includes(p.toLowerCase())))
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

function filterEvidenceForDomain(evidence: EvidenceRecord[], privateTopics: string[], domainKey: string): string[] {
  const allowed = DOMAIN_DIMENSIONS[domainKey] ?? [];
  return evidence
    .filter((e) => e.status === 'active' && !privateTopics.includes(e.dimension) && (allowed.includes(e.dimension) || allowed.some((dim) => e.dimension.includes(dim))))
    .map((e) => e.claim);
}

function filterInferencesForDomain(insights: InsightRecord[], domainKey: string): Array<{ hypothesis: string; confidence: 'low' | 'moderate' | 'strong' }> {
  const allowed = DOMAIN_DIMENSIONS[domainKey] ?? [];
  return insights
    .filter((i) => i.status !== 'rejected')
    .slice(0, 3)
    .map((i) => ({ hypothesis: `${i.title}: ${i.summary}`, confidence: i.confidence }));
}

/**
 * Local deterministic synthesizer fallback.
 * Operates completely offline, respects all private dimensions, and preserves
 * epistemic separation between evidence, hypotheses, and open questions.
 */
export function generateLocalAssessment(state: CampaignState): FinalAssessment {
  const privateTopics = state.privateTopics;
  const activeEvidence = state.evidence.filter((e) => e.status === 'active' && !privateTopics.includes(e.dimension));
  const confirmedInsights = state.insights.filter((i) => i.status === 'confirmed');

  const buildSection = (key: string, title: string, fallbackSummary: string, openQ: string): AssessmentDomainSection => {
    const claims = filterEvidenceForDomain(activeEvidence, privateTopics, key);
    const inferences = filterInferencesForDomain(state.insights, key);
    return {
      title,
      summary: claims.length > 0
        ? `Mapped through ${claims.length} recorded position${claims.length > 1 ? 's' : ''}.`
        : fallbackSummary,
      establishedEvidence: claims.length > 0 ? claims : ['No explicit claims recorded on this axis yet.'],
      supportedInferences: inferences.length > 0 ? inferences : [{ hypothesis: `Initial observations on ${title.toLowerCase()} remain provisional.`, confidence: 'low' }],
      openQuestionsAndUncertainty: [openQ]
    };
  };

  const temperament = buildSection(
    'temperament',
    'Personality and Temperament',
    'Temperament is characterized by responsive nuance and self-awareness.',
    'How do stress and high demands shift baseline interaction style?'
  );

  const valuesAndMorals = buildSection(
    'valuesAndMorals',
    'Values and Moral Architecture',
    'Values emphasize integrity, fairness, and thoughtful agency.',
    'Under acute resource constraints, which foundational values take priority?'
  );

  const politicalAndIdeology = buildSection(
    'politicalAndIdeology',
    'Political Constellation and Ideology',
    'Political view balances social liberty, systemic fairness, and skepticism of unearned authority.',
    'What institutional reforms are viewed as viable short-term compromises?'
  );

  const relationshipsAndSocial = buildSection(
    'relationshipsAndSocial',
    'Relationships and Social World',
    'Relationship dynamics balance deliberate autonomy with intentional loyalty.',
    'What conditions make vulnerability in social circles easiest to sustain?'
  );

  const cognitiveStyle = buildSection(
    'cognitiveStyle',
    'Cognitive Style and Revision',
    'Cognitive approach treats revision as data and resists hasty over-generalization.',
    'Which domains prompt the fastest willingness to reverse a conclusion?'
  );

  const interestsAndPreferences = buildSection(
    'interestsAndPreferences',
    'Interests and Aesthetic Preferences',
    'Expresses specific personal crafts, ideas, and curiosities.',
    'What unexplored mediums or topics generate latent curiosity?'
  );

  const fearsAndHopes = buildSection(
    'fearsAndHopes',
    'Fears and Hopes',
    'Hopes center on meaningful autonomy and constructive connection; aversions focus on stagnation and disingenuousness.',
    'Which protective habits might outlive their original purpose?'
  );

  const idealFutureAndAmbition = buildSection(
    'idealFutureAndAmbition',
    'Ideal Future and Ambition',
    'Ambitions look toward purposeful self-determination and meaningful creative expression.',
    'What steps feel most urgent in shaping the next expedition phase?'
  );

  const contradictionsAndTensions: ContradictionEntry[] = state.contradictions.length > 0
    ? state.contradictions
        .filter((c) => !privateTopics.some((p) => c.claim.toLowerCase().includes(p.toLowerCase())))
        .map((c) => ({
          tension: c.claim,
          evidence: activeEvidence.slice(0, 2).map((e) => e.claim),
          status: c.status === 'open' ? 'open' as const : 'reconciled' as const
        }))
    : [{
        tension: 'Balancing self-reliant autonomy with deep communal interdependence',
        evidence: activeEvidence.slice(0, 2).map((e) => e.claim),
        status: 'open'
      }];

  const frameworkEstimates: FrameworkEstimate[] = [
    {
      framework: 'Big Five Perspective (Working Estimate)',
      estimate: 'High Openness to experience; High Agreeableness with firm boundary-setting; Moderate-to-high Conscientiousness.',
      caveat: 'Estimates are descriptive working models, not rigid types, facts, or clinical diagnoses.'
    },
    {
      framework: 'Cognitive & Epistemic Orientation',
      estimate: 'Empirical-Reflective: updates models readily when presented with concrete examples and self-correction.',
      caveat: 'Exploratory framework lens; actual reasoning shifts flexibly based on context.'
    }
  ];

  const representativeQuotes = state.turns
    .filter((t) => t.substantive && !t.retracted && !privateTopics.includes(t.dimension) && t.answer.trim().length > 15)
    .slice(-5)
    .map((t) => `"${t.answer.trim()}"`);

  const uncompletedTerritories = state.territories.filter((t) => t.status !== 'charted' && t.status !== 'deeply-charted');
  const openQuestions = uncompletedTerritories.length > 0
    ? uncompletedTerritories.map((t) => `Territory "${t.label}" remains in ${t.status} state, holding unmapped coordinates.`)
    : ['All primary territories charted. Ongoing discovery continues through deeper life revisions.'];

  const whoIsGreyson = `Greyson (${state.player.pronouns}) is a multi-dimensional thinker whose map reveals an architecture of deliberate autonomy, genuine fairness, and reflective inquiry. Rather than conforming to a single static label, Greyson's coordinates demonstrate a capacity to hold tensions with nuance, treat revisions as valuable data, and maintain authentic boundaries while remaining open to meaningful connection.`;

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
    representativeQuotes: representativeQuotes.length > 0 ? representativeQuotes : ['"Coordinates in progress."'],
    openQuestions
  };
}
