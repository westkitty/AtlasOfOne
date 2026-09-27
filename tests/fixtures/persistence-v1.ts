import { generateLocalAssessment } from '../../src/cartographer/finalize';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, CampaignStateV1 } from '../../src/game/types';

const toV1 = (state: CampaignState): CampaignStateV1 => {
  const {
    journalEntries, knowledgeGaps, reflections, adventureSeeds, adventureRuns, adventureActions,
    adventureObservations, adventureMemories, atlasSnapshots, combatDefinitions, activeCombat,
    ...legacy
  } = state;
  void journalEntries; void knowledgeGaps; void reflections; void adventureSeeds; void adventureRuns;
  void adventureActions; void adventureObservations; void adventureMemories; void atlasSnapshots;
  void combatDefinitions; void activeCombat;
  return { ...legacy, schemaVersion: 1 };
};

function matureV1(): CampaignStateV1 {
  const base = toV1(createInitialCampaign());
  const timestamp = '2025-01-02T03:04:05.000Z';
  return {
    ...base,
    campaignId: 'campaign_synthetic_v1_mature', xp: 320, level: 4, onboardingCompleted: true, updatedAt: timestamp,
    settings: { sass: 'risks-understood', reducedMotion: true, voiceMode: 'text' },
    turns: [{ id: 'turn_synthetic_active', createdAt: timestamp, territoryId: 'identity', dimension: 'synthetic-dimension', question: 'Synthetic question?', answer: 'Synthetic durable answer.', substantive: true, behavioralExample: true, revision: false, retracted: false }],
    evidence: [
      { id: 'evidence_synthetic_active', dimension: 'synthetic-dimension', claim: 'Synthetic supported claim.', sourceTurnIds: ['turn_synthetic_active'], basis: 'explicit', strength: 2, territories: ['identity'], counterEvidenceIds: ['evidence_synthetic_counter'], status: 'active', origin: 'player-stated' },
      { id: 'evidence_synthetic_counter', dimension: 'synthetic-counter', claim: 'Synthetic counter claim.', sourceTurnIds: ['turn_synthetic_active'], basis: 'revision', strength: 1, territories: ['identity'], counterEvidenceIds: ['evidence_synthetic_active'], status: 'contested', origin: 'player-stated' }
    ],
    insights: [{ id: 'insight_synthetic', title: 'Synthetic insight', summary: 'Synthetic summary.', evidenceIds: ['evidence_synthetic_active'], confidence: 'moderate', status: 'confirmed', createdAt: timestamp }],
    contradictions: [{ id: 'contradiction_synthetic', claim: 'Synthetic tension.', evidenceIds: ['evidence_synthetic_active', 'evidence_synthetic_counter'], status: 'open' }],
    bossRuns: [{ id: 'boss_run_synthetic', bossId: 'boss-values', territoryId: 'values', stages: [{ id: 'boss_stage_synthetic', kind: 'priority', dimensions: ['synthetic-dimension'], evidenceIds: ['evidence_synthetic_active'], outcome: 'passed' }], status: 'active', startedAt: timestamp }],
    activeBoss: 'boss-values',
    doorRuns: [{ id: 'door_run_synthetic', doorId: 'door_synthetic', territoryIds: ['identity', 'values'], evidenceIds: ['evidence_synthetic_active', 'evidence_synthetic_counter'], dimensions: ['synthetic-dimension', 'synthetic-counter'], status: 'open', openedAt: timestamp }],
    activeDoor: 'door_synthetic',
    worldJourney: { visitedTerritoryIds: ['identity', 'values'], discoveredLandmarkIds: ['sanctuary_identity'], lastPosition: { x: 12, y: 24, territoryId: 'identity' }, recentArrivals: [{ territoryId: 'identity', at: timestamp }], traversedRoutes: ['identity__values'], encounterLocations: [{ kind: 'boss', id: 'boss-values', territoryId: 'values', at: timestamp }] }
  };
}

const mature = matureV1();
const withAssessment = { ...structuredClone(mature), finalAssessment: generateLocalAssessment(createInitialCampaign()) };
const privateSource = {
  ...structuredClone(mature), privateTopics: ['synthetic-private-dimension'],
  turns: [{ ...mature.turns[0], id: 'turn_synthetic_private', dimension: 'synthetic-private-dimension', answer: 'synthetic-private-canary-7d93' }],
  evidence: [{ ...mature.evidence[0], id: 'evidence_synthetic_private', dimension: 'synthetic-private-dimension', sourceTurnIds: ['turn_synthetic_private'], claim: 'synthetic-private-canary-7d93' }]
};
const retractedSource = {
  ...structuredClone(mature),
  turns: [{ ...mature.turns[0], id: 'turn_synthetic_retracted', retracted: true, answer: 'synthetic-retracted-canary-82c1' }],
  evidence: [{ ...mature.evidence[0], id: 'evidence_synthetic_retracted', sourceTurnIds: ['turn_synthetic_retracted'], status: 'retracted', claim: 'synthetic-retracted-canary-82c1' }]
};
const olderMinimal = (() => {
  const legacy = structuredClone(mature) as unknown as Record<string, unknown>;
  delete legacy.bossRuns; delete legacy.activeBoss; delete legacy.doorRuns; delete legacy.activeDoor;
  delete legacy.worldJourney; delete legacy.finalAssessment; delete legacy.onboardingCompleted;
  return legacy;
})();

/** Canonical synthetic exports conforming to the actual v1 Zod schema. */
export const canonicalV1Fixtures = {
  mature,
  withAssessment,
  privateSource,
  retractedSource,
  olderMinimal
} as const;

export const cloneV1Fixture = <T extends keyof typeof canonicalV1Fixtures>(name: T) => structuredClone(canonicalV1Fixtures[name]);
