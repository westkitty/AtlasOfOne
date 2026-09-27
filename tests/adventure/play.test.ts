import { describe, expect, it } from 'vitest';
import type { KnowledgeGap } from '../../src/contracts';
import type { CombatCommand } from '../../src/contracts/combat';
import { LOCAL_ENCOUNTERS, localEncounterForRun } from '../../src/adventure/encounters';
import { createCombatSession } from '../../src/combat/session';
import { LOCAL_FALLBACK_ADVENTURE_TEMPLATE } from '../../src/adventure/fallback';
import {
  activeCombatSession,
  adventurePlayView,
  beginAdventureEncounter,
  commandAdventureCombat,
  continueAdventure,
  encounterObservationId
} from '../../src/adventure/play';
import { enterAdventureTemplate } from '../../src/adventure/runtime';
import { startAdventureRun } from '../../src/adventure/runs';
import { materializeAdventureSeed } from '../../src/adventure/seeds';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { buildGapSeedRequest } from '../../src/knowledge/seed-request';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';

const now = () => '2026-09-26T12:00:00.000Z';

function gap(): KnowledgeGap {
  return {
    id: 'gap-play', kind: 'underexplored', territoryIds: ['identity'], dimensionIds: ['self-description'],
    sourceEvidenceIds: [], sourceJournalEntryIds: [], summary: 'SYNTHETIC_GAP_SUMMARY_CANARY', status: 'open', priority: 90
  };
}

function activeRunCampaign(): CampaignState {
  const prepared: CampaignState = { ...createInitialCampaign(), onboardingCompleted: true, activeTerritory: 'identity', knowledgeGaps: [gap()] };
  const request = buildGapSeedRequest(prepared);
  if (!request) throw new Error('Synthetic request missing.');
  const seeded = materializeAdventureSeed(prepared, request, 'SYNTHETIC_PREMISE_CANARY', { now });
  const started = startAdventureRun(seeded, seeded.adventureSeeds[0].id, { now });
  return enterAdventureTemplate(started, started.adventureRuns[0].id, LOCAL_FALLBACK_ADVENTURE_TEMPLATE, { now });
}

function toEncounter(state: CampaignState): CampaignState {
  let next = state;
  const runId = adventurePlayView(next)!.run.id;
  for (let step = 0; step < 3; step += 1) next = continueAdventure(next, runId, { now });
  expect(adventurePlayView(next)!.scene.role).toBe('encounter');
  return next;
}

function winCommand(state: CampaignState): CombatCommand {
  const session = activeCombatSession(state)!;
  const enemy = session.definition.combatants.find((c) => c.team === 'enemy')!.id;
  switch (session.definition.objective) {
    case 'pacify':
      return session.acts.usedOptionIds.includes('listen') ? { kind: 'ACT', actId: 'lower-light', targetId: enemy } : { kind: 'ACT', actId: 'listen', targetId: enemy };
    case 'interrupt-charged-action':
      return session.state.combatants.find((c) => c.id === enemy)!.statuses.includes('charging')
        ? { kind: 'TECHNIQUE', techniqueId: 'interrupt-charge', targetId: enemy }
        : { kind: 'ATTACK', targetId: enemy };
    default:
      return session.techniques.chargesRemaining === 2 ? { kind: 'TECHNIQUE', techniqueId: 'expose-shield', targetId: enemy } : { kind: 'ATTACK', targetId: enemy };
  }
}

