/**
 * Cross-domain requests are requests, never permission for a lane to mutate
 * campaign authority. The integration owner wires approved requests later.
 */
export type DomainRequest =
  | { type: 'REFLECTION_REQUESTED'; sourceIds: string[] }
  | { type: 'COMBAT_START_REQUESTED'; adventureRunId: string; combatDefinitionId: string }
  | { type: 'ADVENTURE_WITHDRAWAL_REQUESTED'; adventureRunId: string }
  | { type: 'SNAPSHOT_SYNTHESIS_REQUESTED'; sourceIds: string[] };

export type DomainResult =
  | { type: 'REFLECTION_RECORDED'; reflectionId: string }
  | { type: 'ADVENTURE_OBSERVATION_RECORDED'; observationId: string }
  | { type: 'COMBAT_RESOLVED'; combatDefinitionId: string; outcome: 'victory' | 'pacified' | 'escaped' | 'defeat' | 'story' }
  | { type: 'SNAPSHOT_SYNTHESIS_PROPOSED'; snapshotId: string };

export const FORBIDDEN_LANE_MUTATIONS = [
  'XP_AWARDED', 'LEVEL_AWARDED', 'ACHIEVEMENT_AWARDED', 'QUEST_COMPLETED',
  'WORLD_UNLOCKED', 'COMBAT_REWARD_AWARDED', 'SNAPSHOT_ELIGIBILITY_GRANTED'
] as const;

export const INTEGRATION_OWNER_SURFACES = [
  'src/App.tsx', 'src/game/types.ts', 'src/game/engine.ts', 'src/persistence/migrations.ts',
  'src/cartographer/schema.ts', 'worker/index.ts', 'package.json'
] as const;
