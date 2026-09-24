import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, EvidenceRecord } from '../../src/game/types';
import {
  contradictionRecordFromCandidate,
  selectNewContradictionCandidates
} from '../../src/reflection/contradictions';

const evidence = (
  id: string,
  claim: string,
  counterEvidenceIds: string[] = [],
  overrides: Partial<EvidenceRecord> = {}
): EvidenceRecord => ({
  id,
  dimension: 'self-description',
  claim,
  sourceTurnIds: [],
  basis: 'explicit',
  strength: 2,
  territories: ['identity'],
  counterEvidenceIds,
  status: 'active',
  origin: 'player-stated',
  ...overrides
});

function stateWithEvidence(records: EvidenceRecord[]): CampaignState {
  return { ...createInitialCampaign(), evidence: records };
}

describe('deterministic contradiction candidates (RF06)', () => {
  it('creates one neutral candidate from an explicit counter-evidence edge', () => {
    const state = stateWithEvidence([
      evidence('ev_a', 'I like routines.', ['ev_b']),
      evidence('ev_b', 'I dislike being boxed into routines.')
    ]);

    expect(selectNewContradictionCandidates(state)).toEqual([{
      id: 'contradiction_candidate_ev_a__ev_b',
      evidenceIds: ['ev_a', 'ev_b'],
      claim: 'Both active claims remain on record: "I like routines." / "I dislike being boxed into routines.".'
    }]);
  });

  it('does not infer contradiction from dramatic or opposite-sounding prose without an explicit edge', () => {
    const state = stateWithEvidence([
      evidence('ev_a', 'I always want company.'),
      evidence('ev_b', 'I never want company.')
    ]);

    expect(selectNewContradictionCandidates(state)).toEqual([]);
  });

  it('accepts a one-way counterlink but deduplicates the pair deterministically', () => {
    const oneWay = stateWithEvidence([
      evidence('ev_b', 'Second claim.'),
      evidence('ev_a', 'First claim.', ['ev_b'])
    ]);
    const mutual = stateWithEvidence([
      evidence('ev_b', 'Second claim.', ['ev_a']),
      evidence('ev_a', 'First claim.', ['ev_b'])
    ]);

    expect(selectNewContradictionCandidates(oneWay).map((item) => item.id))
      .toEqual(['contradiction_candidate_ev_a__ev_b']);
    expect(selectNewContradictionCandidates(mutual).map((item) => item.id))
      .toEqual(['contradiction_candidate_ev_a__ev_b']);
  });

  it('fails closed when either side is private or retracted', () => {
    const privateState = stateWithEvidence([
      evidence('ev_a', 'A.', ['ev_b']),
      evidence('ev_b', 'B.', [], { dimension: 'private-dimension' })
    ]);
    privateState.privateTopics = ['private-dimension'];

    const retractedState = stateWithEvidence([
      evidence('ev_a', 'A.', ['ev_b']),
      evidence('ev_b', 'B.', [], { status: 'retracted' })
    ]);

    expect(selectNewContradictionCandidates(privateState)).toEqual([]);
    expect(selectNewContradictionCandidates(retractedState)).toEqual([]);
  });

  it('does not recreate a pair already represented in contradiction history', () => {
    const state = stateWithEvidence([
      evidence('ev_a', 'A.', ['ev_b']),
      evidence('ev_b', 'B.')
    ]);
    state.contradictions = [{
      id: 'old_contradiction',
      claim: 'Historical contradiction.',
      evidenceIds: ['ev_b', 'ev_a'],
      status: 'resolved'
    }];

    expect(selectNewContradictionCandidates(state)).toEqual([]);
  });

  it('returns stable ordering and does not mutate evidence or contradictions', () => {
    const state = stateWithEvidence([
      evidence('ev_c', 'C.', ['ev_a']),
      evidence('ev_b', 'B.', ['ev_c']),
      evidence('ev_a', 'A.', ['ev_b'])
    ]);
    const before = structuredClone(state);

    expect(selectNewContradictionCandidates(state).map((item) => item.id)).toEqual([
      'contradiction_candidate_ev_a__ev_b',
      'contradiction_candidate_ev_a__ev_c',
      'contradiction_candidate_ev_b__ev_c'
    ]);
    expect(state).toEqual(before);
  });

  it('converts candidate data into an open ContradictionRecord without applying shared state', () => {
    const [candidate] = selectNewContradictionCandidates(stateWithEvidence([
      evidence('ev_a', 'A.', ['ev_b']),
      evidence('ev_b', 'B.')
    ]));

    expect(contradictionRecordFromCandidate(candidate)).toEqual({
      id: 'contradiction_candidate_ev_a__ev_b',
      claim: 'Both active claims remain on record: "A." / "B.".',
      evidenceIds: ['ev_a', 'ev_b'],
      status: 'open'
    });
  });
});
