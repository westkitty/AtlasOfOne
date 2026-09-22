import { describe, expect, it } from 'vitest';
import type { AdventureRun, AdventureSeed, KnowledgeGap } from '../../src/contracts';
import {
  A01_INITIAL_BEAT_ID,
  adventureRunId,
  completeAdventureRun,
  selectActiveAdventureRun,
  startAdventureRun
} from '../../src/adventure/runs';
import { adventureSeedId, materializeAdventureSeed } from '../../src/adventure/seeds';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { buildGapSeedRequest, type GapSeedRequest } from '../../src/knowledge/seed-request';

const STARTED_AT = '2026-09-21T14:00:00.000Z';
const COMPLETED_AT = '2026-09-21T15:00:00.000Z';

function state(overrides: Partial<CampaignState> = {}): CampaignState {
  const base = createInitialCampaign();
  return {
    ...base,
    player: { id: 'synthetic-player', displayName: 'Synthetic Player', pronouns: 'they/them' },
    activeTerritory: 'atlas',
    territories: [{ id: 'atlas', label: 'Synthetic Atlas', status: 'exploring', requiredDimensions: ['bananas', 'kiwi'], coveredDimensions: [], evidenceIds: [] }],
    turns: [], evidence: [], journalEntries: [], knowledgeGaps: [], adventureSeeds: [], adventureRuns: [],
    adventureActions: [], adventureObservations: [], adventureMemories: [], privateTopics: [],
    updatedAt: '2026-09-21T13:00:00.000Z',
    ...overrides
  };
}

function gap(id: string, priority = 90, options: Partial<KnowledgeGap> = {}): KnowledgeGap {
  return {
    id, kind: 'underexplored', territoryIds: ['atlas'], dimensionIds: ['bananas'], sourceEvidenceIds: [], sourceJournalEntryIds: [],
    summary: 'Synthetic gap.', status: 'open', priority, ...options
  };
}

function requestFor(campaign: CampaignState): GapSeedRequest {
  const request = buildGapSeedRequest(campaign);
  if (!request) throw new Error('Synthetic fixture did not produce a K07 request.');
  return request;
}

function seededCampaign(gapId = 'gap-a'): { campaign: CampaignState; seed: AdventureSeed } {
  const initial = state({ knowledgeGaps: [gap(gapId)] });
  const request = requestFor(initial);
  const materialized = materializeAdventureSeed(initial, request, 'Synthetic seed premise.', { now: () => '2026-09-21T13:30:00.000Z' });
  const seed = materialized.adventureSeeds[0];
  if (!seed) throw new Error('Synthetic fixture did not materialize an A00 seed.');
  return { campaign: materialized, seed };
}

function run(seed: AdventureSeed, options: Partial<AdventureRun> = {}): AdventureRun {
  return {
    id: adventureRunId(seed.id), seedId: seed.id, territoryId: seed.territoryId, locationId: seed.locationId,
    status: 'active', currentBeatId: A01_INITIAL_BEAT_ID, recurringCharacterIds: [], memoryIds: [], startedAt: STARTED_AT,
    ...options
  };
}

