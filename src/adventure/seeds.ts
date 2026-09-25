import type { CampaignState } from '../game/types';
import type { AdventureSeedRequest } from '../knowledge/seedRequest';
import { adventureSeedRequestSchema } from '../knowledge/seedRequest';
import { createV2ProvenanceVisibility } from '../persistence/retirement';
import { adventureSeedSchema, type AdventureSeed } from './schema';

export const ADVENTURE_PREMISE_MAX_LENGTH = 600;

function cleanPremise(premise: string): string {
  const trimmed = premise.trim();
  if (!trimmed) throw new Error('AdventureSeed premise must not be empty.');
  if (trimmed.length > ADVENTURE_PREMISE_MAX_LENGTH) {
    throw new Error(`AdventureSeed premise exceeds ${ADVENTURE_PREMISE_MAX_LENGTH} characters.`);
  }
  return trimmed;
}

function requireId(id: string): string {
  if (!id.trim()) throw new Error('AdventureSeed id must not be empty.');
  return id;
}

/**
 * A00: materialise a K07 request into an AdventureSeed.
 *
 * Only `premise` is caller/model supplied. Gaps, territory, kind and
 * learningTarget are copied from the deterministic request and cannot be
 * overridden here.
 */
export function createAdventureSeedFromRequest(
  request: AdventureSeedRequest,
  input: { id: string; premise: string }
): AdventureSeed {
  const valid = adventureSeedRequestSchema.parse(request);
  return adventureSeedSchema.parse({
    id: requireId(input.id),
    sourceGapIds: [...new Set(valid.sourceGapIds)].sort(),
    kind: valid.kind,
    territoryId: valid.territoryId,
    premise: cleanPremise(input.premise),
    learningTarget: valid.learningTarget,
    status: 'available'
  });
}

/**
 * A09: pure-fun seed path. No KnowledgeGap, no learning target, no
 * reflection requirement. A pure-fun adventure is a complete success on its own.
 */
export function createPureFunAdventureSeed(input: {
  id: string;
  territoryId: string;
  premise: string;
}): AdventureSeed {
  if (!input.territoryId.trim()) throw new Error('AdventureSeed territoryId must not be empty.');
  return adventureSeedSchema.parse({
    id: requireId(input.id),
    sourceGapIds: [],
    kind: 'pure-fun',
    territoryId: input.territoryId,
    premise: cleanPremise(input.premise),
    learningTarget: 'none',
    status: 'available'
  });
}

/** Stable deduplication key: kind + territory + sorted source gaps. Premise wording is ignored. */
export function adventureSeedDedupKey(seed: Pick<AdventureSeed, 'kind' | 'territoryId' | 'sourceGapIds'>): string {
  return JSON.stringify([seed.kind, seed.territoryId, [...new Set(seed.sourceGapIds)].sort()]);
}

export interface AdmitAdventureSeedResult {
  seeds: AdventureSeed[];
  seed: AdventureSeed;
  deduplicated: boolean;
}

/**
 * A00 deduplication. A seed that structurally matches any prior seed (any
 * status, including started or retired) is not regenerated as though it never
 * occurred; the existing record is returned. Pure-fun seeds have no source gaps,
 * so they deduplicate by id only.
 */
export function admitAdventureSeed(
  seeds: readonly AdventureSeed[],
  candidate: AdventureSeed
): AdmitAdventureSeedResult {
  const parsed = adventureSeedSchema.parse(candidate);
  const byId = seeds.find((seed) => seed.id === parsed.id);
  if (byId) {
    if (adventureSeedDedupKey(byId) === adventureSeedDedupKey(parsed)) {
      return { seeds: [...seeds], seed: byId, deduplicated: true };
    }
    throw new Error(`AdventureSeed id already exists: ${parsed.id}`);
  }

  if (parsed.sourceGapIds.length > 0) {
    const key = adventureSeedDedupKey(parsed);
    const duplicate = seeds.find((seed) => adventureSeedDedupKey(seed) === key);
    if (duplicate) return { seeds: [...seeds], seed: duplicate, deduplicated: true };
  }

  return { seeds: [...seeds, parsed], seed: parsed, deduplicated: false };
}

/**
 * A00 eligibility: a seed may start only while `available` and while every
 * source gap is still structurally visible (not retired, not PRIVATE/retracted
 * sourced). Unknown source gaps fail closed.
 */
export function adventureSeedIsEligible(state: CampaignState, seed: AdventureSeed): boolean {
  if (seed.status !== 'available') return false;
  if (seed.sourceGapIds.length === 0) return seed.learningTarget === 'none';
  const visibility = createV2ProvenanceVisibility(state);
  return seed.sourceGapIds.every(visibility.knowledgeGapIsStructurallyVisible);
}

export function markAdventureSeedStarted(seed: AdventureSeed): AdventureSeed {
  if (seed.status !== 'available') {
    throw new Error(`AdventureSeed ${seed.id} is ${seed.status} and cannot start.`);
  }
  return { ...seed, status: 'started' };
}

export function retireAdventureSeed(seed: AdventureSeed): AdventureSeed {
  if (seed.status === 'retired') return seed;
  return { ...seed, status: 'retired' };
}
