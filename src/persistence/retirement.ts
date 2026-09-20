import type { CampaignState, PersistedAtlasSnapshot } from '../game/types';

/**
 * Structural v2 privacy/retraction retirement. This module deliberately works
 * from IDs and record state; it never examines claim, journal, or summary prose.
 */
const hasEligibleSupport = (sourceIds: string[], eligibleIds: Set<string>) =>
  sourceIds.length === 0 || sourceIds.some((id) => eligibleIds.has(id));

export interface ProviderEligibleV2State {
  knowledgeGaps: CampaignState['knowledgeGaps'];
  adventureSeeds: CampaignState['adventureSeeds'];
  adventureMemories: CampaignState['adventureMemories'];
  atlasSnapshots: PersistedAtlasSnapshot[];
  insightIds: string[];
  contradictionIds: string[];
}

export function retireIneligibleV2State(state: CampaignState): CampaignState {
  const eligibleTurnIds = new Set(state.turns.filter((turn) => !turn.retracted && !state.privateTopics.includes(turn.dimension)).map((turn) => turn.id));
  const eligibleJournalIds = new Set(state.journalEntries.filter((entry) => entry.status === 'active' && entry.privacy === 'normal').map((entry) => entry.id));
  const eligibleEvidenceIds = new Set(state.evidence.filter((evidence) => evidence.status === 'active' && !state.privateTopics.includes(evidence.dimension) && evidence.sourceTurnIds.every((id) => eligibleTurnIds.has(id))).map((evidence) => evidence.id));
  const eligibleInsightIds = new Set(state.insights.filter((insight) => insight.status !== 'rejected' && insight.evidenceIds.length > 0 && insight.evidenceIds.some((id) => eligibleEvidenceIds.has(id))).map((insight) => insight.id));
  const eligibleContradictionIds = new Set(state.contradictions.filter((contradiction) => contradiction.evidenceIds.length > 0 && contradiction.evidenceIds.some((id) => eligibleEvidenceIds.has(id))).map((contradiction) => contradiction.id));

  const knowledgeGaps = state.knowledgeGaps.map((gap) => {
    const sources = [...gap.sourceEvidenceIds, ...gap.sourceJournalEntryIds];
    const eligibleSources = new Set([...eligibleEvidenceIds, ...eligibleJournalIds]);
    return gap.status === 'retired' || !hasEligibleSupport(sources, eligibleSources) ? { ...gap, status: 'retired' as const } : gap;
  });
  const eligibleGapIds = new Set(knowledgeGaps.filter((gap) => gap.status !== 'retired').map((gap) => gap.id));

  const adventureSeeds = state.adventureSeeds.map((seed) =>
    seed.status === 'retired' || !hasEligibleSupport(seed.sourceGapIds, eligibleGapIds) ? { ...seed, status: 'retired' as const } : seed
  );

  const eligibleMemorySources = new Set([
    ...eligibleJournalIds, ...eligibleEvidenceIds, ...eligibleInsightIds, ...eligibleContradictionIds,
    ...state.adventureRuns.map((run) => run.id), ...state.adventureActions.map((action) => action.id), ...state.adventureObservations.map((observation) => observation.id),
    ...state.reflections.filter((reflection) => reflection.outcome !== 'PRIVATE').map((reflection) => reflection.id)
  ]);
  const adventureMemories = state.adventureMemories.map((memory) =>
    memory.status === 'retired' || memory.privacy === 'private' || !hasEligibleSupport(memory.sourceIds, eligibleMemorySources)
      ? { ...memory, status: 'retired' as const }
      : memory
  );

  const eligibleSnapshotSources = new Set([...eligibleEvidenceIds, ...eligibleInsightIds, ...eligibleContradictionIds]);
  const atlasSnapshots = state.atlasSnapshots.map((snapshot) => {
    if (snapshot.provenance.kind === 'legacy-final-assessment') return { ...snapshot, eligibility: 'historical-ineligible' as const };
    const sources = [...snapshot.evidenceIds, ...snapshot.insightIds, ...snapshot.contradictionIds];
    return sources.length > 0 && hasEligibleSupport(sources, eligibleSnapshotSources)
      ? snapshot
      : { ...snapshot, eligibility: 'retired' as const };
  });

  return { ...state, knowledgeGaps, adventureSeeds, adventureMemories, atlasSnapshots };
}

/** The future provider lane consumes this filtered view, never raw v2 derived state. */
export function providerEligibleV2State(state: CampaignState): ProviderEligibleV2State {
  const retired = retireIneligibleV2State(state);
  const eligibleEvidenceIds = new Set(retired.evidence.filter((evidence) => evidence.status === 'active' && !retired.privateTopics.includes(evidence.dimension)).map((evidence) => evidence.id));
  return {
    knowledgeGaps: retired.knowledgeGaps.filter((gap) => gap.status !== 'retired'),
    adventureSeeds: retired.adventureSeeds.filter((seed) => seed.status !== 'retired'),
    adventureMemories: retired.adventureMemories.filter((memory) => memory.status === 'active' && memory.privacy === 'normal'),
    atlasSnapshots: retired.atlasSnapshots.filter((snapshot) => snapshot.eligibility === 'eligible'),
    insightIds: retired.insights.filter((insight) => insight.status !== 'rejected' && insight.evidenceIds.some((id) => eligibleEvidenceIds.has(id))).map((insight) => insight.id),
    contradictionIds: retired.contradictions.filter((contradiction) => contradiction.evidenceIds.some((id) => eligibleEvidenceIds.has(id))).map((contradiction) => contradiction.id)
  };
}
