import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, EvidenceRecord } from '../../src/game/types';

export const DIMENSIONS: Array<[string, string]> = [
  ['self-description', 'identity'],
  ['loyalty', 'values'],
  ['trust', 'relationships'],
  ['curiosity', 'interests'],
  ['decision style', 'cognition'],
  ['hopes', 'future']
];

export function evidence(
  id: string,
  dimension: string,
  territory: string,
  overrides: Partial<EvidenceRecord> = {}
): EvidenceRecord {
  return {
    id,
    dimension,
    claim: `Synthetic claim ${id}.`,
    sourceTurnIds: [`turn_${id}`],
    basis: 'explicit',
    strength: 2,
    territories: [territory],
    counterEvidenceIds: [],
    status: 'active',
    origin: 'player-stated',
    ...overrides
  };
}

/** Six player-stated evidence records across six dimensions, one insight, one contradiction. */
export function chartedState(): CampaignState {
  const initial = createInitialCampaign();
  return {
    ...initial,
    evidence: DIMENSIONS.map(([dimension, territory], index) =>
      evidence(`ev_${index + 1}`, dimension, territory)),
    insights: [{
      id: 'insight_1',
      title: 'Synthetic insight title',
      summary: 'Synthetic insight summary.',
      evidenceIds: ['ev_1', 'ev_2'],
      confidence: 'moderate',
      status: 'confirmed',
      createdAt: '2026-01-01T00:00:00.000Z'
    }],
    contradictions: [{
      id: 'contradiction_1',
      claim: 'Synthetic tension between two statements.',
      evidenceIds: ['ev_3', 'ev_4'],
      status: 'open'
    }]
  };
}
