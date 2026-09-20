import type { CampaignState, PersistedAtlasSnapshot } from '../game/types';

/**
 * Structural v2 privacy/retraction retirement. This module deliberately works
 * from IDs and record state; it never examines claim, journal, or summary prose.
 */
const hasAnyEligibleSupport = (sourceIds: string[], eligibleIds: Set<string>) =>
  sourceIds.length === 0 || sourceIds.some((id) => eligibleIds.has(id));

const hasAllEligibleSupport = (sourceIds: string[], eligibleIds: Set<string>) =>
  sourceIds.length > 0 && sourceIds.every((id) => eligibleIds.has(id));

function eligibleEvidenceIdsFor(state: CampaignState): Set<string> {
  const eligibleTurnIds = new Set(
    state.turns
      .filter((turn) => !turn.retracted && !state.privateTopics.includes(turn.dimension))
      .map((turn) => turn.id)
  );
  return new Set(
    state.evidence
      .filter((evidence) =>
        evidence.status === 'active'
        && !state.privateTopics.includes(evidence.dimension)
        && evidence.sourceTurnIds.every((id) => eligibleTurnIds.has(id))
      )
      .map((evidence) => evidence.id)
  );
}

function eligibleDerivedEvidenceIdsFor(state: CampaignState, evidenceIds: Set<string>) {
  const insightIds = new Set(
    state.insights
      .filter((insight) => insight.status !== 'rejected' && hasAllEligibleSupport(insight.evidenceIds, evidenceIds))
      .map((insight) => insight.id)
  );
  const contradictionIds = new Set(
    state.contradictions
      .filter((contradiction) => hasAllEligibleSupport(contradiction.evidenceIds, evidenceIds))
      .map((contradiction) => contradiction.id)
  );
  return { insightIds, contradictionIds };
}

export interface ProviderEligibleV2State {
  knowledgeGaps: CampaignState['knowledgeGaps'];
  adventureSeeds: CampaignState['adventureSeeds'];
  adventureMemories: CampaignState['adventureMemories'];
  atlasSnapshots: PersistedAtlasSnapshot[];
  insightIds: string[];
  contradictionIds: string[];
}

export function retireIneligibleV2State(state: CampaignState): CampaignState {
  const eligibleJournalIds = new Set(
    state.journalEntries
      .filter((entry) => entry.status === 'active' && entry.privacy === 'normal')
      .map((entry) => entry.id)
  );
  const eligibleEvidenceIds = eligibleEvidenceIdsFor(state);
  const { insightIds: eligibleInsightIds, contradictionIds: eligibleContradictionIds } = eligibleDerivedEvidenceIdsFor(state, eligibleEvidenceIds);

  const knowledgeGaps = state.knowledgeGaps.map((gap) => {
    const sources = [...gap.sourceEvidenceIds, ...gap.sourceJournalEntryIds];
    const eligibleSources = new Set([...eligibleEvidenceIds, ...eligibleJournalIds]);
    return gap.status === 'retired' || !hasAnyEligibleSupport(sources, eligibleSources) ? { ...gap, status: 'retired' as const } : gap;
  });
  const eligibleGapIds = new Set(knowledgeGaps.filter((gap) => gap.status !== 'retired').map((gap) => gap.id));

  const adventureSeeds = state.adventureSeeds.map((seed) =>
    seed.status === 'retired' || !hasAnyEligibleSupport(seed.sourceGapIds, eligibleGapIds) ? { ...seed, status: 'retired' as const } : seed
  );

  const eligibleSnapshotSources = new Set([...eligibleEvidenceIds, ...eligibleInsightIds, ...eligibleContradictionIds]);
  const atlasSnapshots = state.atlasSnapshots.map((snapshot) => {
    if (snapshot.provenance.kind === 'legacy-final-assessment') return { ...snapshot, eligibility: 'historical-ineligible' as const };
    const sources = [...snapshot.evidenceIds, ...snapshot.insightIds, ...snapshot.contradictionIds];
    return hasAllEligibleSupport(sources, eligibleSnapshotSources)
      ? snapshot
      : { ...snapshot, eligibility: 'retired' as const };
  });
  const eligibleSnapshotIds = new Set(atlasSnapshots.filter((snapshot) => snapshot.eligibility === 'eligible').map((snapshot) => snapshot.id));

  const adventureObservationIds = new Set(state.adventureObservations.map((observation) => observation.id));
  const reflectionSourceIsEligible = (sourceKind: CampaignState['reflections'][number]['sourceKind'], sourceIds: string[]) => {
    if (sourceIds.length === 0) return false;
    switch (sourceKind) {
      case 'journal': return sourceIds.every((id) => eligibleJournalIds.has(id));
      case 'adventure-observation': return sourceIds.every((id) => adventureObservationIds.has(id));
      case 'contradiction': return sourceIds.every((id) => eligibleContradictionIds.has(id));
      case 'insight': return sourceIds.every((id) => eligibleInsightIds.has(id));
      case 'snapshot': return sourceIds.every((id) => eligibleSnapshotIds.has(id));
    }
  };
  const eligibleReflectionIds = new Set(
    state.reflections
      .filter((reflection) => reflection.outcome !== 'PRIVATE' && reflectionSourceIsEligible(reflection.sourceKind, reflection.sourceIds))
      .map((reflection) => reflection.id)
  );

  const eligibleMemorySources = new Set([
    ...eligibleJournalIds, ...eligibleEvidenceIds, ...eligibleInsightIds, ...eligibleContradictionIds,
    ...state.adventureRuns.map((run) => run.id), ...state.adventureActions.map((action) => action.id), ...adventureObservationIds,
    ...eligibleReflectionIds
  ]);
  const adventureMemories = state.adventureMemories.map((memory) =>
    memory.status === 'retired' || memory.privacy === 'private'
      || (memory.sourceIds.length > 0 && !memory.sourceIds.every((id) => eligibleMemorySources.has(id)))
      ? { ...memory, status: 'retired' as const }
      : memory
  );

  return { ...state, knowledgeGaps, adventureSeeds, adventureMemories, atlasSnapshots };
}

/** The future provider lane consumes this filtered view, never raw v2 derived state. */
export function providerEligibleV2State(state: CampaignState): ProviderEligibleV2State {
  const retired = retireIneligibleV2State(state);
  const eligibleEvidenceIds = eligibleEvidenceIdsFor(retired);
  const { insightIds, contradictionIds } = eligibleDerivedEvidenceIdsFor(retired, eligibleEvidenceIds);
  return {
    knowledgeGaps: retired.knowledgeGaps.filter((gap) => gap.status !== 'retired'),
    adventureSeeds: retired.adventureSeeds.filter((seed) => seed.status !== 'retired'),
    adventureMemories: retired.adventureMemories.filter((memory) => memory.status === 'active' && memory.privacy === 'normal'),
    atlasSnapshots: retired.atlasSnapshots.filter((snapshot) => snapshot.eligibility === 'eligible'),
    insightIds: [...insightIds],
    contradictionIds: [...contradictionIds]
  };
}
