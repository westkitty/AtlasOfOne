import { describe, expect, it } from 'vitest';
import { applyAttack, createCombatState, reduceCombatLifecycle } from '../../src/combat/engine';
import { activeCombatRecordSchema, createActiveCombatRecord, resumeActiveCombat } from '../../src/combat/persistence';
import { objectiveFixture } from '../combat/fixtures';
import { startAdventureFromSeed, reduceAdventureRun } from '../../src/adventure/run';
import { createPureFunAdventureSeed } from '../../src/adventure/seeds';
import { recordAdventureAction, recordAdventureObservation } from '../../src/adventure/actions';
import { createInitialCampaign } from '../../src/game/engine';
import { migrateCampaign } from '../../src/persistence/migrations';
import { deserializeCampaign, serializeCampaign } from '../../src/persistence/transfer';

const T0 = '2026-05-01T10:00:00.000Z';
const T1 = '2026-05-01T10:05:00.000Z';

function midCombat() {
  const definition = objectiveFixture('defeat');
  let state = createCombatState(definition);
  const enemy = state.combatants.find((actor) => actor.side === 'enemy')!;
  state = applyAttack(state, { actorId: state.combatants.find((a) => a.side === 'player')!.id, targetId: enemy.id }).state;
  if (state.phase === 'player') state = reduceCombatLifecycle(state, { type: 'END_PLAYER_PHASE' });
  return { definition, state };
}

describe('C11 mid-combat persistence', () => {
  it('round-trips an in-progress encounter through export/import and resumes identically', () => {
    const { definition, state } = midCombat();
    const record = createActiveCombatRecord({ id: 'combat_1', definition, state, startedAt: T0 });
    const campaign = { ...createInitialCampaign(), activeCombat: record };

    const restored = deserializeCampaign(serializeCampaign(campaign));
    expect(restored.activeCombat).toEqual(record);

    const resumed = resumeActiveCombat(restored.activeCombat!, [definition]);
    expect(resumed.ok).toBe(true);
    if (resumed.ok) expect(resumed.state).toEqual(state);
  });

  it('older v2 saves without the field load with activeCombat null', () => {
    const legacy = { ...createInitialCampaign() } as Record<string, unknown>;
    delete legacy.activeCombat;
    expect(migrateCampaign(legacy).activeCombat).toBeNull();
  });

  it('rejects tampered or inconsistent combat state on import', () => {
    const { definition, state } = midCombat();
    const record = createActiveCombatRecord({ id: 'combat_1', definition, state, startedAt: T0 });
    const bad = [
      { ...record, state: { ...record.state, combatants: record.state.combatants.map((a) => ({ ...a, hp: a.maxHp + 50 })) } },
      { ...record, state: { ...record.state, definitionId: 'other' } },
      { ...record, state: { ...record.state, phase: 'resolved' } },
      { ...record, state: { ...record.state, xp: 999 } },
      { ...record, reward: 'gold' },
      { ...record, startedAt: 'yesterday' }
    ];
    for (const value of bad) {
      expect(activeCombatRecordSchema.safeParse(value).success).toBe(false);
      expect(() => deserializeCampaign(JSON.stringify({ ...createInitialCampaign(), activeCombat: value }))).toThrow();
    }
  });

  it('fails closed on resume when content no longer matches, without guessing HP', () => {
    const { definition, state } = midCombat();
    const record = createActiveCombatRecord({ id: 'combat_1', definition, state, startedAt: T0 });
    expect(resumeActiveCombat(record, [])).toEqual({ ok: false, reason: 'unknown-definition' });
    const changed = { ...definition, combatants: definition.combatants.map((a) => ({ ...a, maxHp: a.maxHp + 1 })) };
    expect(resumeActiveCombat(record, [changed])).toEqual({ ok: false, reason: 'combatant-mismatch' });
  });

  it('record is a copy: later engine state changes cannot rewrite the saved snapshot', () => {
    const { definition, state } = midCombat();
    const record = createActiveCombatRecord({ id: 'combat_1', definition, state, startedAt: T0 });
    state.combatants[0].hp = 1;
    expect(record.state.combatants[0].hp).not.toBe(1);
  });
});

describe('A08 active adventure persists mid-beat', () => {
  it('round-trips an active run with actions and unreflected observations', () => {
    const baseSeed = createPureFunAdventureSeed({ id: 'seed_fun', territoryId: 'identity', premise: 'A kite snags on a bell tower.' });
    const { seed, run } = startAdventureFromSeed(baseSeed, { id: 'run_1', startedAt: T0 });
    const advanced = reduceAdventureRun(run, seed, { type: 'advance', at: T1 });
    const action = recordAdventureAction(advanced, { id: 'act_1', kind: 'do', text: 'Climb the tower stairs.', createdAt: T1 });
    const observation = recordAdventureObservation(advanced, [action], { id: 'obs_1', sourceActionIds: [action.id], observation: 'Chose to climb.' });

    const campaign = {
      ...createInitialCampaign(),
      adventureSeeds: [seed],
      adventureRuns: [advanced],
      adventureActions: [action],
      adventureObservations: [observation]
    };
    const restored = deserializeCampaign(serializeCampaign(campaign));

    expect(restored.adventureRuns[0]).toEqual(advanced);
    expect(restored.adventureRuns[0].status).toBe('active');
    expect(restored.adventureRuns[0].currentBeat).toBe(advanced.currentBeat);
    expect(restored.adventureSeeds[0].status).toBe('started');
    expect(restored.adventureActions).toEqual([action]);
    expect(restored.adventureObservations).toEqual([observation]);
    expect(restored.evidence).toEqual(campaign.evidence);

    // Resumed run continues deterministically from the saved beat.
    const next = reduceAdventureRun(restored.adventureRuns[0], restored.adventureSeeds[0], { type: 'advance', at: T1 });
    expect(next).toEqual(reduceAdventureRun(advanced, seed, { type: 'advance', at: T1 }));
  });
});
