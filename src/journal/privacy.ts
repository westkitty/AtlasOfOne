import type { CampaignState } from '../game/types';
import { retireIneligibleV2DerivedState } from '../persistence/retirement';
import { markJournalEntryPrivate, retractJournalEntry } from './domain';

function applyJournalAuthorityChange(
  state: CampaignState,
  journalEntries: CampaignState['journalEntries'],
  updatedAt: string
): CampaignState {
  return retireIneligibleV2DerivedState({
    ...state,
    journalEntries,
    updatedAt
  });
}

export function privatizeJournalEntry(
  state: CampaignState,
  id: string,
  updatedAt: string
): CampaignState {
  return applyJournalAuthorityChange(
    state,
    markJournalEntryPrivate(state.journalEntries, id),
    updatedAt
  );
}

export function retractJournalEntryFromCampaign(
  state: CampaignState,
  id: string,
  updatedAt: string
): CampaignState {
  return applyJournalAuthorityChange(
    state,
    retractJournalEntry(state.journalEntries, id),
    updatedAt
  );
}
