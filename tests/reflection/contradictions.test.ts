import { describe, expect, it } from 'vitest';
import { applyGameEvents, createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, EvidenceRecord, TurnRecord } from '../../src/game/types';
import { buildContradictionRecord } from '../../src/reflection/contradictions';

const turn = (id: string, dimension: string): TurnRecord => ({
  id,
  createdAt: '2026-01-02T03:00:00.000Z',
  territoryId: 'identity',
  dimension,
  question: 'Synthetic question?',
  answer: 'Synthetic answer.',
  substantive: true,
  behavioralExample: false,
  revision: false,
  retracted: false
});

const evidence = (
  id: string,
  claim: string,
  dimension: string,
  sourceTurnId: string
): EvidenceRecord => ({
  id,
  dimension,
  claim,
  sourceTurnIds: [sourceTurnId],
  basis: 'explicit',
  strength: 2,
  territories: ['identity'],
  counterEvidenceIds: [],
  status: 'active',
  origin: 'player-stated'
});

function fixtureState(): CampaignState {
  const state = createInitialCampaign();
  const turnA = turn('turn_a', 'risk');
  const turnB = turn('turn_b', 'risk');
  return {
    ...state,
    turns: [turnA, turnB],
    evidence: [
      evidence('ev_a', 'I usually avoid unnecessary risk.', 'risk', turnA.id),
      evidence('ev_b', 'I will take a serious risk to protect someone.', 'risk', turnB.id)
    ]
  };
}

describe('deterministic contradiction construction (RF06)', () => {
  it('builds an open contradiction from two distinct active visible supported claims', () => {
    const state = fixtureState();
    const record = buildContradictionRecord(state, {
      id: 'contradiction_risk',
      claim: 'Risk tolerance changes when another person needs protection.',
      evidenceIds: ['ev_b', 'ev_a']
    });

    expect(record).toEqual({
      id: 'contradiction_risk',
      claim: 'Risk tolerance changes when another person needs protection.',
      evidenceIds: ['ev_a', 'ev_b'],
      status: 'open'
    });
    expect(state.contradictions).toEqual([]);
  });

  it('rejects missing, duplicate-only, private, retracted, or inactive evidence', () => {
    const state = fixtureState();

    expect(() => buildContradictionRecord(state, {
      id: 'c_missing',
      claim: 'Synthetic relation.',
      evidenceIds: ['ev_a', 'missing']
    })).toThrow('Unknown EvidenceRecord id: missing');

    expect(() => buildContradictionRecord(state, {
      id: 'c_duplicate',
      claim: 'Synthetic relation.',
      evidenceIds: ['ev_a', 'ev_a']
    })).toThrow('at least two distinct evidence sources');

    expect(() => buildContradictionRecord({
      ...state,
      privateTopics: ['risk']
    }, {
      id: 'c_private',
      claim: 'Synthetic relation.',
      evidenceIds: ['ev_a', 'ev_b']
    })).toThrow('Ineligible EvidenceRecord id');

    const retracted = applyGameEvents(state, [
      { type: 'ANSWER_RETRACTED', turnId: 'turn_b' }
    ]);
    expect(retracted.turns.find((item) => item.id === 'turn_b')?.retracted).toBe(true);
    expect(retracted.evidence.find((item) => item.id === 'ev_b')?.status).toBe('retracted');
    expect(() => buildContradictionRecord(retracted, {
      id: 'c_retracted',
      claim: 'Synthetic relation.',
      evidenceIds: ['ev_a', 'ev_b']
    })).toThrow('Ineligible EvidenceRecord id: ev_b');

    expect(() => buildContradictionRecord({
      ...state,
      evidence: state.evidence.map((item) =>
        item.id === 'ev_b' ? { ...item, status: 'contested' as const } : item
      )
    }, {
      id: 'c_inactive',
      claim: 'Synthetic relation.',
      evidenceIds: ['ev_a', 'ev_b']
    })).toThrow('Ineligible EvidenceRecord id: ev_b');
  });

  it('refuses byte-identical source claims rather than inventing a contradiction', () => {
    const state = fixtureState();
    state.evidence[1] = { ...state.evidence[1], claim: state.evidence[0].claim };

    expect(() => buildContradictionRecord(state, {
      id: 'c_same_claim',
      claim: 'Synthetic relation.',
      evidenceIds: ['ev_a', 'ev_b']
    })).toThrow('at least two distinct supported claims');
  });

  it('is idempotent for an already-recorded evidence set and does not rewrite history', () => {
    const state = fixtureState();
    const existing = {
      id: 'contradiction_existing',
      claim: 'Existing historical wording.',
      evidenceIds: ['ev_a', 'ev_b'],
      status: 'open' as const
    };
    state.contradictions = [existing];

    const result = buildContradictionRecord(state, {
      id: 'contradiction_new_attempt',
      claim: 'New wording should not duplicate the same relationship.',
      evidenceIds: ['ev_b', 'ev_a']
    });

    expect(result).toBe(existing);
    expect(state.contradictions).toEqual([existing]);
  });

  it('allows exact retry of an existing ID but refuses an ID collision with different content', () => {
    const state = fixtureState();
    const existing = {
      id: 'contradiction_existing',
      claim: 'Existing historical wording.',
      evidenceIds: ['ev_a', 'ev_b'],
      status: 'open' as const
    };
    state.contradictions = [existing];

    expect(buildContradictionRecord(state, {
      id: existing.id,
      claim: existing.claim,
      evidenceIds: ['ev_b', 'ev_a']
    })).toBe(existing);

    expect(() => buildContradictionRecord(state, {
      id: existing.id,
      claim: 'Different wording.',
      evidenceIds: ['ev_a', 'ev_b']
    })).toThrow('Contradiction id already exists');
  });

  it('rejects empty IDs/claims and never mutates the candidate evidence list', () => {
    const state = fixtureState();
    const ids = ['ev_b', 'ev_a'];

    expect(() => buildContradictionRecord(state, {
      id: '   ',
      claim: 'Synthetic.',
      evidenceIds: ids
    })).toThrow('id must not be empty');

    expect(() => buildContradictionRecord(state, {
      id: 'c_empty',
      claim: '   ',
      evidenceIds: ids
    })).toThrow('claim must not be empty');

    buildContradictionRecord(state, {
      id: 'c_valid',
      claim: 'Synthetic relation.',
      evidenceIds: ids
    });
    expect(ids).toEqual(['ev_b', 'ev_a']);
  });
});
