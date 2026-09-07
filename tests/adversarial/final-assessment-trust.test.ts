import { describe, expect, it } from 'vitest';
import {
  compileFinalizeContext,
  generateLocalAssessment,
  validateFinalAssessment,
  type FinalAssessment
} from '../../src/cartographer/finalize';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, ContradictionRecord, EvidenceRecord, InsightRecord, TurnRecord } from '../../src/game/types';
import worker from '../../worker/index';

/**
 * Final Assessment trust boundary.
 *
 * Every test here drives the real exported production function or the real
 * Worker route. None of them re-implements the guard it is checking, because a
 * test that reproduces the algorithm and then tests the reproduction proves
 * only that the test author can write the algorithm twice.
 *
 * All player material below is synthetic.
 */

const iso = new Date('2026-01-01T00:00:00.000Z').toISOString();

const turn = (over: Partial<TurnRecord> & { id: string; dimension: string; answer: string }): TurnRecord => ({
  createdAt: iso,
  territoryId: 'identity',
  question: 'Synthetic question?',
  substantive: true,
  behavioralExample: false,
  revision: false,
  retracted: false,
  ...over
});

const evidence = (over: Partial<EvidenceRecord> & { id: string; dimension: string; claim: string; sourceTurnIds: string[] }): EvidenceRecord => ({
  basis: 'explicit',
  strength: 3,
  territories: ['identity'],
  counterEvidenceIds: [],
  status: 'active',
  origin: 'player-stated',
  ...over
});

const insight = (over: Partial<InsightRecord> & { id: string; title: string; summary: string; evidenceIds: string[] }): InsightRecord => ({
  confidence: 'moderate',
  status: 'confirmed',
  createdAt: iso,
  ...over
});

/** Contradictions have no producing event yet, so they are seeded onto real state. */
const withContradictions = (state: CampaignState, contradictions: ContradictionRecord[]): CampaignState =>
  ({ ...state, contradictions });

