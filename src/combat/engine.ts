import type {
  CombatAttackCommand,
  CombatAttackResolution,
  CombatGuardCommand,
  CombatGuardResolution,
  CombatTechniqueActivation,
  CombatTechniqueCommand,
  CombatTechniqueDefinition,
  CombatDefinition,
  CombatLifecycleEvent,
  CombatState,
  CombatantDefinition,
  CombatantState,
  FixedCombatReward
} from './types';

export const DEFAULT_COMBAT_HP = 100;
export const DEFAULT_TECHNIQUE_CHARGES = 2;
export const BASE_ATTACK_DAMAGE = 18;
export const TIMED_ATTACK_BONUS = 6;
export const GUARD_REDUCTION = 0.50;
export const PERFECT_GUARD_REDUCTION = 0.75;

const positiveInteger = (value: number) => Number.isInteger(value) && value > 0;
const nonNegativeInteger = (value: number) => Number.isInteger(value) && value >= 0;

function uniqueIds(items: readonly { id: string }[], label: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (!item.id) throw new Error(`${label} id must not be empty.`);
    if (ids.has(item.id)) throw new Error(`Duplicate ${label} id: ${item.id}`);
    ids.add(item.id);
  }
}

function validateCombatant(definition: CombatantDefinition): void {
  if (!definition.label.trim()) throw new Error(`Combatant ${definition.id} needs a label.`);
  if (!positiveInteger(definition.maxHp)) {
    throw new Error(`Combatant ${definition.id} maxHp must be a positive integer.`);
  }
  if (
    definition.startingHp !== undefined
    && (!positiveInteger(definition.startingHp) || definition.startingHp > definition.maxHp)
  ) {
    throw new Error(`Combatant ${definition.id} startingHp must be within 1..maxHp.`);
  }
  if (definition.techniqueCharges !== undefined && !nonNegativeInteger(definition.techniqueCharges)) {
    throw new Error(`Combatant ${definition.id} techniqueCharges must be a non-negative integer.`);
  }
}

function validateTechnique(technique: CombatTechniqueDefinition): void {
  if (!technique.id.trim()) throw new Error('Combat Technique id must not be empty.');
  if (!technique.label.trim()) {
    throw new Error(`Combat Technique ${technique.id} needs a label.`);
  }
  if (!positiveInteger(technique.chargeCost)) {
    throw new Error(`Combat Technique ${technique.id} chargeCost must be a positive integer.`);
  }
  if (technique.chargeCost > DEFAULT_TECHNIQUE_CHARGES) {
    throw new Error(
      `Combat Technique ${technique.id} chargeCost exceeds the C00 encounter charge baseline.`
    );
  }
  if (!nonNegativeInteger(technique.cooldownRounds)) {
    throw new Error(
      `Combat Technique ${technique.id} cooldownRounds must be a non-negative integer.`
    );
  }
}

function validateReward(reward: FixedCombatReward): void {
  if (reward.amount !== undefined && (!Number.isFinite(reward.amount) || reward.amount < 0)) {
    throw new Error(`Combat reward ${reward.id} amount must be a non-negative finite number.`);
  }
  if (reward.kind === 'xp' && reward.amount === undefined) {
    throw new Error(`Combat XP reward ${reward.id} requires a fixed amount.`);
  }
  if (reward.kind === 'xp' && !nonNegativeInteger(reward.amount!)) {
    throw new Error(`Combat XP reward ${reward.id} amount must be a non-negative integer.`);
  }
}

/**
 * Deterministic structural validation for authored encounter definitions.
 *
 * This validates the C01 foundation only. Objective reachability, gimmick
 * compatibility and anti-grind simulation are later C07-C17 gates.
 */
export function validateCombatDefinition(definition: CombatDefinition): CombatDefinition {
  if (!definition.id) throw new Error('CombatDefinition id must not be empty.');
  if (!definition.encounterId) throw new Error('CombatDefinition encounterId must not be empty.');
  if (definition.combatants.length < 2) throw new Error('CombatDefinition needs at least two combatants.');

  uniqueIds(definition.combatants, 'combatant');
  uniqueIds(definition.rewards, 'combat reward');
  uniqueIds(definition.techniques ?? [], 'combat technique');

  for (const combatant of definition.combatants) validateCombatant(combatant);
  for (const reward of definition.rewards) validateReward(reward);
  for (const technique of definition.techniques ?? []) validateTechnique(technique);

  const players = definition.combatants.filter((combatant) => combatant.side === 'player');
  const enemies = definition.combatants.filter((combatant) => combatant.side === 'enemy');

  if (players.length !== 1) throw new Error('CombatDefinition requires exactly one player combatant.');
  if (enemies.length < 1) throw new Error('CombatDefinition requires at least one enemy combatant.');

  const player = players[0];
  if (player.maxHp !== DEFAULT_COMBAT_HP) {
    throw new Error(`C01 player maxHp must use the C00 baseline of ${DEFAULT_COMBAT_HP}.`);
  }
  if (player.startingHp !== undefined && player.startingHp !== DEFAULT_COMBAT_HP) {
    throw new Error(`C01 player startingHp must use the C00 baseline of ${DEFAULT_COMBAT_HP}.`);
  }
  if (
    player.techniqueCharges !== undefined
    && player.techniqueCharges !== DEFAULT_TECHNIQUE_CHARGES
  ) {
    throw new Error(
      `C01 player techniqueCharges must use the C00 baseline of ${DEFAULT_TECHNIQUE_CHARGES}.`
    );
  }

  if (definition.turnLimit !== undefined && !positiveInteger(definition.turnLimit)) {
    throw new Error('CombatDefinition turnLimit must be a positive integer when present.');
  }

  if (definition.openingPhase === 'enemy' && definition.openingReason !== 'ambush') {
    throw new Error('Enemy opening phase requires an explicitly authored ambush reason.');
  }
  if ((definition.openingPhase ?? 'player') === 'player' && definition.openingReason !== undefined) {
    throw new Error('Combat openingReason is only valid for an enemy ambush opening.');
  }

  return definition;
}

