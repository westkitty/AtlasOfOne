import type { CombatDefinition, CombatGimmick, CombatObjective } from '../contracts/combat';

/**
 * C00 deterministic combat policy.
 *
 * These are implementation defaults from MASTER_INTEGRATION_PLAN Appendix I.
 * They are intentionally small, integer-friendly, encounter-local, and may be
 * retuned only through C17 with simulation/browser evidence.
 */
export const COMBAT_RULES_VERSION = 1 as const;

export const COMBAT_TUNING = {
  playerStartingHp: 100,
  attackBaseDamage: 18,
  attackTimedBonus: 6,
  guardReduction: 0.5,
  timedGuardReduction: 0.75,
  techniqueChargesAtStart: 2,
  statusDurationRounds: { min: 1, max: 2 },
  enemyEffectiveHp: {
    ordinary: { min: 35, max: 70 },
    elite: { min: 80, max: 130 },
    bossPhase: { min: 110, max: 180 }
  },
  ordinaryEnemyActionDamage: { min: 10, max: 22 },
  ordinaryEnemyCount: { min: 1, max: 3 },
  turnTargets: {
    ordinary: { min: 2, max: 5 },
    elite: { min: 4, max: 7 },
    bossPhase: { min: 5, max: 9 },
    survival: { min: 3, max: 5 }
  },
  actProgressRequired: 3
} as const;

export type CombatTimingGrade = 'base' | 'timed';
export const COMBAT_TIMING_GRADES = ['base', 'timed'] as const satisfies readonly CombatTimingGrade[];

export type CombatStatusKind =
  | 'guarded'
  | 'exposed'
  | 'charging'
  | 'staggered'
  | 'pacifiable'
  | 'protected-target';
export const COMBAT_STATUS_KINDS = [
  'guarded', 'exposed', 'charging', 'staggered', 'pacifiable', 'protected-target'
] as const satisfies readonly CombatStatusKind[];

export type CombatIntentKind =
  | 'attack'
  | 'defend'
  | 'charge'
  | 'recover'
  | 'hazard'
  | 'objective-action'
  | 'special-act-reactive';
export const COMBAT_INTENT_KINDS = [
  'attack', 'defend', 'charge', 'recover', 'hazard', 'objective-action', 'special-act-reactive'
] as const satisfies readonly CombatIntentKind[];

/**
 * C07's first objective slice is chosen to unlock the downstream fixtures
 * named by the plan: pacify (C15) plus protect/interrupt/survive (C16), with
 * ordinary defeat as the baseline. Escape remains owned by C06 LEAVE rules.
 */
export const COMBAT_MVP_OBJECTIVES = [
  'defeat', 'survive-turns', 'protect-target', 'interrupt-charged-action', 'pacify'
] as const satisfies readonly CombatObjective[];

export type CombatObjectiveResolutionMode =
  | 'enemy-defeat'
  | 'turn-limit'
  | 'leave'
  | 'protect-ally'
  | 'interrupt-charge'
  | 'act-progress'
  | 'object-progress'
  | 'hold-position'
  | 'escort-progress';

export interface CombatObjectiveRule {
  resolution: CombatObjectiveResolutionMode;
  mvp: boolean;
  requiresTurnLimit?: boolean;
  requiresAlly?: boolean;
  requiredGimmick?: CombatGimmick;
  progressTarget?: number;
}

/**
 * Static objective semantics. C07 owns runtime resolution; C00 only freezes the
 * data prerequisites so C01 can fail closed instead of guessing.
 */
export const COMBAT_OBJECTIVE_RULES: Readonly<Record<CombatObjective, CombatObjectiveRule>> = {
  defeat: { resolution: 'enemy-defeat', mvp: true },
  'survive-turns': { resolution: 'turn-limit', mvp: true, requiresTurnLimit: true },
  escape: { resolution: 'leave', mvp: false },
  'protect-target': { resolution: 'protect-ally', mvp: true, requiresAlly: true },
  'interrupt-charged-action': { resolution: 'interrupt-charge', mvp: true, requiredGimmick: 'charging' },
  pacify: { resolution: 'act-progress', mvp: true, progressTarget: COMBAT_TUNING.actProgressRequired },
  'break-object': { resolution: 'object-progress', mvp: false },
  'hold-position': { resolution: 'hold-position', mvp: false, requiresTurnLimit: true },
  escort: { resolution: 'escort-progress', mvp: false, requiresAlly: true },
  'discover-act': { resolution: 'act-progress', mvp: false, progressTarget: COMBAT_TUNING.actProgressRequired }
};

export const COMBAT_INITIATIVE_POLICY = {
  defaultFirstPhase: 'player',
  ambushMayOverride: true,
  ambushRequiresStoryTelegraph: true
} as const;

function requireNonNegativeInteger(value: number, label: string): number {
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 0) {
    throw new RangeError(`${label} must be a finite non-negative integer.`);
  }
  return value;
}

/** Base ATTACK always works. Timed input only adds the fixed Appendix-I bonus. */
export function resolveAttackDamage(timing: CombatTimingGrade): number {
  return COMBAT_TUNING.attackBaseDamage + (timing === 'timed' ? COMBAT_TUNING.attackTimedBonus : 0);
}

/**
 * GUARD never depends on animation timing. The caller supplies the deterministic
 * timing grade; mitigation rounds upward so fractional residual damage is never
 * silently rounded away.
 */
export function resolveGuardedDamage(incomingDamage: number, timing: CombatTimingGrade): number {
  const incoming = requireNonNegativeInteger(incomingDamage, 'incomingDamage');
  const reduction = timing === 'timed' ? COMBAT_TUNING.timedGuardReduction : COMBAT_TUNING.guardReduction;
  return Math.ceil(incoming * (1 - reduction));
}