describe('I02/I03 local Adventure play loop', () => {
  it('walks hook -> encounter; the encounter beat cannot be skipped before it resolves', () => {
    const atEncounter = toEncounter(activeRunCampaign());
    const runId = adventurePlayView(atEncounter)!.run.id;
    expect(continueAdventure(atEncounter, runId, { now })).toBe(atEncounter);
  });

  it('runs the whole slice: combat resolves, one fictional observation is recorded, the run completes', () => {
    let state = toEncounter(activeRunCampaign());
    const runId = adventurePlayView(state)!.run.id;
    state = beginAdventureEncounter(state, runId);
    expect(beginAdventureEncounter(state, runId)).toBe(state);
    expect(adventurePlayView(state)!.combat).not.toBeNull();

    const evidenceBefore = state.evidence.length;
    const xpBefore = state.xp;
    let guard = 0;
    while (activeCombatSession(state) && guard < 12) {
      const result = commandAdventureCombat(state, winCommand(state), { expectedTurn: activeCombatSession(state)!.turn }, { now });
      expect(result.accepted).toBe(true);
      state = result.state;
      guard += 1;
    }
    expect(guard).toBeLessThanOrEqual(6);
    expect(state.activeCombat).toBeNull();
    expect(state.activeCombatRuntime).toBeNull();
    expect(state.adventureObservations).toHaveLength(1);
    expect(state.adventureObservations[0]).toMatchObject({ id: encounterObservationId(runId), status: 'unreflected', sourceActionIds: [`${runId}:encounter-action`] });
    expect(state.evidence).toHaveLength(evidenceBefore);
    expect(state.xp).toBe(xpBefore);
    expect(adventurePlayView(state)!.scene.role).toBe('choice');

    state = continueAdventure(state, runId, { now });
    expect(adventurePlayView(state)!.scene.terminal).toBe(true);
    state = continueAdventure(state, runId, { now });
    expect(state.adventureRuns.find((run) => run.id === runId)).toMatchObject({ status: 'complete', completedAt: now() });
    expect(adventurePlayView(state)).toBeNull();
  });

  it('stepping away (LEAVE) is a complete, non-punishing path through the encounter', () => {
    let state = beginAdventureEncounter(toEncounter(activeRunCampaign()), adventurePlayView(toEncounter(activeRunCampaign()))!.run.id);
    const result = commandAdventureCombat(state, { kind: 'LEAVE' }, {}, { now });
    expect(result.accepted).toBe(true);
    state = result.state;
    expect(state.adventureActions.at(-1)).toMatchObject({ kind: 'leave' });
    expect(adventurePlayView(state)!.scene.role).toBe('choice');
  });

  it('a double tap on Continue advances exactly one beat', () => {
    const state = activeRunCampaign();
    const view = adventurePlayView(state)!;
    const seen = view.run.currentBeatId;
    const once = continueAdventure(state, view.run.id, { now, expectedBeatId: seen });
    const twice = continueAdventure(once, view.run.id, { now, expectedBeatId: seen });
    expect(twice).toBe(once);
    expect(adventurePlayView(twice)!.scene.role).toBe('approach');
  });

  it('refuses a duplicate submission for the same turn without double-applying', () => {
    let state = toEncounter(activeRunCampaign());
    state = beginAdventureEncounter(state, adventurePlayView(state)!.run.id);
    const first = commandAdventureCombat(state, { kind: 'GUARD' }, { expectedTurn: 0 }, { now });
    const duplicate = commandAdventureCombat(first.state, { kind: 'GUARD' }, { expectedTurn: 0 }, { now });
    expect(duplicate).toMatchObject({ accepted: false, issue: 'stale-command' });
    expect(duplicate.state).toBe(first.state);
  });

  it('mid-combat state survives export/import (C11) and resumes identically', () => {
    let state = toEncounter(activeRunCampaign());
    state = beginAdventureEncounter(state, adventurePlayView(state)!.run.id);
    state = commandAdventureCombat(state, { kind: 'GUARD' }, {}, { now }).state;
    const restored = deserializeCampaign(serializeCampaign(state));
    expect(activeCombatSession(restored)).toEqual(activeCombatSession(state));
    const a = commandAdventureCombat(state, winCommand(state), {}, { now });
    const b = commandAdventureCombat(restored, winCommand(restored), {}, { now });
    expect(activeCombatSession(b.state)).toEqual(activeCombatSession(a.state));
  });

  it('a corrupted runtime fails closed to no resumable combat but keeps the saved data', () => {
    let state = toEncounter(activeRunCampaign());
    state = beginAdventureEncounter(state, adventurePlayView(state)!.run.id);
    const corrupted: CampaignState = { ...state, activeCombatRuntime: { ...state.activeCombatRuntime!, definitionId: 'someone-else' } };
    expect(activeCombatSession(corrupted)).toBeNull();
    expect(corrupted.activeCombat).toEqual(state.activeCombat);
    expect(commandAdventureCombat(corrupted, { kind: 'GUARD' })).toMatchObject({ accepted: false, issue: 'invalid-session' });
  });

  it('pre-C11 v2 saves (no activeCombatRuntime) still load', () => {
    const state = activeRunCampaign();
    const legacy = JSON.parse(serializeCampaign(state)) as Record<string, unknown>;
    delete legacy.activeCombatRuntime;
    expect(deserializeCampaign(JSON.stringify(legacy)).activeCombatRuntime).toBeNull();
  });

  it('never reads premise, gap summary or journal text into combat or observations', () => {
    let state = toEncounter(activeRunCampaign());
    state = beginAdventureEncounter(state, adventurePlayView(state)!.run.id);
    state = commandAdventureCombat(state, { kind: 'LEAVE' }, {}, { now }).state;
    const produced = JSON.stringify({ a: state.adventureActions, o: state.adventureObservations, c: state.combatDefinitions });
    expect(produced).not.toContain('CANARY');
  });

  it('every bank encounter is a valid deterministic definition and selection is stable', () => {
    expect(localEncounterForRun('run-x')).toBe(localEncounterForRun('run-x'));
    expect(new Set(LOCAL_ENCOUNTERS.map((e) => e.build('enc').definition.objective)).size).toBe(3);
    for (const encounter of LOCAL_ENCOUNTERS) {
      const { definition, scenario } = encounter.build('enc');
      expect(createCombatSession(definition, scenario).ok).toBe(true);
    }
  });
});