function initialCombatant(definition: CombatantDefinition): CombatantState {
  return {
    id: definition.id,
    side: definition.side,
    maxHp: definition.maxHp,
    hp: definition.startingHp ?? definition.maxHp,
    techniqueCharges: definition.techniqueCharges
      ?? (definition.side === 'player' ? DEFAULT_TECHNIQUE_CHARGES : 0)
  };
}

export function createCombatState(definition: CombatDefinition): CombatState {
  validateCombatDefinition(definition);

  return {
    definitionId: definition.id,
    round: 1,
    phase: definition.openingPhase ?? 'player',
    combatants: definition.combatants.map(initialCombatant),
    statuses: [],
    techniqueReadyRound: Object.fromEntries(
      (definition.techniques ?? []).map((technique) => [technique.id, 1])
    ),
    objectiveProgress: 0
  };
}

/**
 * Pure C01 lifecycle reducer.
 *
 * Invalid phase changes are refused instead of silently repaired. Later Combat
 * mechanic packets may compute HP/objective/status changes, but provider output
 * never enters this reducer as mechanics authority.
 */
export function reduceCombatLifecycle(
  state: CombatState,
  event: CombatLifecycleEvent
): CombatState {
  if (event.type === 'RESOLVE') {
    if (state.phase === 'resolved') {
      if (state.outcome === event.outcome) return state;
      throw new Error(`Combat ${state.definitionId} is already resolved as ${state.outcome}.`);
    }
    return { ...state, phase: 'resolved', outcome: event.outcome };
  }

  if (state.phase === 'resolved') {
    throw new Error(`Combat ${state.definitionId} is already resolved.`);
  }

  if (event.type === 'END_PLAYER_PHASE') {
    if (state.phase !== 'player') {
      throw new Error(`END_PLAYER_PHASE requires player phase, got ${state.phase}.`);
    }
    return { ...state, phase: 'enemy' };
  }

  if (state.phase !== 'enemy') {
    throw new Error(`END_ENEMY_PHASE requires enemy phase, got ${state.phase}.`);
  }
  return { ...state, phase: 'player', round: state.round + 1 };
}


/**
 * Frozen C00 ATTACK formula before future deterministic status/gimmick
 * modifiers. Missing/declined timing input always remains a valid base action.
 */
export function attackDamage(timedSuccess = false): number {
  return BASE_ATTACK_DAMAGE + (timedSuccess ? TIMED_ATTACK_BONUS : 0);
}

/**
 * Apply one deterministic player ATTACK without advancing phase or resolving
 * objective/reward state. Later packets own objective checks, status/gimmick
 * modifiers and turn orchestration.
 */
export function applyAttack(
  state: CombatState,
  command: CombatAttackCommand
): CombatAttackResolution {
  if (state.phase !== 'player') {
    throw new Error(`ATTACK requires player phase, got ${state.phase}.`);
  }

  const actor = state.combatants.find((combatant) => combatant.id === command.actorId);
  if (!actor) throw new Error(`Unknown ATTACK actor: ${command.actorId}`);
  if (actor.side !== 'player') throw new Error(`ATTACK actor ${command.actorId} is not the player.`);
  if (actor.hp <= 0) throw new Error(`ATTACK actor ${command.actorId} is defeated.`);

  const target = state.combatants.find((combatant) => combatant.id === command.targetId);
  if (!target) throw new Error(`Unknown ATTACK target: ${command.targetId}`);
  if (target.side !== 'enemy') throw new Error(`ATTACK target ${command.targetId} is not an enemy.`);
  if (target.hp <= 0) throw new Error(`ATTACK target ${command.targetId} is already defeated.`);

  const timedSuccess = command.timedSuccess === true;
  const damage = attackDamage(timedSuccess);
  const nextHp = Math.max(0, target.hp - damage);

  return {
    state: {
      ...state,
      combatants: state.combatants.map((combatant) =>
        combatant.id === target.id ? { ...combatant, hp: nextHp } : combatant
      )
    },
    actorId: actor.id,
    targetId: target.id,
    damage,
    timedSuccess,
    targetDefeated: nextHp === 0
  };
}


