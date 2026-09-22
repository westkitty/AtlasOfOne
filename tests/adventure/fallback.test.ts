import { describe, expect, it } from 'vitest';
import type { KnowledgeGap } from '../../src/contracts';
import {
  LOCAL_FALLBACK_ADVENTURE_TEMPLATE,
  renderLocalAdventureScene
} from '../../src/adventure/fallback';
import { advanceAdventureBeat, enterAdventureTemplate, validateAdventureTemplate } from '../../src/adventure/runtime';
import { startAdventureRun } from '../../src/adventure/runs';
import { materializeAdventureSeed } from '../../src/adventure/seeds';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { buildGapSeedRequest } from '../../src/knowledge/seed-request';

function gap(): KnowledgeGap {
  return {
    id: 'gap-fallback', kind: 'underexplored', territoryIds: ['identity'], dimensionIds: ['self-description'],
    sourceEvidenceIds: [], sourceJournalEntryIds: [], summary: 'PRIVATE_GAP_SUMMARY_CANARY', status: 'open', priority: 90
  };
}

function activeFallbackCampaign(): CampaignState {
  const initial = createInitialCampaign();
  const prepared: CampaignState = {
    ...initial,
    onboardingCompleted: true,
    activeTerritory: 'identity',
    knowledgeGaps: [gap()],
    journalEntries: [{
      id: 'journal-private-canary', createdAt: '2026-09-21T12:00:00.000Z', text: 'PRIVATE_JOURNAL_CANARY',
      inputMode: 'typed', privacy: 'private', status: 'active', reflectionIds: [], adventureIds: []
    }]
  };
  const request = buildGapSeedRequest(prepared);
  if (!request) throw new Error('Synthetic fallback request missing.');
  const seeded = materializeAdventureSeed(prepared, request, 'PRIVATE_SEED_PREMISE_CANARY', { now: () => '2026-09-21T13:00:00.000Z' });
  const seed = seeded.adventureSeeds[0];
  if (!seed) throw new Error('Synthetic fallback seed missing.');
  const started = startAdventureRun(seeded, seed.id, { now: () => '2026-09-21T13:30:00.000Z' });
  const run = started.adventureRuns[0];
  if (!run) throw new Error('Synthetic fallback run missing.');
  return enterAdventureTemplate(started, run.id, LOCAL_FALLBACK_ADVENTURE_TEMPLATE, { now: () => '2026-09-21T14:00:00.000Z' });
}

describe('A06 deterministic local fallback Adventure renderer', () => {
  it('ships one A03-valid local fallback investigation template across current territories', () => {
    expect(validateAdventureTemplate(LOCAL_FALLBACK_ADVENTURE_TEMPLATE)).toBe(true);
    expect(LOCAL_FALLBACK_ADVENTURE_TEMPLATE.kind).toBe('investigation');
    expect(LOCAL_FALLBACK_ADVENTURE_TEMPLATE.learningTarget).toBe('reflection-eligible');
    expect(LOCAL_FALLBACK_ADVENTURE_TEMPLATE.beats.map((beat) => beat.role)).toEqual([
      'hook', 'approach', 'complication', 'encounter', 'choice', 'consequence'
    ]);
    expect(LOCAL_FALLBACK_ADVENTURE_TEMPLATE.validTerritories).toEqual([
      'identity', 'values', 'politics', 'relationships', 'interests', 'cognition', 'fears', 'future'
    ]);
  });

  it('renders deterministic bounded local copy for every canonical beat without reading source prose', () => {
    let state = activeFallbackCampaign();
    const runId = state.adventureRuns[0].id;
    const snapshots: Array<{ role: string; title: string; terminal: boolean; suggestions: number }> = [];

    for (const beat of LOCAL_FALLBACK_ADVENTURE_TEMPLATE.beats) {
      const scene = renderLocalAdventureScene(state, runId);
      expect(scene).not.toBeNull();
      snapshots.push({ role: scene!.role, title: scene!.title, terminal: scene!.terminal, suggestions: scene!.suggestions.length });
      const serialized = JSON.stringify(scene);
      expect(serialized).not.toContain('PRIVATE_GAP_SUMMARY_CANARY');
      expect(serialized).not.toContain('PRIVATE_JOURNAL_CANARY');
      expect(serialized).not.toContain('PRIVATE_SEED_PREMISE_CANARY');
      expect(scene!.suggestions.length).toBe(3);
      expect(scene!.suggestions.every((value) => value.length > 0 && value.length < 80)).toBe(true);
      if (beat.exits[0]) state = advanceAdventureBeat(state, runId, LOCAL_FALLBACK_ADVENTURE_TEMPLATE, beat.exits[0], { now: () => '2026-09-21T14:10:00.000Z' });
    }

    expect(snapshots.map((item) => item.role)).toEqual(['hook', 'approach', 'complication', 'encounter', 'choice', 'consequence']);
    expect(snapshots.map((item) => item.terminal)).toEqual([false, false, false, false, false, true]);
    expect(new Set(snapshots.map((item) => item.title)).size).toBe(6);
  });

  it('is pure/read-only and returns identical output for identical state', () => {
    const state = activeFallbackCampaign();
    const before = structuredClone(state);
    const runId = state.adventureRuns[0].id;
    const first = renderLocalAdventureScene(state, runId);
    const second = renderLocalAdventureScene(state, runId);
    expect(second).toEqual(first);
    expect(state).toEqual(before);
  });

  it('fails closed for pending, incompatible, missing, complete, and invalid-template state', () => {
    const entered = activeFallbackCampaign();
    const runId = entered.adventureRuns[0].id;
    const pending = { ...entered, adventureRuns: entered.adventureRuns.map((run) => ({ ...run, currentBeatId: 'pending' })) };
    expect(renderLocalAdventureScene(pending, runId)).toBeNull();
    expect(renderLocalAdventureScene(entered, 'missing-run')).toBeNull();

    const incompatible = { ...entered, adventureSeeds: entered.adventureSeeds.map((seed) => ({ ...seed, kind: 'ethical-conflict' as const })) };
    expect(renderLocalAdventureScene(incompatible, runId)).toBeNull();

    const complete = { ...entered, adventureRuns: entered.adventureRuns.map((run) => ({ ...run, status: 'complete' as const, completedAt: '2026-09-21T15:00:00.000Z' })) };
    expect(renderLocalAdventureScene(complete, runId)).toBeNull();

    const invalidTemplate = { ...LOCAL_FALLBACK_ADVENTURE_TEMPLATE, beats: LOCAL_FALLBACK_ADVENTURE_TEMPLATE.beats.slice(0, 5) };
    expect(renderLocalAdventureScene(entered, runId, invalidTemplate)).toBeNull();
  });
});
