import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';

/** A complete, deliberately fictional v2 aggregate for persistence-only tests. */
export function syntheticV2Campaign(): CampaignState {
  const state = createInitialCampaign();
  const timestamp = '2025-02-03T04:05:06.000Z';
  return {
    ...state,
    campaignId: 'campaign_synthetic_v2', updatedAt: timestamp,
    turns: [{ id: 'turn_v2', createdAt: timestamp, territoryId: 'identity', dimension: 'synthetic-v2', question: 'Synthetic question?', answer: 'Synthetic answer.', substantive: true, behavioralExample: false, revision: false, retracted: false }],
    evidence: [{ id: 'evidence_v2', dimension: 'synthetic-v2', claim: 'Synthetic v2 claim.', sourceTurnIds: ['turn_v2'], basis: 'explicit', strength: 2, territories: ['identity'], counterEvidenceIds: [], status: 'active', origin: 'player-stated' }],
    insights: [{ id: 'insight_v2', title: 'Synthetic v2 insight', summary: 'Synthetic v2 summary.', evidenceIds: ['evidence_v2'], confidence: 'moderate', status: 'confirmed', createdAt: timestamp }],
    contradictions: [{ id: 'contradiction_v2', claim: 'Synthetic v2 tension.', evidenceIds: ['evidence_v2'], status: 'open' }],
    journalEntries: [{ id: 'journal_v2', createdAt: timestamp, text: 'Synthetic journal text.', inputMode: 'typed', privacy: 'normal', status: 'active', reflectionIds: ['reflection_v2'], adventureIds: ['run_v2'] }],
    knowledgeGaps: [{ id: 'gap_v2', kind: 'underexplored', territoryIds: ['identity'], dimensionIds: ['synthetic-v2'], sourceEvidenceIds: ['evidence_v2'], sourceJournalEntryIds: ['journal_v2'], summary: 'Synthetic gap.', status: 'open', priority: 4 }],
    reflections: [{ id: 'reflection_v2', sourceKind: 'journal', sourceIds: ['journal_v2'], question: 'Synthetic reflection?', response: 'Synthetic response.', createdAt: timestamp, outcome: 'CONFIRM', evidenceProvenance: { responseSourceId: 'journal_v2', sourceIds: ['journal_v2'] } }],
    adventureSeeds: [{ id: 'seed_v2', sourceGapIds: ['gap_v2'], kind: 'pure-fun-wildcard', territoryId: 'interests', locationId: 'atelier', premise: 'Synthetic adventure.', learningTarget: 'none', status: 'available' }],
    adventureRuns: [{ id: 'run_v2', seedId: 'seed_v2', territoryId: 'interests', locationId: 'atelier', status: 'active', currentBeatId: 'hook', recurringCharacterIds: ['npc_v2'], memoryIds: ['memory_v2'], startedAt: timestamp }],
    adventureActions: [{ id: 'action_v2', runId: 'run_v2', createdAt: timestamp, kind: 'inspect', text: 'Inspect the synthetic object.' }],
    adventureObservations: [{ id: 'observation_v2', runId: 'run_v2', sourceActionIds: ['action_v2'], observation: 'A fictional synthetic action occurred.', status: 'unreflected' }],
    adventureMemories: [{ id: 'memory_v2', type: 'event', summary: 'Synthetic event memory.', triggerTerms: ['synthetic'], sourceIds: ['observation_v2'], privacy: 'normal', status: 'active' }],
    atlasSnapshots: [{ id: 'snapshot_v2', createdAt: timestamp, evidenceIds: ['evidence_v2'], insightIds: ['insight_v2'], contradictionIds: ['contradiction_v2'], synthesis: { summary: 'Synthetic snapshot.', territorySummaries: [{ territoryId: 'identity', summary: 'Synthetic territory.' }] }, provenance: { kind: 'snapshot' }, eligibility: 'eligible' }],
    combatDefinitions: [{ id: 'combat_v2', encounterId: 'encounter_v2', objective: 'pacify', gimmicks: ['nonlethal'], combatants: [{ id: 'combatant_v2', templateId: 'template_v2', team: 'enemy', maxHp: 10 }], rewards: [{ id: 'reward_v2', kind: 'story' }], fleeRule: 'always' }],
    activeCombat: { definitionId: 'combat_v2', round: 1, phase: 'player', combatants: [{ id: 'combatant_v2', currentHp: 10, statuses: [] }], statuses: [], objectiveProgress: 0 }
  };
}