describe('Final Assessment trust boundary: provenance-based privacy', () => {
  it('1. CANARY: an Insight derived from PRIVATE evidence never reaches the finalize context', () => {
    const canary = 'CANARY_PRIVATE_INSIGHT_9f3a2b';
    let state = createInitialCampaign();

    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn: turn({ id: 't_open', dimension: 'temperament', answer: 'I slow down before deciding.' }) },
      { type: 'EVIDENCE_ADDED', evidence: evidence({ id: 'ev_open', dimension: 'temperament', claim: 'Deliberates before deciding', sourceTurnIds: ['t_open'] }) },
      { type: 'ANSWER_ACCEPTED', turn: turn({ id: 't_priv', dimension: 'private_life', answer: 'Synthetic private answer.' }) },
      { type: 'EVIDENCE_ADDED', evidence: evidence({ id: 'ev_priv', dimension: 'private_life', claim: 'Synthetic private claim', sourceTurnIds: ['t_priv'] }) },
      // The Insight itself never names the dimension. Only its provenance betrays it.
      { type: 'INSIGHT_ADDED', insight: insight({ id: 'ins_priv', title: 'A reading', summary: `Derived hypothesis ${canary}`, evidenceIds: ['ev_priv'] }) },
      { type: 'PRIVATE_TOPIC_ADDED', topic: 'private_life' }
    ]);

    const serialized = JSON.stringify(compileFinalizeContext(state));

    expect(serialized).not.toContain(canary);
    // The visible half must still travel, so this is exclusion and not a blanket refusal.
    expect(serialized).toContain('Deliberates before deciding');
  });

  it('2. CANARY: a contradiction whose PROSE never names the private dimension is still excluded', () => {
    const canary = 'CANARY_PRIVATE_CONTRADICTION_71c4de';
    let state = createInitialCampaign();

    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn: turn({ id: 't_priv', dimension: 'private_life', answer: 'Synthetic private answer.' }) },
      { type: 'EVIDENCE_ADDED', evidence: evidence({ id: 'ev_priv', dimension: 'private_life', claim: 'Synthetic private claim', sourceTurnIds: ['t_priv'] }) },
      { type: 'PRIVATE_TOPIC_ADDED', topic: 'private_life' }
    ]);

    // Deliberately contains no substring of "private_life": prose matching cannot see it.
    state = withContradictions(state, [
      { id: 'con_priv', claim: `Tension recorded as ${canary}`, evidenceIds: ['ev_priv'], status: 'open' }
    ]);

    expect(state.contradictions[0].claim.toLowerCase()).not.toContain('private_life');

    const serialized = JSON.stringify(compileFinalizeContext(state));
    expect(serialized).not.toContain(canary);

    const assessment = JSON.stringify(generateLocalAssessment(state));
    expect(assessment).not.toContain(canary);
  });

  it('3. CANARY: derived records built on RETRACTED evidence never reach finalization', () => {
    const canary = 'CANARY_RETRACTED_DERIVATION_004ab1';
    let state = createInitialCampaign();

    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn: turn({ id: 't_ret', dimension: 'temperament', answer: 'Synthetic answer later withdrawn.' }) },
      { type: 'EVIDENCE_ADDED', evidence: evidence({ id: 'ev_ret', dimension: 'temperament', claim: 'Claim from withdrawn answer', sourceTurnIds: ['t_ret'] }) },
      { type: 'INSIGHT_ADDED', insight: insight({ id: 'ins_ret', title: 'Reading', summary: `Derived from withdrawn material ${canary}`, evidenceIds: ['ev_ret'] }) }
    ]);

    state = withContradictions(state, [
      { id: 'con_ret', claim: `Tension ${canary}`, evidenceIds: ['ev_ret'], status: 'open' }
    ]);

    // Before retraction the derived material is legitimately visible.
    expect(JSON.stringify(compileFinalizeContext(state))).toContain(canary);

    state = applyGameEvents(state, [{ type: 'ANSWER_RETRACTED', turnId: 't_ret' }]);

    expect(JSON.stringify(compileFinalizeContext(state))).not.toContain(canary);
    expect(JSON.stringify(generateLocalAssessment(state))).not.toContain(canary);
  });

  it('4. a derived record with no provenance at all is withheld rather than assumed safe', () => {
    const canary = 'CANARY_NO_PROVENANCE_5512aa';
    let state = createInitialCampaign();
    state = applyGameEvents(state, [
      { type: 'INSIGHT_ADDED', insight: insight({ id: 'ins_orphan', title: 'Orphan', summary: `Unsourced claim ${canary}`, evidenceIds: [] }) }
    ]);
    state = withContradictions(state, [{ id: 'con_orphan', claim: `Unsourced tension ${canary}`, evidenceIds: [], status: 'open' }]);

    expect(JSON.stringify(compileFinalizeContext(state))).not.toContain(canary);
  });
});

