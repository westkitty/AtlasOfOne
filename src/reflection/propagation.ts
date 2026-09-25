import type { CampaignState } from '../game/types';
import {
  createV2ProvenanceVisibility,
  retireIneligibleV2DerivedState,
  type V2ProvenanceVisibility
} from '../persistence/retirement';
import { decideReflection, retractReflection } from './domain';

/**
 * RF09 Reflection privacy / retraction propagation.
 *
 * When a source (JournalEntry, EvidenceRecord, Insight, Contradiction,
 * Reflection) becomes PRIVATE or retracted, derived records are handled purely
 * by provenance, never by prose search (plan 7.4):
 *
 * - records with a real retirement state (KnowledgeGap, AdventureSeed,
 *   AdventureMemory) are retired by the M06 hook `retireIneligibleV2DerivedState`;
 * - records without one (Reflection, Insight, Contradiction, AtlasSnapshot) are
 *   preserved as history and withheld through M06 visibility. Historical
 *   Snapshots are never rewritten; they are reported as no longer eligible
 *   source material, and S01 Snapshot eligibility recomputes from the same
 *   visibility so the withdrawn IDs cannot enter a new Snapshot request.
 *
 * The report lists only records that were eligible before and are not after,
 * so callers can explain what changed without inspecting withheld prose.
 */

export interface SourceAuthorityWithdrawal {
  reflectionIds: string[];
  insightIds: string[];
  contradictionIds: string[];
  atlasSnapshotIds: string[];
  knowledgeGapIds: string[];
  adventureSeedIds: string[];
  adventureMemoryIds: string[];
}

export interface SourceAuthorityPropagation {
  state: CampaignState;
  withdrawn: SourceAuthorityWithdrawal;
}

function newlyWithheld(
  ids: readonly string[],
  before: (id: string) => boolean,
  after: (id: string) => boolean
): string[] {
  return ids.filter((id) => before(id) && !after(id)).sort();
}

function retiredIds<T extends { id: string; status: string }>(
  before: readonly T[],
  after: readonly T[]
): string[] {
  const priorStatus = new Map(before.map((record) => [record.id, record.status]));
  return after
    .filter((record) => record.status === 'retired' && priorStatus.get(record.id) !== 'retired')
    .map((record) => record.id)
    .sort();
}

/**
 * Apply M06 retirement to `changed` (a state in which a source already became
 * PRIVATE/retracted) and report what lost authority relative to `before`.
 */
export function propagateSourceAuthorityChange(
  before: CampaignState,
  changed: CampaignState
): SourceAuthorityPropagation {
  const state = retireIneligibleV2DerivedState(changed);
  const prior: V2ProvenanceVisibility = createV2ProvenanceVisibility(before);
  const next = createV2ProvenanceVisibility(state);

  return {
    state,
    withdrawn: {
      reflectionIds: newlyWithheld(state.reflections.map((r) => r.id), prior.reflectionIsEligible, next.reflectionIsEligible),
      insightIds: newlyWithheld(state.insights.map((r) => r.id), prior.insightIsEligible, next.insightIsEligible),
      contradictionIds: newlyWithheld(state.contradictions.map((r) => r.id), prior.contradictionIsEligible, next.contradictionIsEligible),
      atlasSnapshotIds: newlyWithheld(state.atlasSnapshots.map((r) => r.id), prior.atlasSnapshotIsEligible, next.atlasSnapshotIsEligible),
      knowledgeGapIds: retiredIds(before.knowledgeGaps, state.knowledgeGaps),
      adventureSeedIds: retiredIds(before.adventureSeeds, state.adventureSeeds),
      adventureMemoryIds: retiredIds(before.adventureMemories, state.adventureMemories)
    }
  };
}

function replaceReflection(
  state: CampaignState,
  id: string,
  change: 'private' | 'retract',
  updatedAt: string
): CampaignState {
  const index = state.reflections.findIndex((record) => record.id === id);
  if (index < 0) throw new Error(`Unknown ReflectionRecord id: ${id}`);
  const record = state.reflections[index];
  const updated = change === 'retract'
    ? retractReflection(record)
    : decideReflection(record, 'private', record.response);
  const reflections = [...state.reflections];
  reflections[index] = updated;
  return { ...state, reflections, updatedAt };
}

/** Mark a Reflection PRIVATE and propagate to records that cite it. */
export function privatizeReflectionInCampaign(
  state: CampaignState,
  id: string,
  updatedAt: string
): SourceAuthorityPropagation {
  return propagateSourceAuthorityChange(state, replaceReflection(state, id, 'private', updatedAt));
}

/** Retract a Reflection (history preserved) and propagate to records that cite it. */
export function retractReflectionInCampaign(
  state: CampaignState,
  id: string,
  updatedAt: string
): SourceAuthorityPropagation {
  return propagateSourceAuthorityChange(state, replaceReflection(state, id, 'retract', updatedAt));
}
