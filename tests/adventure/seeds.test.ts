import { describe, expect, it } from 'vitest';
import {
  admitAdventureSeed,
  adventureSeedIsEligible,
  createAdventureSeedFromRequest,
  createPureFunAdventureSeed,
  markAdventureSeedStarted,
  retireAdventureSeed
} from '../../src/adventure/seeds';
import { createInitialCampaign } from '../../src/game/engine';
import type { CampaignState } from '../../src/game/types';
import { createJournalEntry } from '../../src/journal/domain';
import type { KnowledgeGap } from '../../src/knowledge/schema';
import type { AdventureSeedRequest } from '../../src/knowledge/seedRequest';

const request: AdventureSeedRequest = {
  requestVersion: 1,
  gapId: 'gap_a',
  sourceGapIds: ['gap_a'],
  territoryId: 'identity',
  dimensionIds: ['self-description'],
  kind: 'investigation',
  learningTarget: 'reflection-eligible',
  excludedGapIds: [],
  scoring: { basePriority: 50, relevancePoints: 0, rankedPriority: 50, exactRepeatCoolingDown: false }
};

function gap(overrides: Partial<KnowledgeGap> = {}): KnowledgeGap {
  return {
    id: 'gap_a', kind: 'underexplored', territoryIds: ['identity'], dimensionIds: ['self-description'],
    sourceEvidenceIds: [], sourceJournalEntryIds: [], summary: 'Synthetic.', status: 'open', priority: 0,
    ...overrides
  };
}

function stateWith(gaps: KnowledgeGap[], extra: Partial<CampaignState> = {}): CampaignState {
  return { ...createInitialCampaign(), knowledgeGaps: gaps, ...extra };
}

describe('AdventureSeed state/eligibility/dedup (A00)', () => {
  it('copies deterministic fields from the request; only premise is supplied', () => {
    const seed = createAdventureSeedFromRequest(request, { id: 'seed_1', premise: '  A lantern flickers.  ' });
    expect(seed).toEqual({
      id: 'seed_1', sourceGapIds: ['gap_a'], kind: 'investigation', territoryId: 'identity',
      premise: 'A lantern flickers.', learningTarget: 'reflection-eligible', status: 'available'
    });
  });

  it('rejects tampered requests (pure-fun kind, learningTarget none, extra keys)', () => {
    expect(() => createAdventureSeedFromRequest({ ...request, kind: 'pure-fun' } as unknown as AdventureSeedRequest, { id: 's', premise: 'p' })).toThrow();
    expect(() => createAdventureSeedFromRequest(
      { ...request, learningTarget: 'none' } as unknown as AdventureSeedRequest, { id: 's', premise: 'p' }
    )).toThrow();
    expect(() => createAdventureSeedFromRequest(
      { ...request, priorityOverride: 9 } as unknown as AdventureSeedRequest, { id: 's', premise: 'p' }
    )).toThrow();
  });

  it('rejects empty ids and empty/oversized premises', () => {
    expect(() => createAdventureSeedFromRequest(request, { id: ' ', premise: 'p' })).toThrow();
    expect(() => createAdventureSeedFromRequest(request, { id: 's', premise: '   ' })).toThrow();
    expect(() => createAdventureSeedFromRequest(request, { id: 's', premise: 'x'.repeat(601) })).toThrow();
  });

  it('deduplicates structurally equal seeds regardless of premise or prior status', () => {
    const first = createAdventureSeedFromRequest(request, { id: 'seed_1', premise: 'One.' });
    const started = markAdventureSeedStarted(first);
    const again = createAdventureSeedFromRequest(request, { id: 'seed_2', premise: 'Different words.' });
    const result = admitAdventureSeed([started], again);
    expect(result.deduplicated).toBe(true);
    expect(result.seed.id).toBe('seed_1');
    expect(result.seeds).toHaveLength(1);
  });

  it('admits a different kind for the same gap and rejects id collisions', () => {
    const first = createAdventureSeedFromRequest(request, { id: 'seed_1', premise: 'One.' });
    const other = createAdventureSeedFromRequest({ ...request, kind: 'social-dilemma' }, { id: 'seed_2', premise: 'Two.' });
    expect(admitAdventureSeed([first], other).seeds).toHaveLength(2);
    expect(() => admitAdventureSeed([first], { ...other, id: 'seed_1' })).toThrow(/already exists/);
    expect(admitAdventureSeed([first], first).deduplicated).toBe(true);
  });

  it('is eligible only while available with visible source gaps', () => {
    const seed = createAdventureSeedFromRequest(request, { id: 'seed_1', premise: 'One.' });
    expect(adventureSeedIsEligible(stateWith([gap()]), seed)).toBe(true);
    expect(adventureSeedIsEligible(stateWith([gap({ status: 'retired' })]), seed)).toBe(false);
    expect(adventureSeedIsEligible(stateWith([]), seed)).toBe(false);
    expect(adventureSeedIsEligible(stateWith([gap()]), markAdventureSeedStarted(seed))).toBe(false);
    expect(adventureSeedIsEligible(stateWith([gap()]), retireAdventureSeed(seed))).toBe(false);
  });

  it('PRIVACY: a seed whose gap is PRIVATE-sourced is ineligible', () => {
    const entry = {
      ...createJournalEntry({ id: 'j1', createdAt: '2026-01-02T03:04:05.000Z', text: 'Synthetic.', inputMode: 'typed' }),
      privacy: 'private' as const
    };
    const seed = createAdventureSeedFromRequest(request, { id: 'seed_1', premise: 'One.' });
    expect(adventureSeedIsEligible(
      stateWith([gap({ sourceJournalEntryIds: ['j1'] })], { journalEntries: [entry] }), seed
    )).toBe(false);
  });

  it('start transition is one-way; retirement is idempotent', () => {
    const seed = createAdventureSeedFromRequest(request, { id: 'seed_1', premise: 'One.' });
    const started = markAdventureSeedStarted(seed);
    expect(started.status).toBe('started');
    expect(() => markAdventureSeedStarted(started)).toThrow();
    const retired = retireAdventureSeed(started);
    expect(retireAdventureSeed(retired)).toBe(retired);
  });
});

describe('pure-fun seed path (A09)', () => {
  it('creates a gap-free seed with learningTarget none', () => {
    const seed = createPureFunAdventureSeed({ id: 'fun_1', territoryId: 'identity', premise: 'A goose steals a hat.' });
    expect(seed).toMatchObject({ kind: 'pure-fun', sourceGapIds: [], learningTarget: 'none', status: 'available' });
  });

  it('is eligible without any KnowledgeGap', () => {
    const seed = createPureFunAdventureSeed({ id: 'fun_1', territoryId: 'identity', premise: 'Goose.' });
    expect(adventureSeedIsEligible(stateWith([]), seed)).toBe(true);
  });

  it('a gap-free seed claiming reflection-eligible is not eligible', () => {
    const seed = createPureFunAdventureSeed({ id: 'fun_1', territoryId: 'identity', premise: 'Goose.' });
    expect(adventureSeedIsEligible(stateWith([]), { ...seed, learningTarget: 'reflection-eligible' })).toBe(false);
  });

  it('pure-fun seeds deduplicate by id only', () => {
    const a = createPureFunAdventureSeed({ id: 'fun_1', territoryId: 'identity', premise: 'Goose.' });
    const b = createPureFunAdventureSeed({ id: 'fun_2', territoryId: 'identity', premise: 'Otter.' });
    expect(admitAdventureSeed([a], b).seeds).toHaveLength(2);
  });
});
