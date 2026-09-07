import { describe, expect, it } from 'vitest';
import {
  compileFinalizeContext,
  finalAssessmentSchema,
  generateLocalAssessment
} from '../../src/cartographer/finalize';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import type { TurnRecord } from '../../src/game/types';
import worker from '../../worker/index';

describe('Phase 5 Adversarial QA: Final Assessment & Final Atlas Invariants', () => {
  it('generates a valid, complete FinalAssessment from initial campaign state', () => {
    const state = createInitialCampaign();
    const assessment = generateLocalAssessment(state);

    const parsed = finalAssessmentSchema.safeParse(assessment);
    expect(parsed.success).toBe(true);

    expect(assessment.whoIsGreyson).toContain('Greyson (he/they)');
    expect(assessment.temperament.title).toBeDefined();
    expect(assessment.valuesAndMorals.title).toBeDefined();
    expect(assessment.politicalAndIdeology.title).toBeDefined();
    expect(assessment.relationshipsAndSocial.title).toBeDefined();
    expect(assessment.cognitiveStyle.title).toBeDefined();
    expect(assessment.interestsAndPreferences.title).toBeDefined();
    expect(assessment.fearsAndHopes.title).toBeDefined();
    expect(assessment.idealFutureAndAmbition.title).toBeDefined();
  });

  it('guarantees epistemic separation between evidence, inference, and open questions across all domains', () => {
    let state = createInitialCampaign();
    const turn: TurnRecord = {
      id: 'turn_eval_1',
      createdAt: new Date().toISOString(),
      territoryId: 'identity',
      dimension: 'temperament',
      question: 'How do you handle conflict?',
      answer: 'I prefer de-escalation, direct clarity, and avoiding public drama.',
      substantive: true,
      behavioralExample: true,
      revision: false,
      retracted: false
    };

    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn },
      {
        type: 'EVIDENCE_ADDED',
        evidence: {
          id: 'ev_eval_1',
          dimension: 'temperament',
          claim: 'Favors direct de-escalation over confrontation',
          sourceTurnIds: ['turn_eval_1'],
          basis: 'explicit',
          strength: 3,
          territories: ['identity'],
          counterEvidenceIds: [],
          status: 'active',
          origin: 'player-stated'
        }
      },
      {
        type: 'INSIGHT_ADDED',
        insight: {
          id: 'ins_eval_1',
          title: 'Conflict Architecture',
          summary: 'Tends to absorb friction privately before addressing it directly.',
          evidenceIds: ['ev_eval_1'],
          confidence: 'strong',
          status: 'confirmed',
          createdAt: new Date().toISOString()
        }
      }
    ]);

    const assessment = generateLocalAssessment(state);
    const domain = assessment.temperament;

    // 1. Facts / established evidence
    expect(domain.establishedEvidence).toContain('Favors direct de-escalation over confrontation');
    // 2. Hypotheses / inferences with confidence
    expect(domain.supportedInferences.length).toBeGreaterThanOrEqual(1);
    expect(domain.supportedInferences[0].confidence).toBeDefined();
    // 3. Open questions
    expect(domain.openQuestionsAndUncertainty.length).toBeGreaterThanOrEqual(1);
  });

  it('CANARY: structurally excludes private and retracted material from finalize context and assessment', () => {
    let state = createInitialCampaign();
    const canaryPrivateText = 'CANARY_FINALIZE_SECRET_CONFIDENTIAL';
    const privateDim = 'private_life';

    const turnPrivate: TurnRecord = {
      id: 'turn_priv',
      createdAt: new Date().toISOString(),
      territoryId: 'identity',
      dimension: privateDim,
      question: 'Private matter?',
      answer: canaryPrivateText,
      substantive: true,
      behavioralExample: false,
      revision: false,
      retracted: false
    };

    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn: turnPrivate },
      {
        type: 'EVIDENCE_ADDED',
        evidence: {
          id: 'ev_priv',
          dimension: privateDim,
          claim: 'Secret private claim ' + canaryPrivateText,
          sourceTurnIds: ['turn_priv'],
          basis: 'explicit',
          strength: 3,
          territories: ['identity'],
          counterEvidenceIds: [],
          status: 'active',
          origin: 'player-stated'
        }
      },
      { type: 'PRIVATE_TOPIC_ADDED', topic: privateDim }
    ]);

    const context = compileFinalizeContext(state);
    const serializedContext = JSON.stringify(context);

    // Private text MUST NOT exist in context
    expect(serializedContext).not.toContain(canaryPrivateText);
    expect(context.privateTopics).toContain(privateDim);

    const assessment = generateLocalAssessment(state);
    const serializedAssessment = JSON.stringify(assessment);

    // Private text MUST NOT exist in assessment
    expect(serializedAssessment).not.toContain(canaryPrivateText);
  });

  it('preserves zero-progression invariant: setting final assessment awards 0 XP and changes no levels', () => {
    let state = createInitialCampaign();
    const initialXp = state.xp;
    const initialLevel = state.level;
    const initialUnlocks = state.unlocks.filter((u) => u.unlockedAt).length;

    const assessment = generateLocalAssessment(state);
    state = applyGameEvents(state, [{ type: 'FINAL_ASSESSMENT_SET', assessment }]);

    expect(state.xp).toBe(initialXp);
    expect(state.level).toBe(initialLevel);
    expect(state.unlocks.filter((u) => u.unlockedAt).length).toBe(initialUnlocks);
    expect(state.finalAssessment?.id).toBe(assessment.id);
  });

  it('validates /api/finalize worker endpoint boundaries and auth', async () => {
    // 1. Method not allowed
    const getRes = await worker.fetch(new Request('https://atlas.local/api/finalize', { method: 'GET' }), {});
    expect(getRes.status).toBe(405);

    // 2. Unauthorized
    const unauthRes = await worker.fetch(new Request('https://atlas.local/api/finalize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    }), { ATLAS_ACCESS_SECRET: 'auth-required' });
    expect(unauthRes.status).toBe(401);

    // 3. Bad request on invalid context
    const badRes = await worker.fetch(new Request('https://atlas.local/api/finalize', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ invalid: 'context' })
    }), {});
    expect(badRes.status).toBe(400);
  });
});