describe('Final Assessment trust boundary: no offline fabrication', () => {
  it('5. a zero-evidence campaign receives no invented personality reading', () => {
    const assessment = generateLocalAssessment(createInitialCampaign());

    // No fabricated structures.
    expect(assessment.contradictionsAndTensions).toEqual([]);
    expect(assessment.frameworkEstimates).toEqual([]);
    expect(assessment.representativeQuotes).toEqual([]);

    // No confident domain claims, and no inference without evidence beneath it.
    const domains = [
      assessment.temperament, assessment.valuesAndMorals, assessment.politicalAndIdeology,
      assessment.relationshipsAndSocial, assessment.cognitiveStyle, assessment.interestsAndPreferences,
      assessment.fearsAndHopes, assessment.idealFutureAndAmbition
    ];
    for (const domain of domains) {
      expect(domain.supportedInferences).toEqual([]);
      expect(domain.summary.toLowerCase()).toContain('not yet sufficiently mapped');
    }

    // The specific fabrications that used to ship, named so they cannot return.
    const serialized = JSON.stringify(assessment);
    for (const fabrication of [
      'integrity, fairness, and thoughtful agency',
      'social liberty, systemic fairness',
      'deliberate autonomy with intentional loyalty',
      'treats revision as data',
      'responsive nuance and self-awareness',
      'Balancing self-reliant autonomy',
      'Big Five',
      'High Openness',
      'Empirical-Reflective',
      'Coordinates in progress',
      'multi-dimensional thinker'
    ]) {
      expect(serialized, `fabricated content returned: ${fabrication}`).not.toContain(fabrication);
    }

    // And it says so plainly instead.
    expect(assessment.whoIsGreyson).toContain('does not yet have enough mapped evidence');
  });

  it('6. a grounded campaign reports real evidence and does not spread it across unrelated domains', () => {
    let state = createInitialCampaign();
    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn: turn({ id: 't_pol', dimension: 'authority', answer: 'Synthetic answer about institutions and accountability.' }) },
      { type: 'EVIDENCE_ADDED', evidence: evidence({ id: 'ev_pol', dimension: 'authority', claim: 'Treats unearned authority sceptically', sourceTurnIds: ['t_pol'], territories: ['politics'] }) },
      { type: 'INSIGHT_ADDED', insight: insight({ id: 'ins_pol', title: 'Authority reading', summary: 'Sceptical of unaccountable power', evidenceIds: ['ev_pol'] }) },
      { type: 'ANSWER_ACCEPTED', turn: turn({ id: 't_priv', dimension: 'private_life', answer: 'Synthetic private answer.' }) },
      { type: 'EVIDENCE_ADDED', evidence: evidence({ id: 'ev_priv', dimension: 'private_life', claim: 'PRIVATE_DOMAIN_CANARY_a71b', sourceTurnIds: ['t_priv'] }) },
      { type: 'PRIVATE_TOPIC_ADDED', topic: 'private_life' }
    ]);

    const assessment = generateLocalAssessment(state);

    // Real evidence lands in its own domain...
    expect(assessment.politicalAndIdeology.establishedEvidence).toContain('Treats unearned authority sceptically');
    expect(assessment.politicalAndIdeology.supportedInferences.length).toBeGreaterThanOrEqual(1);

    // ...and nowhere else. The old implementation repeated every Insight under all eight headings.
    expect(assessment.temperament.supportedInferences).toEqual([]);
    expect(assessment.temperament.establishedEvidence).toEqual(['No explicit evidence recorded on this axis yet.']);

    // Private material stays out entirely.
    expect(JSON.stringify(assessment)).not.toContain('PRIVATE_DOMAIN_CANARY_a71b');

    // whoIsGreyson is grounded in counts the campaign can prove.
    expect(assessment.whoIsGreyson).toContain('strictly by what this campaign recorded');
    expect(assessment.whoIsGreyson).not.toContain('does not yet have enough mapped evidence');
  });

  it('7. the deterministic local assessment always passes its own semantic validator', () => {
    let state = createInitialCampaign();
    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn: turn({ id: 't_a', dimension: 'temperament', answer: 'I slow down and ask what an option costs.' }) },
      { type: 'EVIDENCE_ADDED', evidence: evidence({ id: 'ev_a', dimension: 'temperament', claim: 'Weighs costs before acting', sourceTurnIds: ['t_a'] }) }
    ]);

    for (const candidate of [createInitialCampaign(), state]) {
      const result = validateFinalAssessment(generateLocalAssessment(candidate), compileFinalizeContext(candidate));
      expect(result.ok, result.ok ? '' : result.problems.join(' ')).toBe(true);
    }
  });
});

