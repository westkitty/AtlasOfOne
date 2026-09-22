import type { CampaignState } from '../game/types';
import { curiosityGapId } from '../knowledge/gaps';
import { buildGapSeedRequestForGap } from '../knowledge/seed-request';
import { materializeAdventureSeed, type AdventureSeedMaterializationOptions } from './seeds';

/** Generic local premise: game-facing only, never derived from Journal prose. */
function localJournalAdventurePremise(state: CampaignState, territoryId: string): string {
  const territory = state.territories.find((candidate) => candidate.id === territoryId);
  return territory ? `An adventure is waiting in ${territory.label}.` : 'An adventure is waiting nearby.';
}

/**
 * I00 explicit Journal -> exact curiosity gap -> durable AdventureSeed bridge.
 *
 * Saving an entry never calls this. The player must first opt the entry into
 * exploration (K02/K06), then explicitly choose Explore this. The exact Journal
 * source is revalidated without reading its text and A00 remains the only seed
 * materialization authority.
 */
export function materializeJournalAdventureSeed(
  state: CampaignState,
  journalEntryId: string,
  options: AdventureSeedMaterializationOptions = {}
): CampaignState {
  const entry = state.journalEntries.find((candidate) => candidate.id === journalEntryId);
  if (!entry || entry.status !== 'active' || entry.privacy !== 'normal') return state;

  const gapId = curiosityGapId(journalEntryId);
  const gap = state.knowledgeGaps.find((candidate) => candidate.id === gapId);
  if (!gap
    || gap.kind !== 'curiosity'
    || gap.status !== 'open'
    || gap.sourceJournalEntryIds.length !== 1
    || gap.sourceJournalEntryIds[0] !== journalEntryId
    || gap.sourceEvidenceIds.length !== 0
    || gap.dimensionIds.length !== 0
  ) return state;

  const request = buildGapSeedRequestForGap(state, gapId);
  if (!request || request.gapIds.length !== 1 || request.gapIds[0] !== gapId) return state;
  return materializeAdventureSeed(
    state,
    request,
    localJournalAdventurePremise(state, request.territoryId),
    options
  );
}
