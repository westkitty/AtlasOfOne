import { createEvidenceVisibility } from '../cartographer/context';
import type { CampaignState } from '../game/types';
import { journalEntryIsProviderEligible } from '../journal/domain';
import type { KnowledgeGap } from '../knowledge/schema';
import type { AdventureSeed, AdventureMemory } from '../adventure/schema';
import type { ReflectionRecord } from '../reflection/schema';

export interface V2ProvenanceVisibility {
  journalEntryIsEligible: (id: string) => boolean;
  evidenceIsEligible: (id: string) => boolean;
  insightIsEligible: (id: string) => boolean;
  contradictionIsEligible: (id: string) => boolean;
  knowledgeGapHasEligibleSupport: (id: string) => boolean;
  knowledgeGapIsStructurallyVisible: (id: string) => boolean;
  adventureSeedHasEligibleSupport: (id: string) => boolean;
  adventureSeedIsStructurallyVisible: (id: string) => boolean;
  adventureObservationIsEligible: (id: string) => boolean;
  reflectionIsEligible: (id: string) => boolean;
  adventureMemoryIsEligible: (id: string) => boolean;
  atlasSnapshotIsEligible: (id: string) => boolean;
  sourceIdIsEligible: (id: string) => boolean;
}

const everyNonEmpty = (ids: readonly string[], predicate: (id: string) => boolean) =>
  ids.length > 0 && ids.every(predicate);

/**
 * Build one read-only provenance graph for v2 privacy/retraction decisions.
 *
 * This layer never inspects prose. Eligibility comes only from stable IDs,
 * record lifecycle state, and privacy state.
 *
 * Two related but different questions are kept separate:
 * - "has eligible support" is used for retirement: mixed provenance is not
 *   retired while at least one supporting source remains eligible;
 * - "is structurally visible" is stricter: a record whose stored prose may
 *   summarize multiple sources is withheld unless every recorded source is
 *   eligible. That prevents mixed private/public provenance from leaking through
 *   an already-written summary.
 */
