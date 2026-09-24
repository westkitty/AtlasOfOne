export const COMBAT_VERBS = ['attack', 'technique', 'guard', 'act', 'leave'] as const;
export type CombatVerb = typeof COMBAT_VERBS[number];

export const COMBAT_OBJECTIVES = [
  'defeat',
  'survive',
  'escape',
  'protect',
  'interrupt',
  'pacify',
  'reach-object',
  'hold-position',
  'escort',
  'discover-act'
] as const;
export type CombatObjective = typeof COMBAT_OBJECTIVES[number];

export const COMBAT_GIMMICKS = [
  'shielded',
  'charging',
  'counterattacking',
  'enraged',
  'healing',
  'swarm',
  'linked-pair',
  'stance-changing',
  'mimic-disguise',
  'unstable-terrain',
  'morale-fear',
  'timed-vulnerability',
  'environmental-hazard',
  'ally-in-danger',
  'non-kill-target'
] as const;
export type CombatGimmick = typeof COMBAT_GIMMICKS[number];

export const COMBAT_INTENTS = [
  'attack',
  'defend',
  'charge',
  'recover',
  'hazard',
  'objective-action',
  'special-act-reactive'
] as const;
export type CombatIntent = typeof COMBAT_INTENTS[number];

export const COMBAT_STATUS_IDS = [
  'guarded',
  'exposed',
  'charging',
  'staggered',
  'pacifiable',
  'protected-target'
] as const;
export type CombatStatusId = typeof COMBAT_STATUS_IDS[number];

export type CombatSide = 'player' | 'enemy' | 'ally';
export type CombatPhase = 'player' | 'enemy' | 'resolved';
export type CombatOutcome = 'victory' | 'pacified' | 'escaped' | 'defeat' | 'story';
export type CombatFleeRule = 'always' | 'after-turn' | 'story-gated';

export type FixedCombatRewardKind =
  | 'story-consequence'
  | 'encounter-progress'
  | 'world-change'
  | 'route-access'
  | 'npc-memory'
  | 'journal-artifact'
  | 'cosmetic-relic'
  | 'xp'
  | 'technique'
  | 'scene-access';

export interface FixedCombatReward {
  id: string;
  kind: FixedCombatRewardKind;
  /** Fixed numeric amount when the reward family needs one, e.g. bounded XP. */
  amount?: number;
  /** Stable project-owned key for a route, scene, technique, artifact, etc. */
  key?: string;
}

export interface CombatantDefinition {
  id: string;
  label: string;
  side: CombatSide;
  maxHp: number;
  startingHp?: number;
  /**
   * Encounter-local Technique charges. Omitted player value defaults to the C00
   * baseline of 2; non-player combatants default to 0.
   */
  techniqueCharges?: number;
}

export interface CombatantState {
  id: string;
  side: CombatSide;
  maxHp: number;
  hp: number;
  techniqueCharges: number;
}

export interface CombatStatus {
  id: string;
  status: CombatStatusId;
  targetId: string;
  remainingRounds: number;
}

export interface CombatDefinition {
  id: string;
  encounterId: string;
  objective: CombatObjective;
  gimmicks: CombatGimmick[];
  combatants: CombatantDefinition[];
  turnLimit?: number;
  rewards: FixedCombatReward[];
  fleeRule: CombatFleeRule;
  /**
   * Player acts first unless an explicitly authored encounter telegraphs an
   * ambush. No random initiative exists.
   */
  openingPhase?: Exclude<CombatPhase, 'resolved'>;
  openingReason?: 'ambush';
}

export interface CombatState {
  definitionId: string;
  round: number;
  phase: CombatPhase;
  combatants: CombatantState[];
  statuses: CombatStatus[];
  objectiveProgress: number;
  outcome?: CombatOutcome;
}

/**
 * C01 owns lifecycle only. Verb/mechanics events are added by C02-C10 inside
 * the Combat lane rather than smuggling mechanics into this foundation packet.
 */
export type CombatLifecycleEvent =
  | { type: 'END_PLAYER_PHASE' }
  | { type: 'END_ENEMY_PHASE' }
  | { type: 'RESOLVE'; outcome: CombatOutcome };


export interface CombatAttackCommand {
  actorId: string;
  targetId: string;
  /**
   * Injected input quality only. C14 owns the accessible timing UI; mechanics
   * never read animation clocks or random state.
   */
  timedSuccess?: boolean;
}

export interface CombatAttackResolution {
  state: CombatState;
  actorId: string;
  targetId: string;
  damage: number;
  timedSuccess: boolean;
  targetDefeated: boolean;
}