describe('A01 deterministic AdventureRun lifecycle', () => {
  it('starts one eligible available seed atomically and preserves unrelated authority state', () => {
    const { campaign, seed } = seededCampaign();
    const before = structuredClone(campaign);
    const result = startAdventureRun(campaign, seed.id, { now: () => STARTED_AT });

    expect(result.adventureSeeds).toEqual([{ ...seed, status: 'started' }]);
    expect(result.adventureRuns).toEqual([{
      id: adventureRunId(seed.id), seedId: seed.id, territoryId: 'atlas', locationId: 'atlas', status: 'active',
      currentBeatId: A01_INITIAL_BEAT_ID, recurringCharacterIds: [], memoryIds: [], startedAt: STARTED_AT
    }]);
    expect(result.updatedAt).toBe(STARTED_AT);
    for (const key of ['xp', 'level', 'turns', 'evidence', 'journalEntries', 'knowledgeGaps', 'contradictions', 'reflections', 'territories', 'quests', 'achievements', 'mapFragments', 'worldJourney', 'adventureActions', 'adventureObservations', 'adventureMemories'] as const) {
      expect(result[key]).toEqual(before[key]);
    }
  });

  it('uses stable collision-safe run identity based only on seed ID', () => {
    expect(adventureRunId('seed:a|b')).toBe(adventureRunId('seed:a|b'));
    expect(adventureRunId('seed:a|b')).not.toBe(adventureRunId('seed:a'));
    expect(adventureRunId('seed:a|b')).not.toBe(adventureRunId('seed:b'));
  });

  it('fails closed for unavailable/ineligible/used seeds and repeated starts', () => {
    const { campaign, seed } = seededCampaign();
    const started = startAdventureRun(campaign, seed.id, { now: () => STARTED_AT });
    expect(startAdventureRun(started, seed.id, { now: () => COMPLETED_AT })).toBe(started);

    for (const status of ['started', 'retired'] as const) {
      const unavailable = { ...campaign, adventureSeeds: campaign.adventureSeeds.map((item) => ({ ...item, status })) };
      expect(startAdventureRun(unavailable, seed.id, { now: () => STARTED_AT })).toBe(unavailable);
    }

    const privateSource = state({
      knowledgeGaps: [gap('gap-private', 90, { status: 'seeded', dimensionIds: ['secret'] })],
      privateTopics: ['secret'],
      adventureSeeds: [{ ...seed, id: 'seed-private', sourceGapIds: ['gap-private'], status: 'available' }]
    });
    expect(startAdventureRun(privateSource, 'seed-private', { now: () => STARTED_AT })).toBe(privateSource);

    const usedSeed = { ...campaign, adventureRuns: [run(seed, { status: 'complete', completedAt: COMPLETED_AT })] };
    expect(startAdventureRun(usedSeed, seed.id, { now: () => STARTED_AT })).toBe(usedSeed);
  });

  it('enforces one active run globally while leaving other available seeds untouched', () => {
    const first = seededCampaign('gap-first');
    const secondGap = gap('gap-second', 80, { status: 'seeded' });
    const secondRequest = requestFor(state({ knowledgeGaps: [gap('gap-second', 80)] }));
    const secondSeed: AdventureSeed = {
      id: adventureSeedId(secondRequest), sourceGapIds: ['gap-second'], kind: secondRequest.adventureKind,
      territoryId: 'atlas', locationId: 'atlas', premise: 'Second synthetic seed.', learningTarget: 'reflection-eligible', status: 'available'
    };
    const withTwo = { ...first.campaign, knowledgeGaps: [...first.campaign.knowledgeGaps, secondGap], adventureSeeds: [...first.campaign.adventureSeeds, secondSeed] };
    const started = startAdventureRun(withTwo, first.seed.id, { now: () => STARTED_AT });
    const blocked = startAdventureRun(started, secondSeed.id, { now: () => COMPLETED_AT });

    expect(blocked).toBe(started);
    expect(blocked.adventureSeeds.find((item) => item.id === secondSeed.id)?.status).toBe('available');
    expect(blocked.adventureRuns).toHaveLength(1);
  });

  it('completes only the unambiguous active run, stamps completion once, and keeps the seed started', () => {
    const { campaign, seed } = seededCampaign();
    const started = startAdventureRun(campaign, seed.id, { now: () => STARTED_AT });
    const runId = adventureRunId(seed.id);
    const completed = completeAdventureRun(started, runId, { now: () => COMPLETED_AT });

    expect(completed.adventureRuns).toEqual([{
      ...started.adventureRuns[0], status: 'complete', completedAt: COMPLETED_AT
    }]);
    expect(completed.adventureSeeds[0].status).toBe('started');
    expect(completed.updatedAt).toBe(COMPLETED_AT);
    expect(completeAdventureRun(completed, runId, { now: () => '2026-09-21T16:00:00.000Z' })).toBe(completed);
    expect(completeAdventureRun(started, 'missing-run', { now: () => COMPLETED_AT })).toBe(started);
  });

  it('fails closed on corrupt multiple-active state and does not implement withdrawal', () => {
    const first = seededCampaign('gap-first');
    const secondSeed = { ...first.seed, id: 'seed-second', sourceGapIds: ['gap-second'], status: 'started' as const };
    const corrupt = state({
      knowledgeGaps: [gap('gap-first', 90, { status: 'seeded' }), gap('gap-second', 80, { status: 'seeded' })],
      adventureSeeds: [{ ...first.seed, status: 'started' }, secondSeed],
      adventureRuns: [run({ ...first.seed, status: 'started' }), run(secondSeed)]
    });

    expect(selectActiveAdventureRun(corrupt)).toBeNull();
    expect(completeAdventureRun(corrupt, corrupt.adventureRuns[0].id, { now: () => COMPLETED_AT })).toBe(corrupt);
    expect(corrupt.adventureRuns.every((item) => item.status !== 'withdrawn')).toBe(true);
  });

  it('allows a different eligible seed to start only after the active run completes', () => {
    const first = seededCampaign('gap-first');
    const secondGap = gap('gap-second', 80, { status: 'seeded' });
    const secondRequest = requestFor(state({ knowledgeGaps: [gap('gap-second', 80)] }));
    const secondSeed: AdventureSeed = {
      id: adventureSeedId(secondRequest), sourceGapIds: ['gap-second'], kind: secondRequest.adventureKind,
      territoryId: 'atlas', locationId: 'atlas', premise: 'Second synthetic seed.', learningTarget: 'reflection-eligible', status: 'available'
    };
    const withTwo = { ...first.campaign, knowledgeGaps: [...first.campaign.knowledgeGaps, secondGap], adventureSeeds: [...first.campaign.adventureSeeds, secondSeed] };
    const startedFirst = startAdventureRun(withTwo, first.seed.id, { now: () => STARTED_AT });
    const completedFirst = completeAdventureRun(startedFirst, adventureRunId(first.seed.id), { now: () => COMPLETED_AT });
    const startedSecond = startAdventureRun(completedFirst, secondSeed.id, { now: () => '2026-09-21T16:00:00.000Z' });

    expect(startedSecond.adventureRuns).toHaveLength(2);
    expect(startedSecond.adventureRuns.map((item) => item.status)).toEqual(['complete', 'active']);
    expect(startedSecond.adventureSeeds.find((item) => item.id === secondSeed.id)?.status).toBe('started');
    expect(selectActiveAdventureRun(startedSecond)?.seedId).toBe(secondSeed.id);
  });
});