export function createV2ProvenanceVisibility(state: CampaignState): V2ProvenanceVisibility {
  const evidenceVisibility = createEvidenceVisibility(state);

  const journalById = new Map(state.journalEntries.map((record) => [record.id, record]));
  const insightById = new Map(state.insights.map((record) => [record.id, record]));
  const contradictionById = new Map(state.contradictions.map((record) => [record.id, record]));
  const gapById = new Map(state.knowledgeGaps.map((record) => [record.id, record]));
  const seedById = new Map(state.adventureSeeds.map((record) => [record.id, record]));
  const runById = new Map(state.adventureRuns.map((record) => [record.id, record]));
  const actionById = new Map(state.adventureActions.map((record) => [record.id, record]));
  const observationById = new Map(state.adventureObservations.map((record) => [record.id, record]));
  const reflectionById = new Map(state.reflections.map((record) => [record.id, record]));
  const memoryById = new Map(state.adventureMemories.map((record) => [record.id, record]));
  const snapshotById = new Map(state.atlasSnapshots.map((record) => [record.id, record]));

  const journalEntryIsEligible = (id: string) => {
    const record = journalById.get(id);
    return Boolean(record) && journalEntryIsProviderEligible(record!);
  };

  const evidenceIsEligible = evidenceVisibility.evidenceIsVisible;

  const insightIsEligible = (id: string) => {
    const record = insightById.get(id);
    return Boolean(record) && evidenceVisibility.derivedIsVisible(record!.evidenceIds);
  };

  const contradictionIsEligible = (id: string) => {
    const record = contradictionById.get(id);
    return Boolean(record) && evidenceVisibility.derivedIsVisible(record!.evidenceIds);
  };

  const gapSourceIds = (gap: KnowledgeGap) => [
    ...gap.sourceEvidenceIds,
    ...gap.sourceJournalEntryIds
  ];

  const gapSourceIsEligible = (gap: KnowledgeGap, id: string) => {
    if (gap.sourceEvidenceIds.includes(id)) return evidenceIsEligible(id);
    if (gap.sourceJournalEntryIds.includes(id)) return journalEntryIsEligible(id);
    return false;
  };

  const knowledgeGapHasEligibleSupport = (id: string) => {
    const gap = gapById.get(id);
    if (!gap) return false;
    const sources = gapSourceIds(gap);
    // Source-free gaps are allowed by the schema for coverage-derived unknowns.
    if (sources.length === 0) return true;
    return sources.some((sourceId) => gapSourceIsEligible(gap, sourceId));
  };

  const knowledgeGapIsStructurallyVisible = (id: string) => {
    const gap = gapById.get(id);
    if (!gap || gap.status === 'retired') return false;
    const sources = gapSourceIds(gap);
    if (sources.length === 0) return true;
    return sources.every((sourceId) => gapSourceIsEligible(gap, sourceId));
  };

  const adventureSeedHasEligibleSupport = (id: string) => {
    const seed = seedById.get(id);
    if (!seed) return false;
    // Gapless seeds are permitted for pure-fun content.
    if (seed.sourceGapIds.length === 0) return true;
    return seed.sourceGapIds.some((gapId) => {
      const gap = gapById.get(gapId);
      return Boolean(gap) && gap!.status !== 'retired' && knowledgeGapHasEligibleSupport(gapId);
    });
  };

  const adventureSeedIsStructurallyVisible = (id: string) => {
    const seed = seedById.get(id);
    if (!seed || seed.status === 'retired') return false;
    if (seed.sourceGapIds.length === 0) return true;
    return seed.sourceGapIds.every(knowledgeGapIsStructurallyVisible);
  };

  const adventureRunIsEligible = (id: string) => {
    const run = runById.get(id);
    return Boolean(run) && adventureSeedIsStructurallyVisible(run!.seedId);
  };

  const adventureActionIsEligible = (id: string) => {
    const action = actionById.get(id);
    return Boolean(action) && adventureRunIsEligible(action!.runId);
  };

  const adventureObservationIsEligible = (id: string) => {
    const observation = observationById.get(id);
    if (!observation || observation.status === 'discarded') return false;
    return everyNonEmpty(observation.sourceActionIds, adventureActionIsEligible);
  };

  const atlasSnapshotIsEligible = (id: string) => {
    const snapshot = snapshotById.get(id);
    if (!snapshot) return false;

    const sourceCount = snapshot.evidenceIds.length
      + snapshot.insightIds.length
      + snapshot.contradictionIds.length;

    // Historical M03 snapshots intentionally have no reconstructed provenance;
    // they remain durable history but cannot silently become eligible source
    // material for future provider synthesis/comparison.
    if (sourceCount === 0) return false;

    return snapshot.evidenceIds.every(evidenceIsEligible)
      && snapshot.insightIds.every(insightIsEligible)
      && snapshot.contradictionIds.every(contradictionIsEligible);
  };

  const reflectionIsEligible = (id: string): boolean => {
    const reflection = reflectionById.get(id);
    if (!reflection || reflection.recordStatus !== 'active' || reflection.privacy !== 'normal') {
      return false;
    }

    switch (reflection.sourceKind) {
      case 'journal':
        return everyNonEmpty(reflection.sourceIds, journalEntryIsEligible);
      case 'adventure':
        return everyNonEmpty(reflection.sourceIds, adventureObservationIsEligible);
      case 'contradiction':
        return everyNonEmpty(reflection.sourceIds, contradictionIsEligible);
      case 'insight':
        return everyNonEmpty(reflection.sourceIds, insightIsEligible);
      case 'snapshot':
        return everyNonEmpty(reflection.sourceIds, atlasSnapshotIsEligible);
      case 'pattern':
        // D05 says a pattern may carry multiple confirmed provenance source IDs,
        // but does not freeze one concrete source registry for those IDs. Until
        // RF07 defines that registry, guessing here would make privacy depend on
        // undocumented ID interpretation. Fail closed.
        return false;
    }
  };

  /**
   * Generic resolver for AdventureMemory.sourceIds.
   *
   * Memory source IDs are intentionally generic in D05. Resolve only when an ID
   * identifies exactly one known source record. Missing or colliding IDs fail
   * closed rather than choosing a convenient interpretation.
   */
  const sourceIdIsEligible = (id: string): boolean => {
    const candidates: boolean[] = [];

    if (journalById.has(id)) candidates.push(journalEntryIsEligible(id));
    if (state.evidence.some((record) => record.id === id)) candidates.push(evidenceIsEligible(id));
    if (insightById.has(id)) candidates.push(insightIsEligible(id));
    if (contradictionById.has(id)) candidates.push(contradictionIsEligible(id));
    if (gapById.has(id)) candidates.push(knowledgeGapIsStructurallyVisible(id));
    if (seedById.has(id)) candidates.push(adventureSeedIsStructurallyVisible(id));
    if (runById.has(id)) candidates.push(adventureRunIsEligible(id));
    if (actionById.has(id)) candidates.push(adventureActionIsEligible(id));
    if (observationById.has(id)) candidates.push(adventureObservationIsEligible(id));
    if (reflectionById.has(id)) candidates.push(reflectionIsEligible(id));
    if (snapshotById.has(id)) candidates.push(atlasSnapshotIsEligible(id));

    return candidates.length === 1 && candidates[0] === true;
  };

  const adventureMemoryIsEligible = (id: string) => {
    const memory = memoryById.get(id);
    if (!memory || memory.status !== 'active' || memory.privacy !== 'normal') return false;
    return everyNonEmpty(memory.sourceIds, sourceIdIsEligible);
  };

  return {
    journalEntryIsEligible,
    evidenceIsEligible,
    insightIsEligible,
    contradictionIsEligible,
    knowledgeGapHasEligibleSupport,
    knowledgeGapIsStructurallyVisible,
    adventureSeedHasEligibleSupport,
    adventureSeedIsStructurallyVisible,
    adventureObservationIsEligible,
    reflectionIsEligible,
    adventureMemoryIsEligible,
    atlasSnapshotIsEligible,
    sourceIdIsEligible
  };
}

