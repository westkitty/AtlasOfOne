import { describe, expect, it } from 'vitest';
import type { JournalEntry } from '../../src/contracts/journal';
import { materializeJournalAdventureSeed } from '../../src/adventure/journalSeed';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { curiosityGapId, markJournalForExploration, retireKnowledgeGap } from '../../src/knowledge/gaps';

const AT = '2026-09-22T05:15:00.000Z';
const LATER = '2026-09-22T05:16:00.000Z';
const SECRET_TEXT = 'JOURNAL_PROSE_MUST_NOT_ENTER_SEED_8472';

function entry(id: string, privacy: JournalEntry['privacy'] = 'normal', status: JournalEntry['status'] = 'active'): JournalEntry {
  return { id, createdAt: AT, text: SECRET_TEXT, inputMode: 'typed', privacy, status, reflectionIds: [], adventureIds: [] };
}

function campaign(entries: JournalEntry[]): CampaignState {
  const base = createInitialCampaign();
  return {
    ...base,
    player: { id: 'synthetic-player', displayName: 'Synthetic Player', pronouns: 'they/them' },
    journalEntries: entries,
    knowledgeGaps: [], adventureSeeds: [], adventureRuns: [],
    updatedAt: AT
  };
}

describe('I00 explicit Journal -> gap -> seed bridge', () => {
  it('does nothing on Journal save state until the player explicitly opts into exploration', () => {
    const saved = campaign([entry('journal-one')]);
    expect(materializeJournalAdventureSeed(saved, 'journal-one')).toBe(saved);
    expect(saved.knowledgeGaps).toEqual([]);
    expect(saved.adventureSeeds).toEqual([]);
  });

  it('materializes exactly one generic local seed from the exact open Journal curiosity gap', () => {
    const saved = campaign([entry('journal-one')]);
    const marked = markJournalForExploration(saved, 'journal-one', { now: AT });
    const before = structuredClone(marked);
    const seeded = materializeJournalAdventureSeed(marked, 'journal-one', { now: () => LATER });

    expect(seeded).not.toBe(marked);
    expect(seeded.knowledgeGaps).toContainEqual(expect.objectContaining({
      id: curiosityGapId('journal-one'), kind: 'curiosity', status: 'seeded', priority: 100,
      sourceJournalEntryIds: ['journal-one']
    }));
    expect(seeded.adventureSeeds).toHaveLength(1);
    expect(seeded.adventureSeeds[0]).toMatchObject({
      sourceGapIds: [curiosityGapId('journal-one')], kind: 'exploration-expedition',
      territoryId: saved.activeTerritory, learningTarget: 'reflection-eligible', status: 'available'
    });
    expect(seeded.adventureSeeds[0].premise).toContain('An adventure is waiting in');
    expect(seeded.adventureSeeds[0].premise).not.toContain(SECRET_TEXT);
    expect(seeded.journalEntries).toEqual(before.journalEntries);
    for (const key of ['xp', 'level', 'turns', 'evidence', 'territories', 'quests', 'achievements', 'mapFragments', 'worldJourney', 'adventureRuns'] as const) {
      expect(seeded[key]).toEqual(before[key]);
    }
  });

  it('targets the exact clicked Journal curiosity path even when another priority-100 curiosity gap exists', () => {
    const base = campaign([entry('journal-a'), entry('journal-z')]);
    const first = markJournalForExploration(base, 'journal-a', { now: AT });
    const both = markJournalForExploration(first, 'journal-z', { now: AT });
    const seeded = materializeJournalAdventureSeed(both, 'journal-z', { now: () => LATER });
    expect(seeded.adventureSeeds).toHaveLength(1);
    expect(seeded.adventureSeeds[0].sourceGapIds).toEqual([curiosityGapId('journal-z')]);
    expect(seeded.knowledgeGaps.find((gap) => gap.id === curiosityGapId('journal-a'))?.status).toBe('open');
    expect(seeded.knowledgeGaps.find((gap) => gap.id === curiosityGapId('journal-z'))?.status).toBe('seeded');
  });

  it('is idempotent under repeated activation and does not let premise wording affect structural identity', () => {
    const marked = markJournalForExploration(campaign([entry('journal-one')]), 'journal-one', { now: AT });
    const seeded = materializeJournalAdventureSeed(marked, 'journal-one', { now: () => LATER });
    const repeated = materializeJournalAdventureSeed(seeded, 'journal-one', { now: () => '2026-09-22T05:17:00.000Z' });
    expect(repeated).toBe(seeded);
    expect(repeated.adventureSeeds).toHaveLength(1);
  });

  it('fails closed for private, retracted, retired, resolved and malformed Journal paths', () => {
    const privateState = campaign([entry('journal-private', 'private')]);
    expect(materializeJournalAdventureSeed(privateState, 'journal-private')).toBe(privateState);

    const retractedState = campaign([entry('journal-retracted', 'normal', 'retracted')]);
    expect(materializeJournalAdventureSeed(retractedState, 'journal-retracted')).toBe(retractedState);

    const marked = markJournalForExploration(campaign([entry('journal-one')]), 'journal-one', { now: AT });
    const retired = retireKnowledgeGap(marked, curiosityGapId('journal-one'), { now: LATER });
    expect(materializeJournalAdventureSeed(retired, 'journal-one')).toBe(retired);

    const resolved: CampaignState = {
      ...marked,
      knowledgeGaps: marked.knowledgeGaps.map((gap) => ({ ...gap, status: 'resolved' as const }))
    };
    expect(materializeJournalAdventureSeed(resolved, 'journal-one')).toBe(resolved);

    const malformed: CampaignState = {
      ...marked,
      knowledgeGaps: marked.knowledgeGaps.map((gap) => ({ ...gap, sourceJournalEntryIds: ['other-journal'] }))
    };
    expect(materializeJournalAdventureSeed(malformed, 'journal-one')).toBe(malformed);

    const forgedCuriosity: CampaignState = {
      ...marked,
      knowledgeGaps: marked.knowledgeGaps.map((gap) => ({ ...gap, dimensionIds: ['hidden-dimension'] }))
    };
    expect(materializeJournalAdventureSeed(forgedCuriosity, 'journal-one')).toBe(forgedCuriosity);
  });

  it('preserves K06 retirement after seeding and structurally retires the dependent seed', () => {
    const marked = markJournalForExploration(campaign([entry('journal-one')]), 'journal-one', { now: AT });
    const seeded = materializeJournalAdventureSeed(marked, 'journal-one', { now: () => LATER });
    const retired = retireKnowledgeGap(seeded, curiosityGapId('journal-one'), { now: '2026-09-22T05:17:00.000Z' });
    expect(retired.knowledgeGaps[0].status).toBe('retired');
    expect(retired.adventureSeeds[0].status).toBe('retired');
    expect(retired.journalEntries[0].text).toBe(SECRET_TEXT);
  });
});
