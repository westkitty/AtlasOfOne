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

export const COMBAT_TECHNIQUE_JOBS = [
  'interrupt-charge',
  'protect-ally',
  'expose-shield',
  'reposition-objective',
  'trade-damage-for-control'
] as const;
export type CombatTechniqueJob = typeof COMBAT_TECHNIQUE_JOBS[number];

export interface CombatTechniqueDefinition {
  id: string;
  label: string;
  job: CombatTechniqueJob;
  /** Encounter-local charges spent on activation. */
  chargeCost: number;
  /**
   * Number of additional full rounds that must pass before the Technique can
   * be used again. 0 means it is available again on the next player round.
   */
  cooldownRounds: number;
}

export const COMBAT_ACT_JOBS = [
  'reveal-information',
  'pacify-progress',
  'interrupt',
  'redirect',
  'objective-progress'
] as const;
export type CombatActJob = typeof COMBAT_ACT_JOBS[number];

export const COMBAT_ACT_TARGET_KINDS = [
  'enemy',
  'ally',
  'object',
  'terrain',
  'objective'
] as const;
export type CombatActTargetKind = typeof COMBAT_ACT_TARGET_KINDS[number];

export interface CombatActDefinition {
  id: string;
  label: string;
  job: CombatActJob;
  targetKind: CombatActTargetKind;
  /**
   * Combatant ID for enemy/ally targets or a stable authored encounter key for
   * object/terrain targets. Objective ACTs do not require a targetId.
   */
  targetId?: string;
  /**
   * Scenario-owned 0-3 step path. Zero-step ACTs complete immediately (for
   * example revealing information); 1-3 step ACTs advance one deterministic
   * step per use.
   */
  requiredSteps: 0 | 1 | 2 | 3;
  /**
   * Stable authored hook that a later Adventure integration may convert into
   * an AdventureObservation. C05 itself never creates personal Evidence.
   */
  observationKey?: string;
}


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
  /** Small encounter-local registry. Empty/omitted means TECHNIQUE has no options. */
  techniques?: CombatTechniqueDefinition[];
  /** Scenario-authored ACT choices. Empty/omitted means ACT has no contextual option. */
  actOptions?: CombatActDefinition[];
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
  /** Absolute combat round on/after which each Technique may be used again. */
  techniqueReadyRound: Record<string, number>;
  /** Scenario-local ACT path progress; this is not personality evidence. */
  actProgressById: Record<string, number>;
  /** Completed ACT paths cannot be farmed/replayed for repeated mechanics. */
  completedActIds: string[];
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


export interface CombatGuardCommand {
  actorId: string;
  /** Injected optional timing result. Missing/false remains a valid ordinary GUARD. */
  timedSuccess?: boolean;
}

export interface CombatGuardResolution {
  actorId: string;
  rawDamage: number;
  damageTaken: number;
  damagePrevented: number;
  timedSuccess: boolean;
}


export interface CombatTechniqueCommand {
  actorId: string;
  techniqueId: string;
}

export interface CombatTechniqueActivation {
  state: CombatState;
  actorId: string;
  techniqueId: string;
  job: CombatTechniqueJob;
  chargeCost: number;
  nextUsableRound: number;
}

export interface CombatActCommand {
  actorId: string;
  actId: string;
}

export interface CombatActResolution {
  state: CombatState;
  actorId: string;
  actId: string;
  job: CombatActJob;
  targetKind: CombatActTargetKind;
  targetId?: string;
  previousProgress: number;
  progress: number;
  requiredSteps: 0 | 1 | 2 | 3;
  completed: boolean;
  observationKey?: string;
}

export interface CombatLeaveCommand {
  actorId: string;
}

/**
 * Deterministic encounter-owned context for evaluating LEAVE eligibility.
 * This is deliberately separate from the player's command.
 */
export interface CombatLeaveContext {
  storyGateOpen?: boolean;
}

export interface CombatLeaveResolution {
  state: CombatState;
  actorId: string;
  fleeRule: CombatFleeRule;
  outcome: Extract<CombatOutcome, 'escaped' | 'story'>;
  failForward: true;
}