/**
 * C00 GUARD formula.
 *
 * Incoming damage is deterministic integer damage authored by the encounter.
 * Timing is optional: absent/false uses ordinary 50% reduction. A successful
 * injected perfect-guard result uses 75%. Math.ceil prevents integer rounding
 * from making the reduction stronger than the frozen percentage.
 *
 * C03 does not mutate CombatState or freeze status resolution order; C09/C10 own
 * enemy-intent orchestration and status lifecycle.
 */
export function guardedIncomingDamage(rawDamage: number, timedSuccess = false): number {
  if (!Number.isInteger(rawDamage) || rawDamage < 0) {
    throw new Error('GUARD rawDamage must be a non-negative integer.');
  }
  const remainingFraction = timedSuccess ? 1 - PERFECT_GUARD_REDUCTION : 1 - GUARD_REDUCTION;
  return Math.ceil(rawDamage * remainingFraction);
}

export function resolveGuardDamage(
  state: CombatState,
  command: CombatGuardCommand,
  rawDamage: number
): CombatGuardResolution {
  if (state.phase === 'resolved') {
    throw new Error('GUARD cannot resolve after combat is resolved.');
  }

  const actor = state.combatants.find((combatant) => combatant.id === command.actorId);
  if (!actor) throw new Error('Unknown GUARD actor: ' + command.actorId);
  if (actor.side !== 'player') throw new Error('GUARD actor ' + command.actorId + ' is not the player.');
  if (actor.hp <= 0) throw new Error('GUARD actor ' + command.actorId + ' is defeated.');

  const timedSuccess = command.timedSuccess === true;
  const damageTaken = guardedIncomingDamage(rawDamage, timedSuccess);

  return {
    actorId: actor.id,
    rawDamage,
    damageTaken,
    damagePrevented: rawDamage - damageTaken,
    timedSuccess
  };
}


function techniqueFor(
  definition: CombatDefinition,
  techniqueId: string
): CombatTechniqueDefinition {
  const technique = (definition.techniques ?? []).find((item) => item.id === techniqueId);
  if (!technique) throw new Error(`Unknown TECHNIQUE id: ${techniqueId}`);
  return technique;
}

/**
 * C04 deterministic TECHNIQUE resource/availability resolution.
 *
 * This spends encounter-local charges and freezes the next usable round. It
 * intentionally does not apply the tactical job itself: interrupt/protect/
 * expose/objective/control effects belong to later status/gimmick/objective
 * packets and must remain deterministic.
 */
export function activateTechnique(
  definition: CombatDefinition,
  state: CombatState,
  command: CombatTechniqueCommand
): CombatTechniqueActivation {
  validateCombatDefinition(definition);

  if (state.definitionId !== definition.id) {
    throw new Error(
      `TECHNIQUE definition mismatch: state=${state.definitionId}, definition=${definition.id}`
    );
  }
  if (state.phase !== 'player') {
    throw new Error(`TECHNIQUE requires player phase, got ${state.phase}.`);
  }

  const actor = state.combatants.find((combatant) => combatant.id === command.actorId);
  if (!actor) throw new Error(`Unknown TECHNIQUE actor: ${command.actorId}`);
  if (actor.side !== 'player') {
    throw new Error(`TECHNIQUE actor ${command.actorId} is not the player.`);
  }
  if (actor.hp <= 0) throw new Error(`TECHNIQUE actor ${command.actorId} is defeated.`);

  const technique = techniqueFor(definition, command.techniqueId);
  const readyRound = state.techniqueReadyRound[technique.id] ?? 1;
  if (state.round < readyRound) {
    throw new Error(
      `TECHNIQUE ${technique.id} is unavailable until round ${readyRound}.`
    );
  }
  if (actor.techniqueCharges < technique.chargeCost) {
    throw new Error(
      `TECHNIQUE ${technique.id} needs ${technique.chargeCost} charges; ${actor.techniqueCharges} remain.`
    );
  }

  const nextUsableRound = state.round + technique.cooldownRounds + 1;
  const nextState: CombatState = {
    ...state,
    combatants: state.combatants.map((combatant) =>
      combatant.id === actor.id
        ? { ...combatant, techniqueCharges: combatant.techniqueCharges - technique.chargeCost }
        : combatant
    ),
    techniqueReadyRound: {
      ...state.techniqueReadyRound,
      [technique.id]: nextUsableRound
    }
  };

  return {
    state: nextState,
    actorId: actor.id,
    techniqueId: technique.id,
    job: technique.job,
    chargeCost: technique.chargeCost,
    nextUsableRound
  };
}
