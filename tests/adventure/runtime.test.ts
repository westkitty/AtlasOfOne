import { describe, expect, it } from 'vitest';
import type { AdventureTemplate, KnowledgeGap } from '../../src/contracts';
import {
  A03_BEAT_ROLES,
  advanceAdventureBeat,
  adventureRunReadyForCompletion,
  enterAdventureTemplate,
  validateAdventureTemplate
} from '../../src/adventure/runtime';
import { adventureRunId, startAdventureRun } from '../../src/adventure/runs';
import { materializeAdventureSeed } from '../../src/adventure/seeds';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { buildGapSeedRequest } from '../../src/knowledge/seed-request';

const ENTERED_AT = '2026-09-21T16:00:00.000Z';
const ADVANCED_AT = '2026-09-21T16:10:00.000Z';

function gap(): KnowledgeGap {
  return {
    id: 'gap-runtime', kind: 'underexplored', territoryIds: ['atlas'], dimensionIds: ['bananas'], sourceEvidenceIds: [], sourceJournalEntryIds: [],
    summary: 'Synthetic runtime gap.', status: 'open', priority: 90
  };
}

function baseState(): CampaignState {
  const base = createInitialCampaign();
  return {
    ...base,
    player: { id: 'synthetic-player', displayName: 'Synthetic Player', pronouns: 'they/them' },
    activeTerritory: 'atlas',
    territories: [{ id: 'atlas', label: 'Synthetic Atlas', status: 'exploring', requiredDimensions: ['bananas'], coveredDimensions: [], evidenceIds: [] }],
    turns: [], evidence: [], journalEntries: [], knowledgeGaps: [gap()], adventureSeeds: [], adventureRuns: [],
    adventureActions: [], adventureObservations: [], adventureMemories: [], privateTopics: []
  };
}

function activeCampaign(): CampaignState {
  const initial = baseState();
  const request = buildGapSeedRequest(initial);
  if (!request) throw new Error('Synthetic K07 request missing.');
  const seeded = materializeAdventureSeed(initial, request, 'Synthetic runtime premise.', { now: () => '2026-09-21T15:00:00.000Z' });
  const seed = seeded.adventureSeeds[0];
  if (!seed) throw new Error('Synthetic A00 seed missing.');
  return startAdventureRun(seeded, seed.id, { now: () => '2026-09-21T15:30:00.000Z' });
}

function template(overrides: Partial<AdventureTemplate> = {}): AdventureTemplate {
  const beats = A03_BEAT_ROLES.map((role, index) => ({
    id: `beat-${role}`,
    role,
    required: true,
    allowedEncounterKinds: role === 'encounter' ? ['social', 'puzzle'] as const : ['none'] as const,
    exits: index === A03_BEAT_ROLES.length - 1 ? [] : [`beat-${A03_BEAT_ROLES[index + 1]}`]
  }));
  return {
    id: 'template-investigation-linear',
    kind: 'investigation',
    validTerritories: ['atlas', 'other'],
    learningTarget: 'reflection-eligible',
    requiredInputs: ['territoryId'],
    beats: beats.map((beat) => ({ ...beat, allowedEncounterKinds: [...beat.allowedEncounterKinds] })),
    withdrawalAllowed: true,
    memoryOutputs: [],
    reflectionFormId: 'optional-reflection',
    cooldownClass: 'standard',
    ...overrides
  };
}

