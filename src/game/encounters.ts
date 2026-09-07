import {
  BOSS_DEFINITIONS,
  DOOR_LEVEL_REQUIRED,
  DOOR_MIN_EVIDENCE_PER_TERRITORY
} from './data';
import type {
  BossDefinition,
  BossRunState,
  BossStage,
  CampaignState,
  DoorRunState,
  EncounterStageKind,
  EvidenceRecord
} from './types';

/**
 * Deterministic eligibility, planning and progress rules for Boss Fights and
 * Mystery Doors. Nothing here consults the Cartographer: the model may supply
 * wording for a plan produced by these functions, never the plan itself.
 */

/** Active evidence whose dimension has not been marked private. */
export function usableEvidence(state: CampaignState): EvidenceRecord[] {
  return state.evidence.filter(
    (item) => item.status === 'active' && !state.privateTopics.includes(item.dimension)
  );
}

/** Stable ordering so plans do not depend on insertion timing. */
const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

// ---------------------------------------------------------------------------
// Boss Fight
// ---------------------------------------------------------------------------

export function bossDefinition(bossId: string): BossDefinition | undefined {
  return BOSS_DEFINITIONS.find((item) => item.id === bossId);
}

export function bossRunFor(state: CampaignState, bossId: string): BossRunState | undefined {
  return state.bossRuns.find((run) => run.bossId === bossId);
}

export function isBossComplete(state: CampaignState, bossId: string): boolean {
  return bossRunFor(state, bossId)?.status === 'complete';
}

/**
 * A Boss Fight becomes available purely from mapped campaign state: the move is
 * unlocked by level, the territory already carries enough non-private evidence
 * coverage, and the boss has not been resolved yet.
 */
export function isBossAvailable(state: CampaignState, bossId: string): boolean {
  const definition = bossDefinition(bossId);
  if (!definition) return false;
  if (state.level < definition.levelRequired) return false;
  if (isBossComplete(state, bossId)) return false;
  return bossCoveredDimensions(state, definition).length >= definition.minCoveredDimensions;
}

export function availableBosses(state: CampaignState): BossDefinition[] {
  return BOSS_DEFINITIONS.filter((definition) => isBossAvailable(state, definition.id));
}

/** Dimensions of the boss territory that are both evidenced and not private. */
function bossCoveredDimensions(state: CampaignState, definition: BossDefinition): string[] {
  const territory = state.territories.find((item) => item.id === definition.territoryId);
  if (!territory) return [];
  const evidenced = new Set(
    usableEvidence(state)
      .filter((item) => item.territories.includes(definition.territoryId))
      .map((item) => item.dimension)
  );
  return territory.requiredDimensions.filter(
    (dimension) => evidenced.has(dimension) && !state.privateTopics.includes(dimension)
  );
}

function evidenceForDimension(
  state: CampaignState,
  definition: BossDefinition,
  dimension: string
): EvidenceRecord[] {
  return usableEvidence(state)
    .filter(
      (item) => item.territories.includes(definition.territoryId) && item.dimension === dimension
    )
    .sort(byId);
}

/**
 * Build the deterministic stage skeleton for a Boss Fight from evidence the
 * player has already produced. Stage kinds escalate from weighing two mapped
 * commitments, to naming the cost of that choice, to facing the tension the
 * pairing exposes — a synthesis test rather than recall.
 */
export function planBossStages(state: CampaignState, bossId: string): BossStage[] {
  const definition = bossDefinition(bossId);
  if (!definition) return [];
  const dimensions = bossCoveredDimensions(state, definition);
  if (dimensions.length < definition.minCoveredDimensions) return [];

  const pick = (dimension: string) =>
    evidenceForDimension(state, definition, dimension).map((item) => item.id).slice(0, 1);

  const kinds: EncounterStageKind[] = ['priority', 'tradeoff', 'contradiction'];
  return kinds.map((kind, index): BossStage => {
    const first = dimensions[index % dimensions.length];
    const second = dimensions[(index + 1) % dimensions.length];
    const paired = kind === 'tradeoff' ? [first] : [first, second];
    return {
      id: `${bossId}_stage_${index + 1}`,
      kind,
      dimensions: paired,
      evidenceIds: [...new Set(paired.flatMap(pick))],
      outcome: 'pending'
    };
  });
}

