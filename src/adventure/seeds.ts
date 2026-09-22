import type { AdventureSeed } from '../contracts/adventure';
import type { CampaignState } from '../game/types';
import { buildGapSeedRequest, type GapSeedRequest } from '../knowledge/seed-request';
import { providerEligibleV2State } from '../persistence/retirement';

export interface AdventureSeedMaterializationOptions {
  now?: () => string;
}

const uniqueSorted = (values: readonly string[]) => [...new Set(values)].sort((left, right) => left.localeCompare(right));

function structuralSeedKey(source: Pick<GapSeedRequest, 'gapIds' | 'territoryId' | 'adventureKind' | 'learningTarget'>): string {
  return JSON.stringify({
    gapIds: uniqueSorted(source.gapIds),
    territoryId: source.territoryId,
    adventureKind: source.adventureKind,
    learningTarget: source.learningTarget
  });
}

function seedKey(seed: AdventureSeed): string {
  return JSON.stringify({
    gapIds: uniqueSorted(seed.sourceGapIds),
    territoryId: seed.territoryId,
    adventureKind: seed.kind,
    learningTarget: seed.learningTarget
  });
}

/** Collision-safe deterministic identity. Premise wording is deliberately absent. */
export function adventureSeedId(request: Pick<GapSeedRequest, 'gapIds' | 'territoryId' | 'adventureKind' | 'learningTarget'>): string {
  return `adventure-seed:${encodeURIComponent(structuralSeedKey(request))}`;
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

/**
 * Materialization revalidates the full bounded K07 context, not just source IDs.
 * This prevents a stale request from surviving a later privacy/retraction change.
 * Gap-ID order is normalized because it is structural set membership for A00.
 */
function requestStillCurrent(state: CampaignState, request: GapSeedRequest): boolean {
  const current = buildGapSeedRequest(state);
  if (!current) return false;
  return structuralSeedKey(current) === structuralSeedKey(request)
    && arraysEqual(current.permittedThemes, request.permittedThemes)
    && arraysEqual(current.forbiddenDimensions, request.forbiddenDimensions)
    && arraysEqual(current.evidenceClaims, request.evidenceClaims);
}

function equivalentSeedExists(state: CampaignState, request: GapSeedRequest): boolean {
  const key = structuralSeedKey(request);
  return state.adventureSeeds.some((seed) => seedKey(seed) === key || seed.id === adventureSeedId(request));
}

/**
 * A00 durable seed materialization.
 *
 * `premise` is non-authoritative narrative language supplied by a later local or
 * provider proposal lane. It cannot affect seed identity, eligibility, source
 * gaps, location, or learning target. World marker placement remains W02-owned;
 * until then the seed's logical location is the request territory itself.
 */
export function materializeAdventureSeed(
  state: CampaignState,
  request: GapSeedRequest,
  premise: string,
  options: AdventureSeedMaterializationOptions = {}
): CampaignState {
  if (equivalentSeedExists(state, request)) return state;
  if (premise.trim().length === 0) return state;
  if (!requestStillCurrent(state, request)) return state;

  const id = adventureSeedId(request);
  if (state.adventureSeeds.some((seed) => seed.id === id)) return state;

  const sourceGapIds = uniqueSorted(request.gapIds);
  const sourceGapIdSet = new Set(sourceGapIds);
  const seed: AdventureSeed = {
    id,
    sourceGapIds,
    kind: request.adventureKind,
    territoryId: request.territoryId,
    locationId: request.territoryId,
    premise,
    learningTarget: request.learningTarget,
    status: 'available'
  };
  const knowledgeGaps = state.knowledgeGaps.map((gap) => sourceGapIdSet.has(gap.id) && gap.status === 'open'
    ? { ...gap, status: 'seeded' as const }
    : gap
  );
  const at = options.now?.() ?? new Date().toISOString();
  return { ...state, knowledgeGaps, adventureSeeds: [...state.adventureSeeds, seed], updatedAt: at };
}

/** Deterministic available-seed view for later W02/A01 consumers. */
export function selectAvailableAdventureSeeds(state: CampaignState): AdventureSeed[] {
  const usedSeedIds = new Set(state.adventureRuns.map((run) => run.seedId));
  const eligible = providerEligibleV2State(state).adventureSeeds
    .filter((seed) => seed.status === 'available' && !usedSeedIds.has(seed.id))
    .sort((left, right) => left.id.localeCompare(right.id));
  const seenKeys = new Set<string>();
  return eligible.filter((seed) => {
    const key = seedKey(seed);
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });
}