describe('Final Assessment trust boundary: remote semantic validation', () => {
  /** A grounded, schema-valid assessment produced by production code. */
  const groundedFixture = () => {
    let state = createInitialCampaign();
    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn: turn({ id: 't_a', dimension: 'temperament', answer: 'I slow down and ask what an option costs.' }) },
      { type: 'EVIDENCE_ADDED', evidence: evidence({ id: 'ev_a', dimension: 'temperament', claim: 'Weighs costs before acting', sourceTurnIds: ['t_a'] }) }
    ]);
    return { state, context: compileFinalizeContext(state), assessment: generateLocalAssessment(state) };
  };

  const envReturning = (assessment: FinalAssessment) => ({
    AI: { run: async () => ({ response: JSON.stringify(assessment) }) }
  }) as unknown as Parameters<typeof worker.fetch>[1];

  const postFinalize = (context: unknown, env: Parameters<typeof worker.fetch>[1]) =>
    worker.fetch(new Request('https://atlas.local/api/finalize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(context)
    }), env);

  it('8. accepts a grounded assessment through the real /api/finalize route', async () => {
    const { context, assessment } = groundedFixture();
    const response = await postFinalize(context, envReturning(assessment));
    expect(response.status).toBe(200);
    const body = await response.json() as { ok: boolean; assessment?: unknown };
    expect(body.ok).toBe(true);
    expect(body.assessment).toBeDefined();
  });

  it('9. rejects a schema-valid assessment carrying an invented quotation', async () => {
    const { context, assessment } = groundedFixture();
    const forged: FinalAssessment = {
      ...assessment,
      representativeQuotes: ['"I have never said this sentence in my life."']
    };

    const response = await postFinalize(context, envReturning(forged));
    expect(response.status).toBe(422);
    const body = await response.json() as { ok: boolean; code: string; assessment?: unknown };
    expect(body.ok).toBe(false);
    expect(body.code).toBe('semantic-invalid');
    // Nothing partial escapes: no assessment is returned for the client to apply.
    expect(body.assessment).toBeUndefined();
  });

  it('10. rejects a schema-valid assessment that names a topic the player closed', async () => {
    let state = createInitialCampaign();
    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn: turn({ id: 't_a', dimension: 'temperament', answer: 'I slow down and ask what an option costs.' }) },
      { type: 'EVIDENCE_ADDED', evidence: evidence({ id: 'ev_a', dimension: 'temperament', claim: 'Weighs costs before acting', sourceTurnIds: ['t_a'] }) },
      { type: 'PRIVATE_TOPIC_ADDED', topic: 'bereavement' }
    ]);
    const context = compileFinalizeContext(state);
    const assessment = generateLocalAssessment(state);

    const forged: FinalAssessment = {
      ...assessment,
      fearsAndHopes: { ...assessment.fearsAndHopes, summary: 'Shaped in part by bereavement, which recurs across the map.' }
    };

    const response = await postFinalize(context, envReturning(forged));
    expect(response.status).toBe(422);
    expect((await response.json() as { code: string }).code).toBe('semantic-invalid');
  });

  it('11. rejects a schema-valid assessment that narrates progression', async () => {
    const { context, assessment } = groundedFixture();
    const forged: FinalAssessment = {
      ...assessment,
      temperament: { ...assessment.temperament, summary: 'Strong work here — achievement unlocked for finishing this axis.' }
    };

    const response = await postFinalize(context, envReturning(forged));
    expect(response.status).toBe(422);
    expect((await response.json() as { code: string }).code).toBe('semantic-invalid');
  });

  it('12. rejects a framework estimate offered without its caveat', async () => {
    const { context, assessment } = groundedFixture();
    const forged: FinalAssessment = {
      ...assessment,
      frameworkEstimates: [{ framework: 'Big Five', estimate: 'High Openness, low Neuroticism.', caveat: '   ' }]
    };

    const response = await postFinalize(context, envReturning(forged));
    expect(response.status).toBe(422);
    expect((await response.json() as { code: string }).code).toBe('semantic-invalid');
  });

  it('13. a rejected assessment mutates no campaign state and awards no progression', async () => {
    const { state, context, assessment } = groundedFixture();
    const before = JSON.stringify(state);
    const xpBefore = state.xp;
    const levelBefore = state.level;

    const forged: FinalAssessment = { ...assessment, representativeQuotes: ['"Invented sentence."'] };
    const response = await postFinalize(context, envReturning(forged));

    expect(response.status).toBe(422);
    // The refusal changes nothing at all: no partial write, no assessment, no progression.
    expect(JSON.stringify(state)).toBe(before);
    expect(state.finalAssessment ?? null).toBeNull();
    expect(state.xp).toBe(xpBefore);
    expect(state.level).toBe(levelBefore);
  });
});