/**
 * Retire only v2 records whose schema has a genuine retirement state.
 *
 * Historical records without a retirement state (Reflections, Snapshots,
 * AdventureRuns/Actions/Observations) are preserved and withheld through the
 * visibility functions above. Resolved KnowledgeGaps also remain resolved
 * history rather than being rewritten to "retired".
 *
 * No timestamp is fabricated here, so updatedAt remains untouched.
 */
export function retireIneligibleV2DerivedState(state: CampaignState): CampaignState {
  const initialVisibility = createV2ProvenanceVisibility(state);

  const knowledgeGaps = state.knowledgeGaps.map((gap): KnowledgeGap => {
    if (gap.status === 'retired' || gap.status === 'resolved') return gap;
    const sources = [...gap.sourceEvidenceIds, ...gap.sourceJournalEntryIds];
    if (sources.length === 0 || initialVisibility.knowledgeGapHasEligibleSupport(gap.id)) return gap;
    return { ...gap, status: 'retired' };
  });

  const stateWithGaps: CampaignState = { ...state, knowledgeGaps };
  const gapVisibility = createV2ProvenanceVisibility(stateWithGaps);

  const adventureSeeds = state.adventureSeeds.map((seed): AdventureSeed => {
    if (seed.status === 'retired' || seed.sourceGapIds.length === 0) return seed;
    if (gapVisibility.adventureSeedHasEligibleSupport(seed.id)) return seed;
    return { ...seed, status: 'retired' };
  });

  const stateWithSeeds: CampaignState = { ...stateWithGaps, adventureSeeds };
  const sourceVisibility = createV2ProvenanceVisibility(stateWithSeeds);

  const adventureMemories = state.adventureMemories.map((memory): AdventureMemory => {
    if (memory.status === 'retired') return memory;
    // D05 requires memory provenance. Missing/ambiguous/ineligible provenance
    // therefore retires authority while preserving the historical record.
    if (memory.sourceIds.some(sourceVisibility.sourceIdIsEligible)) return memory;
    return { ...memory, status: 'retired' };
  });

  return {
    ...stateWithSeeds,
    adventureMemories
  };
}
