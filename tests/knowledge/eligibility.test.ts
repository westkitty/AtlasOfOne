import { describe, expect, it } from 'vitest';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { createJournalEntry } from '../../src/journal/domain';
import {
  knowledgeGapIsEligible,
  selectEligibleKnowledgeGaps
} from '../../src/knowledge/eligibility';

function stateWithJournalGap(
  privacy: 'normal' | 'private',
  status: 'active' | 'retracted' = 'active'
): CampaignState {
  const initial = createInitialCampaign();
  const entry = {
    ...createJournalEntry({
      id: 'journal_k05',
      createdAt: '2026-01-02T03:04:05.000Z',
      text: 'Synthetic K05 source.',
      inputMode: 'typed'
    }),
    privacy,
    status
  };

  return {
    ...initial,
    journalEntries: [entry],
    knowledgeGaps: [{
      id: 'gap_k05',
      kind: 'curiosity',
      territoryIds: ['identity'],
      dimensionIds: ['self-description'],
      sourceEvidenceIds: [],
      sourceJournalEntryIds: [entry.id],
      summary: 'Synthetic sourced gap.',
      status: 'open',
      priority: 20
    }]
  };
}

describe('Knowledge Gap privacy/retraction eligibility (K05)', () => {
  it('includes an open gap whose Journal provenance is active and normal', () => {
    const state = stateWithJournalGap('normal');
    expect(selectEligibleKnowledgeGaps(state).map((gap) => gap.id)).toEqual(['gap_k05']);
    expect(knowledgeGapIsEligible(state, 'gap_k05')).toBe(true);
  });

  it('excludes a gap whose Journal provenance is private', () => {
    const state = stateWithJournalGap('private');
    expect(selectEligibleKnowledgeGaps(state)).toEqual([]);
    expect(knowledgeGapIsEligible(state, 'gap_k05')).toBe(false);
  });

  it('excludes a gap whose Journal provenance is retracted', () => {
    const state = stateWithJournalGap('normal', 'retracted');
    expect(selectEligibleKnowledgeGaps(state)).toEqual([]);
  });

  it('withholds mixed provenance when any stored source is ineligible', () => {
    const initial = createInitialCampaign();
    const publicEntry = createJournalEntry({
      id: 'journal_public',
      createdAt: '2026-01-02T03:04:05.000Z',
      text: 'Public synthetic source.',
      inputMode: 'typed'
    });
    const privateEntry = {
      ...createJournalEntry({
        id: 'journal_private',
        createdAt: '2026-01-02T03:04:06.000Z',
        text: 'Private synthetic source.',
        inputMode: 'typed'
      }),
      privacy: 'private' as const
    };
    const state: CampaignState = {
      ...initial,
      journalEntries: [publicEntry, privateEntry],
      knowledgeGaps: [{
        id: 'gap_mixed',
        kind: 'underexplored',
        territoryIds: ['identity'],
        dimensionIds: ['self-description'],
        sourceEvidenceIds: [],
        sourceJournalEntryIds: [publicEntry.id, privateEntry.id],
        summary: 'Synthetic mixed-source summary.',
        status: 'open',
        priority: 50
      }]
    };

    // M06 deliberately may preserve mixed-support history as open, but K05 must
    // not expose the stored mixed-source summary for selection.
    expect(state.knowledgeGaps[0].status).toBe('open');
    expect(selectEligibleKnowledgeGaps(state)).toEqual([]);
  });

  it('allows source-free coverage-derived open gaps but excludes retired/resolved gaps', () => {
    const initial = createInitialCampaign();
    const base = {
      kind: 'unknown' as const,
      territoryIds: ['identity'],
      dimensionIds: ['self-description'],
      sourceEvidenceIds: [],
      sourceJournalEntryIds: [],
      summary: 'Coverage-derived synthetic gap.',
      priority: 10
    };
    const state: CampaignState = {
      ...initial,
      knowledgeGaps: [
        { ...base, id: 'gap_open', status: 'open' },
        { ...base, id: 'gap_retired', status: 'retired' },
        { ...base, id: 'gap_resolved', status: 'resolved' }
      ]
    };

    expect(selectEligibleKnowledgeGaps(state).map((gap) => gap.id)).toEqual(['gap_open']);
  });

  it('does not inspect gap prose for privacy labels or canary text', () => {
    const state = stateWithJournalGap('normal');
    state.knowledgeGaps[0] = {
      ...state.knowledgeGaps[0],
      summary: 'PRIVATE RETRACTED SECRET words are just text here.'
    };

    expect(selectEligibleKnowledgeGaps(state).map((gap) => gap.id)).toEqual(['gap_k05']);
  });
});
