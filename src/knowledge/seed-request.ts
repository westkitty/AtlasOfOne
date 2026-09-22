import type { AdventureKind, AdventureLearningTarget } from '../contracts/adventure';
import type { KnowledgeGap, KnowledgeGapKind } from '../contracts/reflection';
import type { CampaignState, EvidenceRecord } from '../game/types';
import { selectDiverseKnowledgeGaps } from './gaps';

export interface GapSeedRequest {
  gapIds: string[];
  territoryId: string;
  adventureKind: AdventureKind;
  permittedThemes: string[];
  forbiddenDimensions: string[];
  evidenceClaims: string[];
  learningTarget: AdventureLearningTarget;
}

export interface GapSeedRequestOptions {
  /** Maximum selected Knowledge gaps represented in one request. Hard-capped. */
  gapLimit?: number;
  /** Maximum evidence claims allowed to cross this boundary. Hard-capped. */
  evidenceClaimLimit?: number;
  /** Maximum characters retained from any one eligible evidence claim. Hard-capped. */
  evidenceClaimChars?: number;
}

export const K07_MAX_GAPS = 3;
export const K07_MAX_EVIDENCE_CLAIMS = 6;
export const K07_MAX_EVIDENCE_CLAIM_CHARS = 240;

const ADVENTURE_KIND_BY_GAP_KIND: Record<KnowledgeGapKind, AdventureKind> = {
  unknown: 'exploration-expedition',
  underexplored: 'investigation',
  curiosity: 'exploration-expedition',
  contradiction: 'mystery-puzzle',
  change: 'memory-echo'
};

const normalizedBound = (value: number | undefined, fallback: number, hardMax: number): number => {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(hardMax, Math.floor(value));
};

const uniqueSorted = (values: readonly string[]) => [...new Set(values)].sort((left, right) => left.localeCompare(right));

function eligibleEvidenceById(state: CampaignState): Map<string, EvidenceRecord> {
  const turnsById = new Map(state.turns.map((turn) => [turn.id, turn]));
  return new Map(
    state.evidence
      .filter((evidence) => evidence.status === 'active')
      .filter((evidence) => !state.privateTopics.includes(evidence.dimension))
      .filter((evidence) => evidence.sourceTurnIds.length > 0)
      .filter((evidence) => evidence.sourceTurnIds.every((turnId) => {
        const turn = turnsById.get(turnId);
        return Boolean(turn && !turn.retracted && !state.privateTopics.includes(turn.dimension));
      }))
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((evidence) => [evidence.id, evidence])
  );
}

function primaryTerritoryId(state: CampaignState, primary: KnowledgeGap): string | null {
  const knownTerritories = new Set(state.territories.map((territory) => territory.id));
  return uniqueSorted(primary.territoryIds).find((id) => knownTerritories.has(id)) ?? null;
}

function selectedForTerritory(selected: readonly KnowledgeGap[], territoryId: string, limit: number): KnowledgeGap[] {
  return selected.filter((gap) => gap.territoryIds.includes(territoryId)).slice(0, limit);
}

function evidenceClaimsFor(
  state: CampaignState,
  selected: readonly KnowledgeGap[],
  territoryId: string,
  claimLimit: number,
  claimChars: number
): string[] {
  if (claimLimit <= 0 || claimChars <= 0) return [];
  const eligible = eligibleEvidenceById(state);
  const ids: string[] = [];
  const seenIds = new Set<string>();

  for (const gap of selected) {
    for (const id of [...gap.sourceEvidenceIds].sort((left, right) => left.localeCompare(right))) {
      if (seenIds.has(id)) continue;
      seenIds.add(id);
      ids.push(id);
    }
  }

  const claims: string[] = [];
  const seenClaims = new Set<string>();
  for (const id of ids) {
    const evidence = eligible.get(id);
    if (!evidence || !evidence.territories.includes(territoryId)) continue;
    const claim = evidence.claim.slice(0, claimChars);
    if (!claim || seenClaims.has(claim)) continue;
    seenClaims.add(claim);
    claims.push(claim);
    if (claims.length >= claimLimit) break;
  }
  return claims;
}

/**
 * K07 boundary: deterministic, read-only Knowledge -> seed request compilation.
 *
 * This does not create or persist AdventureSeed state and it never calls a
 * provider. Selection/ranking remains owned by K04; this function only compiles
 * bounded structurally eligible inputs for the later Adventure/provider lanes.
 */
export function buildGapSeedRequest(state: CampaignState, options: GapSeedRequestOptions = {}): GapSeedRequest | null {
  const gapLimit = normalizedBound(options.gapLimit, K07_MAX_GAPS, K07_MAX_GAPS);
  const claimLimit = normalizedBound(options.evidenceClaimLimit, K07_MAX_EVIDENCE_CLAIMS, K07_MAX_EVIDENCE_CLAIMS);
  const claimChars = normalizedBound(options.evidenceClaimChars, K07_MAX_EVIDENCE_CLAIM_CHARS, K07_MAX_EVIDENCE_CLAIM_CHARS);
  if (gapLimit <= 0) return null;

  const selected = selectDiverseKnowledgeGaps(state, { limit: gapLimit });
  const primary = selected[0];
  if (!primary) return null;

  const territoryId = primaryTerritoryId(state, primary);
  if (!territoryId) return null;

  const territoryGaps = selectedForTerritory(selected, territoryId, gapLimit);
  if (territoryGaps.length === 0) return null;

  const permittedThemes = uniqueSorted(
    territoryGaps.flatMap((gap) => gap.dimensionIds).filter((dimensionId) => !state.privateTopics.includes(dimensionId))
  );

  return {
    gapIds: territoryGaps.map((gap) => gap.id),
    territoryId,
    adventureKind: ADVENTURE_KIND_BY_GAP_KIND[primary.kind],
    permittedThemes,
    forbiddenDimensions: uniqueSorted(state.privateTopics),
    evidenceClaims: evidenceClaimsFor(state, territoryGaps, territoryId, claimLimit, claimChars),
    learningTarget: 'reflection-eligible'
  };
}