describe('A03 six-beat bounded Adventure runtime skeleton', () => {
  it('validates exactly six ordered canonical roles with stable unique IDs and adjacent deterministic exits', () => {
    const value = template();
    expect(validateAdventureTemplate(value)).toBe(true);
    expect(value.beats.map((beat) => beat.role)).toEqual(A03_BEAT_ROLES);
    expect(value.beats.map((beat) => beat.id)).toEqual([
      'beat-hook', 'beat-approach', 'beat-complication', 'beat-encounter', 'beat-choice', 'beat-consequence'
    ]);
    expect(value.beats.slice(0, -1).map((beat) => beat.exits)).toEqual([
      ['beat-approach'], ['beat-complication'], ['beat-encounter'], ['beat-choice'], ['beat-consequence']
    ]);
    expect(value.beats.at(-1)?.exits).toEqual([]);
  });

  it('rejects malformed order, duplicate IDs, skipped/backward exits, missing encounter kinds, and nonterminal consequence exits', () => {
    const wrongOrder = template();
    [wrongOrder.beats[0].role, wrongOrder.beats[1].role] = [wrongOrder.beats[1].role, wrongOrder.beats[0].role];
    expect(validateAdventureTemplate(wrongOrder)).toBe(false);

    const duplicate = template();
    duplicate.beats[1].id = duplicate.beats[0].id;
    expect(validateAdventureTemplate(duplicate)).toBe(false);

    const skipped = template();
    skipped.beats[0].exits = ['beat-complication'];
    expect(validateAdventureTemplate(skipped)).toBe(false);

    const backward = template();
    backward.beats[2].exits = ['beat-hook'];
    expect(validateAdventureTemplate(backward)).toBe(false);

    const noKinds = template();
    noKinds.beats[3].allowedEncounterKinds = [];
    expect(validateAdventureTemplate(noKinds)).toBe(false);

    const nonterminal = template();
    nonterminal.beats[5].exits = ['beat-hook'];
    expect(validateAdventureTemplate(nonterminal)).toBe(false);
  });

  it('enters only a compatible active pending run at the hook and changes no unrelated authority state', () => {
    const campaign = activeCampaign();
    const runId = campaign.adventureRuns[0].id;
    const before = structuredClone(campaign);
    const entered = enterAdventureTemplate(campaign, runId, template(), { now: () => ENTERED_AT });

    expect(entered.adventureRuns[0].currentBeatId).toBe('beat-hook');
    expect(entered.updatedAt).toBe(ENTERED_AT);
    expect(enterAdventureTemplate(entered, runId, template(), { now: () => ADVANCED_AT })).toBe(entered);
    for (const key of ['xp', 'level', 'turns', 'evidence', 'journalEntries', 'knowledgeGaps', 'adventureSeeds', 'adventureActions', 'adventureObservations', 'adventureMemories', 'contradictions', 'reflections', 'territories', 'quests', 'achievements', 'mapFragments', 'worldJourney'] as const) {
      expect(entered[key]).toEqual(before[key]);
    }
  });

  it('fails closed for invalid or seed-incompatible templates and non-active runs', () => {
    const campaign = activeCampaign();
    const runId = campaign.adventureRuns[0].id;
    expect(enterAdventureTemplate(campaign, runId, template({ kind: 'ethical-conflict' }), { now: () => ENTERED_AT })).toBe(campaign);
    expect(enterAdventureTemplate(campaign, runId, template({ learningTarget: 'none' }), { now: () => ENTERED_AT })).toBe(campaign);
    expect(enterAdventureTemplate(campaign, runId, template({ validTerritories: ['other'] }), { now: () => ENTERED_AT })).toBe(campaign);
    expect(enterAdventureTemplate(campaign, 'missing-run', template(), { now: () => ENTERED_AT })).toBe(campaign);

    const complete = { ...campaign, adventureRuns: campaign.adventureRuns.map((run) => ({ ...run, status: 'complete' as const, completedAt: ENTERED_AT })) };
    expect(enterAdventureTemplate(complete, runId, template(), { now: () => ADVANCED_AT })).toBe(complete);
  });

  it('advances exactly one declared beat, is replay-idempotent, and rejects skip/backward/unknown moves', () => {
    const campaign = activeCampaign();
    const runId = campaign.adventureRuns[0].id;
    const value = template();
    const entered = enterAdventureTemplate(campaign, runId, value, { now: () => ENTERED_AT });
    const approach = advanceAdventureBeat(entered, runId, value, 'beat-approach', { now: () => ADVANCED_AT });

    expect(approach.adventureRuns[0].currentBeatId).toBe('beat-approach');
    expect(approach.updatedAt).toBe(ADVANCED_AT);
    expect(advanceAdventureBeat(approach, runId, value, 'beat-approach', { now: () => '2026-09-21T16:20:00.000Z' })).toBe(approach);
    expect(advanceAdventureBeat(approach, runId, value, 'beat-encounter', { now: () => ADVANCED_AT })).toBe(approach);
    expect(advanceAdventureBeat(approach, runId, value, 'beat-hook', { now: () => ADVANCED_AT })).toBe(approach);
    expect(advanceAdventureBeat(approach, runId, value, 'missing-beat', { now: () => ADVANCED_AT })).toBe(approach);
  });

  it('reaches terminal consequence deterministically but leaves completion/withdrawal to other owners', () => {
    const campaign = activeCampaign();
    const runId = campaign.adventureRuns[0].id;
    const value = template();
    let current = enterAdventureTemplate(campaign, runId, value, { now: () => ENTERED_AT });
    for (const next of ['beat-approach', 'beat-complication', 'beat-encounter', 'beat-choice', 'beat-consequence']) {
      current = advanceAdventureBeat(current, runId, value, next, { now: () => ADVANCED_AT });
    }

    expect(current.adventureRuns[0]).toMatchObject({ status: 'active', currentBeatId: 'beat-consequence' });
    expect(current.adventureRuns[0].completedAt).toBeUndefined();
    expect(adventureRunReadyForCompletion(current, runId, value)).toBe(true);
    expect(advanceAdventureBeat(current, runId, value, 'beat-hook', { now: () => '2026-09-21T17:00:00.000Z' })).toBe(current);
    expect(current.adventureRuns.every((run) => run.status !== 'withdrawn')).toBe(true);
  });

  it('never creates actions, observations, memories, progression, or hidden analytic output while traversing all six beats', () => {
    const campaign = activeCampaign();
    const runId = adventureRunId(campaign.adventureSeeds[0].id);
    const value = template();
    const before = structuredClone(campaign);
    let current = enterAdventureTemplate(campaign, runId, value, { now: () => ENTERED_AT });
    for (const next of ['beat-approach', 'beat-complication', 'beat-encounter', 'beat-choice', 'beat-consequence']) {
      current = advanceAdventureBeat(current, runId, value, next, { now: () => ADVANCED_AT });
    }

    expect(current.adventureActions).toEqual([]);
    expect(current.adventureObservations).toEqual([]);
    expect(current.adventureMemories).toEqual([]);
    for (const key of ['xp', 'level', 'evidence', 'journalEntries', 'knowledgeGaps', 'contradictions', 'reflections', 'territories', 'quests', 'achievements', 'mapFragments', 'worldJourney'] as const) {
      expect(current[key]).toEqual(before[key]);
    }
    expect(JSON.stringify(current)).not.toContain('personality');
    expect(JSON.stringify(current)).not.toContain('diagnosis');
  });
});
