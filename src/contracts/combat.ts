export type CombatCommandKind = 'ATTACK' | 'TECHNIQUE' | 'GUARD' | 'ACT' | 'LEAVE';
export const COMBAT_COMMAND_KINDS = ['ATTACK', 'TECHNIQUE', 'GUARD', 'ACT', 'LEAVE'] as const;

export type CombatObjective =
  | 'defeat' | 'survive-turns' | 'escape' | 'protect-target' | 'interrupt-charged-action'
  | 'pacify' | 'break-object' | 'hold-position' | 'escort' | 'discover-act';
export type CombatGimmick =
  | 'shielded' | 'charging' | 'counterattacking' | 'enraged' | 'healing' | 'swarm'
  | 'linked-pair' | 'stance-changing' | 'mimic-disguise' | 'unstable-terrain'
  | 'morale-fear' | 'timed-vulnerability' | 'environmental-hazard' | 'ally-in-danger'
  | 'nonlethal';
export type CombatPhase = 'player' | 'enemy' | 'resolved';
export type CombatOutcome = 'victory' | 'pacified' | 'escaped' | 'defeat' | 'story';

export interface CombatantDefinition { id: string; templateId: string; team: 'player' | 'enemy' | 'ally'; maxHp: number; }
export interface CombatantState { id: string; currentHp: number; statuses: string[]; }
export interface FixedCombatReward { id: string; kind: 'story' | 'map' | 'route' | 'memory' | 'artifact' | 'xp' | 'technique'; amount?: number; }

export interface CombatDefinition {
  id: string;
  encounterId: string;
  objective: CombatObjective;
  gimmicks: CombatGimmick[];
  combatants: CombatantDefinition[];
  turnLimit?: number;
  rewards: FixedCombatReward[];
  fleeRule: 'always' | 'after-turn' | 'story-gated';
}

export interface CombatState {
  definitionId: string;
  round: number;
  phase: CombatPhase;
  combatants: CombatantState[];
  statuses: string[];
  objectiveProgress: number;
  outcome?: CombatOutcome;
}

export interface CombatCommand {
  kind: CombatCommandKind;
  targetId?: string;
  techniqueId?: string;
  actId?: string;
}
