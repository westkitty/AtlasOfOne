import { describe, expect, it } from 'vitest';
import type { AdventureSeed, KnowledgeGap } from '../../src/contracts';
import { adventureSeedId, materializeAdventureSeed, selectAvailableAdventureSeeds } from '../../src/adventure/seeds';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState, EvidenceRecord, TurnRecord } from '../../src/game/types';
import { buildGapSeedRequest, type GapSeedRequest } from '../../src/knowledge/seed-request';

const NOW = '2026-09-21T13:00:00.000Z';

function state(overrides: Partial<CampaignState> = {}): CampaignState {
  const base = createInitialCampaign();
  return {
    ...base,
    player: { id: 'synthetic-player', displayName: 'Synthetic Player', pronouns: 'they/them' },
    activeTerritory: 'atlas',
    territories: [{ id: 'atlas', label: 'Synthetic Atlas', status: 'exploring', requiredDimensions: ['bananas', 'kiwi'], coveredDimensions: [], evidenceIds: [] }],
    turns: [], evidence: [], journalEntries: [], knowledgeGaps: [], adventureSeeds: [], adventureRuns: [], privateTopics: [],
    updatedAt: '2026-09-21T12:00:00.000Z',
    ...overrides
  };
}

function gap(id: string, priority: number, options: Partial<KnowledgeGap> = {}): KnowledgeGap {
  return {
    id, kind: 'underexplored', territoryIds: ['atlas'], dimensionIds: ['bananas'], sourceEvidenceIds: [], sourceJournalEntryIds: [],
    summary: 'Synthetic gap.', status: 'open', priority, ...options
  };
}

function turn(id: string, dimension = 'bananas', retracted = false): TurnRecord {
  return {
    id, createdAt: '2026-09-21T11:00:00.000Z', territoryId: 'atlas', dimension,
    question: 'Synthetic question?', answer: 'Synthetic answer.', substantive: true, behavioralExample: false, revision: false, retracted
  };
}

function evidence(id: string, sourceTurnIds: string[], options: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    id, dimension: 'bananas', claim: `Synthetic claim ${id}.`, sourceTurnIds, basis: 'explicit', strength: 2,
    territories: ['atlas'], counterEvidenceIds: [], status: 'active', origin: 'player-stated', ...options
  };
}

function requestFor(campaign: CampaignState): GapSeedRequest {
  const request = buildGapSeedRequest(campaign);
  if (!request) throw new Error('Synthetic fixture did not produce a K07 request.');
  return request;
}

function seedFrom(request: GapSeedRequest, options: Partial<AdventureSeed> = {}): AdventureSeed {
  return {
    id: adventureSeedId(request), sourceGapIds: [...request.gapIds].sort(), kind: request.adventureKind,
    territoryId: request.territoryId, locationId: request.territoryId, premise: 'Synthetic premise.',
    learningTarget: request.learningTarget, status: 'available', ...options
  };
}

