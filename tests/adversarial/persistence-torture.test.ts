import { describe, expect, it } from 'vitest';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';
import { generateLocalAssessment } from '../../src/cartographer/finalize';
import type { TurnRecord } from '../../src/game/types';

describe('Phase 5 Adversarial QA: Persistence Torture & Schema Invariants', () => {
  it('rejects corrupted or truncated JSON string during deserialization', () => {
    expect(() => deserializeCampaign('{"schemaVersion": 1, "player":')).toThrow();
    expect(() => deserializeCampaign('')).toThrow();
    expect(() => deserializeCampaign('null')).toThrow();
  });

  it('rejects payload with invalid schemaVersion', () => {
    const invalidVersion = JSON.stringify({
      ...createInitialCampaign(),
      schemaVersion: 99
    });
    expect(() => deserializeCampaign(invalidVersion)).toThrow();
  });

  it('rejects payload missing required player or territories arrays', () => {
    const missingPlayer = JSON.stringify({
      schemaVersion: 1,
      campaignId: 'test',
      territories: []
    });
    expect(() => deserializeCampaign(missingPlayer)).toThrow();
  });

  it('round-trips full campaign state containing final assessment with 100% fidelity', () => {
    let state = createInitialCampaign();
    const assessment = generateLocalAssessment(state);
    state = applyGameEvents(state, [{ type: 'FINAL_ASSESSMENT_SET', assessment }]);

    expect(state.finalAssessment).toBeDefined();

    const serialized = serializeCampaign(state);
    const restored = deserializeCampaign(serialized);

    expect(restored.campaignId).toBe(state.campaignId);
    expect(restored.finalAssessment).toBeDefined();
    expect(restored.finalAssessment?.id).toBe(assessment.id);
    expect(restored.finalAssessment?.whoIsGreyson).toBe(assessment.whoIsGreyson);
    expect(restored.finalAssessment?.temperament.title).toBe(assessment.temperament.title);
  });

  it('retraction marks turn retracted, marks derived evidence retracted, and recomputes territory coverage', () => {
    let state = createInitialCampaign();
    const turnRecord: TurnRecord = {
      id: 'turn_test_retract',
      createdAt: new Date().toISOString(),
      territoryId: 'identity',
      dimension: 'self',
      question: 'Who are you?',
      answer: 'I am a deliberate mapper.',
      substantive: true,
      behavioralExample: false,
      revision: false,
      retracted: false
    };

    state = applyGameEvents(state, [
      { type: 'ANSWER_ACCEPTED', turn: turnRecord },
      {
        type: 'EVIDENCE_ADDED',
        evidence: {
          id: 'ev_1',
          dimension: 'self',
          claim: 'Values deliberate self-mapping',
          sourceTurnIds: ['turn_test_retract'],
          basis: 'explicit',
          strength: 2,
          territories: ['identity'],
          counterEvidenceIds: [],
          status: 'active',
          origin: 'player-stated'
        }
      }
    ]);

    expect(state.turns[0].retracted).toBe(false);
    expect(state.evidence[0].status).toBe('active');

    // Retract the turn
    state = applyGameEvents(state, [{ type: 'ANSWER_RETRACTED', turnId: 'turn_test_retract' }]);

    expect(state.turns[0].retracted).toBe(true);
    expect(state.evidence[0].status).toBe('retracted');

    const identityTerritory = state.territories.find((t) => t.id === 'identity');
    expect(identityTerritory?.coveredDimensions).not.toContain('self');
  });
});