/** Index of the first unresolved stage, or -1 when every stage is resolved. */
export function currentBossStageIndex(run: BossRunState | undefined): number {
  if (!run) return -1;
  return run.stages.findIndex((stage) => stage.outcome === 'pending');
}

export function currentBossStage(run: BossRunState | undefined): BossStage | undefined {
  const index = currentBossStageIndex(run);
  return index >= 0 ? run!.stages[index] : undefined;
}

export function activeBossRun(state: CampaignState): BossRunState | undefined {
  if (!state.activeBoss) return undefined;
  return state.bossRuns.find((run) => run.bossId === state.activeBoss && run.status === 'active');
}

// ---------------------------------------------------------------------------
// Mystery Door
// ---------------------------------------------------------------------------

/** Stable, order-independent identifier for a territory pairing. */
export function doorIdFor(territoryA: string, territoryB: string): string {
  return `door_${[territoryA, territoryB].sort().join('__')}`;
}

export function doorRunFor(state: CampaignState, doorId: string): DoorRunState | undefined {
  return state.doorRuns.find((run) => run.doorId === doorId);
}

export interface DoorCandidate {
  doorId: string;
  territoryIds: string[];
  evidenceIds: string[];
  dimensions: string[];
}

function doorEvidenceFor(state: CampaignState, territoryId: string): EvidenceRecord[] {
  return usableEvidence(state)
    .filter((item) => item.territories.includes(territoryId))
    .sort(byId);
}

/**
 * Mystery Doors pair two territories that each already hold enough non-private
 * evidence to make a cross-territory question meaningful. Private dimensions are
 * excluded from candidacy, so a Door can never be built out of private material
 * and never requires a private topic to open.
 */
export function availableDoors(state: CampaignState): DoorCandidate[] {
  if (state.level < DOOR_LEVEL_REQUIRED) return [];
  const territories = [...state.territories].sort(byId);
  const candidates: DoorCandidate[] = [];

  for (let a = 0; a < territories.length; a += 1) {
    for (let b = a + 1; b < territories.length; b += 1) {
      const left = doorEvidenceFor(state, territories[a].id);
      const right = doorEvidenceFor(state, territories[b].id);
      if (left.length < DOOR_MIN_EVIDENCE_PER_TERRITORY) continue;
      if (right.length < DOOR_MIN_EVIDENCE_PER_TERRITORY) continue;

      const doorId = doorIdFor(territories[a].id, territories[b].id);
      if (doorRunFor(state, doorId)) continue;

      const chosen = [left[0], right[0]];
      const dimensions = chosen.map((item) => item.dimension);
      if (dimensions.some((dimension) => state.privateTopics.includes(dimension))) continue;

      candidates.push({
        doorId,
        territoryIds: [territories[a].id, territories[b].id],
        evidenceIds: chosen.map((item) => item.id),
        dimensions
      });
    }
  }
  return candidates;
}

export function doorCandidate(state: CampaignState, doorId: string): DoorCandidate | undefined {
  return availableDoors(state).find((candidate) => candidate.doorId === doorId);
}

export function activeDoorRun(state: CampaignState): DoorRunState | undefined {
  if (!state.activeDoor) return undefined;
  return state.doorRuns.find((run) => run.doorId === state.activeDoor && run.status === 'open');
}

/**
 * A Door run is only presentable while none of the evidence it references has
 * become private or been retracted. This keeps an already-open Door from leaking
 * material the player closed after the fact.
 */
export function doorRunIsPresentable(state: CampaignState, run: DoorRunState): boolean {
  return run.evidenceIds.every((id) => {
    const record = state.evidence.find((item) => item.id === id);
    return Boolean(record) && record!.status === 'active' && !state.privateTopics.includes(record!.dimension);
  });
}