export type CombatContractIssueCode =
  | 'blank-id'
  | 'duplicate-combatant-id'
  | 'duplicate-gimmick'
  | 'duplicate-reward-id'
  | 'missing-player'
  | 'multiple-players'
  | 'missing-enemy'
  | 'invalid-max-hp'
  | 'player-max-hp-mismatch'
  | 'invalid-turn-limit'
  | 'survival-turn-limit-out-of-range'
  | 'missing-turn-limit'
  | 'missing-ally'
  | 'missing-required-gimmick'
  | 'invalid-reward-amount';

export interface CombatContractIssue {
  code: CombatContractIssueCode;
  path: string;
  detail: string;
}

export interface CombatContractValidation {
  ok: boolean;
  issues: CombatContractIssue[];
}

const blank = (value: string) => value.trim().length === 0;
const duplicates = (values: readonly string[]) => values.filter((value, index) => values.indexOf(value) !== index);

/**
 * Read-only C00 static validation. It never repairs imported/content-authored
 * definitions and never invents objective targets. Runtime C01 must refuse a
 * definition that fails this gate.
 */
export function validateCombatDefinitionContract(definition: CombatDefinition): CombatContractValidation {
  const issues: CombatContractIssue[] = [];
  const push = (code: CombatContractIssueCode, path: string, detail: string) => issues.push({ code, path, detail });

  if (blank(definition.id)) push('blank-id', 'id', 'Combat definition id must be nonblank.');
  if (blank(definition.encounterId)) push('blank-id', 'encounterId', 'Encounter id must be nonblank.');

  const playerCount = definition.combatants.filter((combatant) => combatant.team === 'player').length;
  const enemyCount = definition.combatants.filter((combatant) => combatant.team === 'enemy').length;
  if (playerCount === 0) push('missing-player', 'combatants', 'Exactly one player combatant is required.');
  if (playerCount > 1) push('multiple-players', 'combatants', 'Exactly one player combatant is required.');
  if (enemyCount === 0) push('missing-enemy', 'combatants', 'At least one enemy combatant is required.');

  const player = playerCount === 1 ? definition.combatants.find((combatant) => combatant.team === 'player') : undefined;
  if (player && Number.isInteger(player.maxHp) && player.maxHp > 0 && player.maxHp !== COMBAT_TUNING.playerStartingHp) {
    push('player-max-hp-mismatch', 'combatants', `Player maxHp must equal encounter-local baseline ${COMBAT_TUNING.playerStartingHp}.`);
  }

  for (const [index, combatant] of definition.combatants.entries()) {
    if (blank(combatant.id)) push('blank-id', `combatants[${index}].id`, 'Combatant id must be nonblank.');
    if (blank(combatant.templateId)) push('blank-id', `combatants[${index}].templateId`, 'Combatant template id must be nonblank.');
    if (!Number.isFinite(combatant.maxHp) || !Number.isInteger(combatant.maxHp) || combatant.maxHp <= 0) {
      push('invalid-max-hp', `combatants[${index}].maxHp`, 'maxHp must be a positive integer.');
    }
  }
  for (const duplicate of new Set(duplicates(definition.combatants.map((combatant) => combatant.id)))) {
    push('duplicate-combatant-id', 'combatants', `Duplicate combatant id: ${duplicate}`);
  }
  for (const duplicate of new Set(duplicates(definition.gimmicks))) {
    push('duplicate-gimmick', 'gimmicks', `Duplicate gimmick: ${duplicate}`);
  }

  if (definition.turnLimit !== undefined && (!Number.isInteger(definition.turnLimit) || definition.turnLimit <= 0)) {
    push('invalid-turn-limit', 'turnLimit', 'turnLimit must be a positive integer when present.');
  }

  const objectiveRule = COMBAT_OBJECTIVE_RULES[definition.objective];
  if (objectiveRule.requiresTurnLimit && definition.turnLimit === undefined) {
    push('missing-turn-limit', 'turnLimit', `${definition.objective} requires an explicit deterministic turn limit.`);
  }
  if (definition.objective === 'survive-turns' && definition.turnLimit !== undefined
    && (definition.turnLimit < COMBAT_TUNING.turnTargets.survival.min || definition.turnLimit > COMBAT_TUNING.turnTargets.survival.max)) {
    push('survival-turn-limit-out-of-range', 'turnLimit',
      `MVP survive-turns limit must be ${COMBAT_TUNING.turnTargets.survival.min}-${COMBAT_TUNING.turnTargets.survival.max} rounds.`);
  }
  if (objectiveRule.requiresAlly && !definition.combatants.some((combatant) => combatant.team === 'ally')) {
    push('missing-ally', 'combatants', `${definition.objective} requires at least one ally combatant.`);
  }
  if (objectiveRule.requiredGimmick && !definition.gimmicks.includes(objectiveRule.requiredGimmick)) {
    push('missing-required-gimmick', 'gimmicks', `${definition.objective} requires gimmick ${objectiveRule.requiredGimmick}.`);
  }

  for (const [index, reward] of definition.rewards.entries()) {
    if (blank(reward.id)) push('blank-id', `rewards[${index}].id`, 'Reward id must be nonblank.');
    if (reward.amount !== undefined && (!Number.isFinite(reward.amount) || !Number.isInteger(reward.amount) || reward.amount < 0)) {
      push('invalid-reward-amount', `rewards[${index}].amount`, 'Reward amount must be a finite non-negative integer.');
    }
  }
  for (const duplicate of new Set(duplicates(definition.rewards.map((reward) => reward.id)))) {
    push('duplicate-reward-id', 'rewards', `Duplicate reward id: ${duplicate}`);
  }

  return { ok: issues.length === 0, issues };
}
