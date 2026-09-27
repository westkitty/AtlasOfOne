import { describe, expect, it } from 'vitest';
import type { KnowledgeGap } from '../../src/contracts';
import { selectJourneyEvents, selectWorldMemories } from '../../src/adventure/journey';
import { LOCAL_FALLBACK_ADVENTURE_TEMPLATE } from '../../src/adventure/fallback';
import { activeCombatSession, adventurePlayView, beginAdventureEncounter, commandAdventureCombat, continueAdventure } from '../../src/adventure/play';
import { enterAdventureTemplate } from '../../src/adventure/runtime';
import { startAdventureRun } from '../../src/adventure/runs';
import { materializeAdventureSeed } from '../../src/adventure/seeds';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { buildGapSeedRequest } from '../../src/knowledge/seed-request';
import { selectWorldMemoryMarkers } from '../../src/world/adventureMarkers';

const now = () => '2026-09-26T12:00:00.000Z';

function completedAdventure(): CampaignState {
  const gap: KnowledgeGap = {
    id: 'gap-journey', kind: 'underexplored', territoryIds: ['identity'], dimensionIds: ['self-description'],
    sourceEvidenceIds: [], sourceJournalEntryIds: ['journal-journey'], summary: 'JOURNEY_GAP_CANARY', status: 'open', priority: 90
  };
  const prepared: CampaignState = {
    ...createInitialCampaign(), onboardingCompleted: true, activeTerritory: 'identity', knowledgeGaps: [gap],
    journalEntries: [{ id: 'journal-journey', createdAt: now(), text: 'JOURNEY_JOURNAL_CANARY', inputMode: 'typed', privacy: 'normal', status: 'active', reflectionIds: [], adventureIds: [] }]
  };
  const seeded = materializeAdventureSeed(prepared, buildGapSeedRequest(prepared)!, 'JOURNEY_PREMISE_CANARY', { now });
  const started = startAdventureRun(seeded, seeded.adventureSeeds[0].id, { now });
  let state = enterAdventureTemplate(started, started.adventureRuns[0].id, LOCAL_FALLBACK_ADVENTURE_TEMPLATE, { now });
  const runId = state.adventureRuns[0].id;
  for (let step = 0; step < 3; step += 1) state = continueAdventure(state, runId, { now });
  state = beginAdventureEncounter(state, runId);
  state = commandAdventureCombat(state, { kind: 'LEAVE' }, {}, { now }).state;
  expect(activeCombatSession(state)).toBeNull();
  state = continueAdventure(continueAdventure(state, runId, { now }), runId, { now });
  expect(adventurePlayView(state)).toBeNull();
  return state;
}

describe('Journey continuity: Journal and world remember real adventure state', () => {
  it('a completed adventure becomes one Journey event and one world memory marker', () => {
    const state = completedAdventure();
    const events = selectJourneyEvents(state);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ status: 'complete', territoryId: 'identity' });
    expect(events[0].outcome).toBeTruthy();
    const markers = selectWorldMemoryMarkers(state);
    expect(markers).toHaveLength(1);
    expect(markers[0]).toMatchObject({ kind: 'memory', territoryId: 'identity', recollection: events[0].outcome });
    expect(selectWorldMemoryMarkers(state)).toEqual(markers);
  });

  it('never carries Journal text, gap summary or premise', () => {
    const state = completedAdventure();
    const produced = JSON.stringify({ e: selectJourneyEvents(state), m: selectWorldMemoryMarkers(state) });
    expect(produced).not.toContain('CANARY');
  });

  it('making the source Journal entry private removes the journey and the world memory', () => {
    const state = completedAdventure();
    const privatized: CampaignState = { ...state, journalEntries: state.journalEntries.map((entry) => ({ ...entry, privacy: 'private' as const })) };
    expect(selectJourneyEvents(privatized)).toEqual([]);
    expect(selectWorldMemories(privatized)).toEqual([]);
    expect(selectWorldMemoryMarkers(privatized)).toEqual([]);
  });
});