describe('A00 AdventureSeed state / eligibility / deduplication', () => {
  it('materializes one eligible K07 request, seeds its gaps, and changes no unrelated authority state', () => {
    const unrelatedGap = gap('gap-history', 10, { status: 'resolved' });
    const unrelatedSeed: AdventureSeed = {
      id: 'seed-history', sourceGapIds: [unrelatedGap.id], kind: 'exploration-expedition', territoryId: 'atlas', locationId: 'atlas',
      premise: 'Synthetic historical premise.', learningTarget: 'reflection-eligible', status: 'retired'
    };
    const campaign = state({ knowledgeGaps: [gap('gap-a', 90), unrelatedGap], adventureSeeds: [unrelatedSeed] });
    const request = requestFor(campaign);
    const before = structuredClone(campaign);
    const result = materializeAdventureSeed(campaign, request, 'Synthetic non-authoritative premise.', { now: () => NOW });

    expect(result.adventureSeeds).toEqual([unrelatedSeed, {
      id: adventureSeedId(request), sourceGapIds: ['gap-a'], kind: 'investigation', territoryId: 'atlas', locationId: 'atlas',
      premise: 'Synthetic non-authoritative premise.', learningTarget: 'reflection-eligible', status: 'available'
    }]);
    expect(result.knowledgeGaps[0]).toEqual({ ...before.knowledgeGaps[0], status: 'seeded' });
    expect(result.knowledgeGaps[1]).toEqual(before.knowledgeGaps[1]);
    expect(result.adventureSeeds[0]).toEqual(before.adventureSeeds[0]);
    expect(result.updatedAt).toBe(NOW);
    for (const key of ['xp', 'level', 'turns', 'evidence', 'journalEntries', 'contradictions', 'reflections', 'territories', 'quests', 'achievements', 'mapFragments', 'worldJourney', 'adventureRuns'] as const) {
      expect(result[key]).toEqual(before[key]);
    }
  });

  it('uses collision-safe identity, normalizes gap order, and ignores premise wording for deduplication', () => {
    const campaign = state({ knowledgeGaps: [gap('a|b', 90), gap('c', 80)] });
    const request = requestFor(campaign);
    expect(request.gapIds).toEqual(['a|b', 'c']);
    const reversed = { ...request, gapIds: [...request.gapIds].reverse() };
    expect(adventureSeedId(reversed)).toBe(adventureSeedId(request));

    const ambiguousA = { ...request, gapIds: ['a|b', 'c'] };
    const ambiguousB = { ...request, gapIds: ['a', 'b|c'] };
    expect(adventureSeedId(ambiguousA)).not.toBe(adventureSeedId(ambiguousB));

    const created = materializeAdventureSeed(campaign, reversed, 'First synthetic premise.', { now: () => NOW });
    const duplicate = materializeAdventureSeed(created, request, 'Completely different synthetic premise.', { now: () => '2026-09-21T14:00:00.000Z' });
    expect(duplicate).toBe(created);
    expect(duplicate.adventureSeeds).toHaveLength(1);
    expect(duplicate.adventureSeeds[0].premise).toBe('First synthetic premise.');
  });

  it('never regenerates structurally equivalent available/started/retired/history seeds even with a legacy ID', () => {
    const base = state({ knowledgeGaps: [gap('gap-a', 90)] });
    const request = requestFor(base);
    for (const status of ['available', 'started', 'retired'] as const) {
      const existing = seedFrom(request, { id: `legacy-${status}`, status });
      const campaign = state({ knowledgeGaps: [gap('gap-a', 90)], adventureSeeds: [existing] });
      expect(materializeAdventureSeed(campaign, request, 'New synthetic premise.', { now: () => NOW })).toBe(campaign);
    }

    const existing = seedFrom(request, { id: 'legacy-history' });
    const withHistory = state({
      knowledgeGaps: [gap('gap-a', 90)], adventureSeeds: [existing],
      adventureRuns: [{ id: 'run-history', seedId: existing.id, territoryId: 'atlas', locationId: 'atlas', status: 'complete', currentBeatId: 'consequence', recurringCharacterIds: [], memoryIds: [], startedAt: NOW, completedAt: NOW }]
    });
    expect(materializeAdventureSeed(withHistory, request, 'Again.', { now: () => NOW })).toBe(withHistory);
  });

  it('fails closed when current K07 eligibility or bounded context no longer matches the request', () => {
    const source = gap('gap-evidence', 90, { sourceEvidenceIds: ['evidence-a'] });
    const original = state({ turns: [turn('turn-a')], evidence: [evidence('evidence-a', ['turn-a'])], knowledgeGaps: [source] });
    const request = requestFor(original);

    const retired = state({ turns: original.turns, evidence: original.evidence, knowledgeGaps: [{ ...source, status: 'retired' }] });
    expect(materializeAdventureSeed(retired, request, 'Synthetic.', { now: () => NOW })).toBe(retired);

    const resolved = state({ turns: original.turns, evidence: original.evidence, knowledgeGaps: [{ ...source, status: 'resolved' }] });
    expect(materializeAdventureSeed(resolved, request, 'Synthetic.', { now: () => NOW })).toBe(resolved);

    const retracted = state({ turns: [turn('turn-a', 'bananas', true)], evidence: original.evidence, knowledgeGaps: [source] });
    expect(materializeAdventureSeed(retracted, request, 'Synthetic.', { now: () => NOW })).toBe(retracted);

    const madePrivate = state({ turns: original.turns, evidence: original.evidence, knowledgeGaps: [source], privateTopics: ['bananas'] });
    expect(materializeAdventureSeed(madePrivate, request, 'Synthetic.', { now: () => NOW })).toBe(madePrivate);

    const changedContext = state({ turns: original.turns, evidence: [evidence('evidence-a', ['turn-a'], { claim: 'New current eligible claim.' })], knowledgeGaps: [source] });
    expect(materializeAdventureSeed(changedContext, request, 'Synthetic.', { now: () => NOW })).toBe(changedContext);
  });

  it('rejects forged kind/learning target, malformed empty premise, and stale partial gap sets', () => {
    const campaign = state({ knowledgeGaps: [gap('gap-a', 90), gap('gap-b', 80)] });
    const request = requestFor(campaign);
    expect(request.gapIds).toEqual(['gap-a', 'gap-b']);

    expect(materializeAdventureSeed(campaign, { ...request, adventureKind: 'combat-forward-story' }, 'Synthetic.', { now: () => NOW })).toBe(campaign);
    expect(materializeAdventureSeed(campaign, { ...request, learningTarget: 'none' }, 'Synthetic.', { now: () => NOW })).toBe(campaign);
    expect(materializeAdventureSeed(campaign, { ...request, gapIds: ['gap-a'] }, 'Synthetic.', { now: () => NOW })).toBe(campaign);
    expect(materializeAdventureSeed(campaign, request, '   ', { now: () => NOW })).toBe(campaign);
  });

  it('selects only structurally eligible available seeds and excludes any seed already used by a run', () => {
    const base = state({ knowledgeGaps: [gap('gap-a', 90)] });
    const request = requestFor(base);
    const available = seedFrom(request, { id: 'available' });
    const started = seedFrom(request, { id: 'started', status: 'started' });
    const retired = seedFrom(request, { id: 'retired', status: 'retired' });
    const used = seedFrom(request, { id: 'used' });
    const ineligible = seedFrom(request, { id: 'ineligible', sourceGapIds: ['gap-retired'] });
    const campaign = state({
      knowledgeGaps: [gap('gap-a', 90, { status: 'seeded' }), gap('gap-retired', 50, { status: 'retired' })],
      adventureSeeds: [retired, available, used, started, ineligible],
      adventureRuns: [{ id: 'run-used', seedId: 'used', territoryId: 'atlas', locationId: 'atlas', status: 'complete', currentBeatId: 'consequence', recurringCharacterIds: [], memoryIds: [], startedAt: NOW, completedAt: NOW }]
    });

    expect(selectAvailableAdventureSeeds(campaign).map((seed) => seed.id)).toEqual(['available']);
  });

  it('dedupes legacy-equivalent available seeds for later consumers without mutating stored history', () => {
    const base = state({ knowledgeGaps: [gap('gap-a', 90)] });
    const request = requestFor(base);
    const duplicateB = seedFrom(request, { id: 'b-legacy', premise: 'Second synthetic wording.' });
    const duplicateA = seedFrom(request, { id: 'a-legacy', premise: 'First synthetic wording.' });
    const campaign = state({ knowledgeGaps: [gap('gap-a', 90, { status: 'seeded' })], adventureSeeds: [duplicateB, duplicateA] });
    const before = structuredClone(campaign);

    expect(selectAvailableAdventureSeeds(campaign).map((seed) => seed.id)).toEqual(['a-legacy']);
    expect(campaign).toEqual(before);
  });
});
