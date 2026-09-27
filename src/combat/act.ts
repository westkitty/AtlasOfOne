import type { CombatDefinition, CombatGimmick, CombatState } from '../contracts/combat';
import { reduceCombatState, validateCombatStateAgainstDefinition, type CombatReducerIssueCode } from './engine';
import {
  COMBAT_OBJECTIVE_RULES,
  COMBAT_STATUS_KINDS,
  validateCombatDefinitionContract,
  type CombatStatusKind
} from './rules';

export type ActTargetTeam = 'enemy' | 'ally' | 'none';
export type ActEffectKind = 'act-progress' | 'reveal';

/**
 * One scenario-owned ACT option. The scenario (a deterministic template) owns
 * every mechanics field. A provider may later re-word `label` for display, but
 * it can never add an option, change a predicate or declare an effect.
 */
export interface ActOptionDefinition {
  id: string;
  label: string;
  targetTeam: ActTargetTeam;
  effect: ActEffectKind;
  repeatable: boolean;
  requiredGimmicks?: readonly CombatGimmick[];
  requiredTargetStatuses?: readonly CombatStatusKind[];
  forbiddenTargetStatuses?: readonly CombatStatusKind[];
  /** Other option ids that must already have been used (discovery chains). */
  requiresUsed?: readonly string[];
  /** Stable authored hook a later Adventure lane may turn into an AdventureObservation. */
  observationKey?: string;
}

export interface ActScenario {
  options: readonly ActOptionDefinition[];
}

export interface ActLedger {
  usedOptionIds: readonly string[];
}

/** Inert, fictional descriptor. It is never evidence and never a real-person claim. */
export interface ActObservationDescriptor {
  kind: 'act';
  optionId: string;
  effect: ActEffectKind;
  targetId?: string;
  observationKey?: string;
}

export type ActScenarioIssueCode =
  | 'blank-id'
  | 'blank-label'
  | 'duplicate-id'
  | 'invalid-target-team'
  | 'invalid-effect'
  | 'invalid-repeatable'
  | 'duplicate-gimmick'
  | 'duplicate-required-status'
  | 'duplicate-forbidden-status'
  | 'invalid-status'
  | 'contradictory-status-rule'
  | 'status-rule-without-target'
  | 'unknown-prerequisite'
  | 'self-prerequisite'
  | 'prerequisite-cycle'
  | 'progress-effect-without-progress-objective'
  | 'unreachable-progress-target';

export interface ActScenarioIssue {
  code: ActScenarioIssueCode;
  path: string;
  detail: string;
}

export interface ActScenarioValidation {
  ok: boolean;
  issues: ActScenarioIssue[];
}

export type ActIssueCode =
  | 'invalid-definition'
  | 'invalid-state'
  | 'invalid-scenario'
  | 'invalid-ledger'
  | 'invalid-phase'
  | 'player-defeated'
  | 'unknown-act'
  | 'already-used'
  | 'missing-prerequisite'
  | 'target-required'
  | 'unexpected-target'
  | 'unknown-target'
  | 'wrong-target-team'
  | 'target-defeated'
  | 'missing-required-gimmick'
  | 'missing-required-status'
  | 'forbidden-target-status'
  | 'progress-complete'
  | 'reducer-rejected';

export interface ActResolution {
  state: CombatState;
  ledger: ActLedger;
  accepted: boolean;
  optionId: string;
  targetId?: string;
  observation?: ActObservationDescriptor;
  issue?: ActIssueCode;
  reducerIssue?: CombatReducerIssueCode;
}

const STATUS_SET = new Set<string>(COMBAT_STATUS_KINDS);
const TARGET_TEAM_SET = new Set<string>(['enemy', 'ally', 'none']);
const EFFECT_SET = new Set<string>(['act-progress', 'reveal']);
const duplicates = (values: readonly string[]) => values.filter((value, index) => values.indexOf(value) !== index);
const blank = (value: unknown) => typeof value !== 'string' || value.trim().length === 0;

function hasPrerequisiteCycle(options: readonly ActOptionDefinition[]): boolean {
  const edges = new Map(options.map((option) => [option.id, option.requiresUsed ?? []] as const));
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string): boolean => {
    const mark = state.get(id);
    if (mark === 'visiting') return true;
    if (mark === 'done') return false;
    state.set(id, 'visiting');
    for (const next of edges.get(id) ?? []) {
      if (edges.has(next) && visit(next)) return true;
    }
    state.set(id, 'done');
    return false;
  };
  return options.some((option) => visit(option.id));
}

/**
 * C05 read-only scenario validator. A scenario must be well formed before any
 * ACT can resolve, and an act-progress route must be completable: a pacify
 * encounter whose options cannot reach the progress target would trap the
 * player in a nonviolent route that never ends.
 */
export function validateActScenario(definition: CombatDefinition, scenario: ActScenario): ActScenarioValidation {
  const issues: ActScenarioIssue[] = [];
  const push = (code: ActScenarioIssueCode, path: string, detail: string) => issues.push({ code, path, detail });
  const ids = scenario.options.map((option) => option.id);
  const idSet = new Set(ids);
  const progressTarget = COMBAT_OBJECTIVE_RULES[definition.objective]?.resolution === 'act-progress'
    ? COMBAT_OBJECTIVE_RULES[definition.objective].progressTarget
    : undefined;

  for (const [index, option] of scenario.options.entries()) {
    const path = `options[${index}]`;
    if (blank(option.id)) push('blank-id', `${path}.id`, 'ACT option id must be nonblank.');
    if (blank(option.label)) push('blank-label', `${path}.label`, 'ACT option label must be nonblank.');
    if (!TARGET_TEAM_SET.has(option.targetTeam as string)) push('invalid-target-team', `${path}.targetTeam`, `Unknown ACT target team: ${String(option.targetTeam)}.`);
    if (!EFFECT_SET.has(option.effect as string)) push('invalid-effect', `${path}.effect`, `Unknown ACT effect: ${String(option.effect)}.`);
    if (typeof option.repeatable !== 'boolean') push('invalid-repeatable', `${path}.repeatable`, 'repeatable must be an explicit boolean.');

    const gimmicks = option.requiredGimmicks ?? [];
    const required = option.requiredTargetStatuses ?? [];
    const forbidden = option.forbiddenTargetStatuses ?? [];
    if (duplicates(gimmicks).length > 0) push('duplicate-gimmick', `${path}.requiredGimmicks`, 'Required gimmicks must be unique.');
    if (duplicates(required).length > 0) push('duplicate-required-status', `${path}.requiredTargetStatuses`, 'Required statuses must be unique.');
    if (duplicates(forbidden).length > 0) push('duplicate-forbidden-status', `${path}.forbiddenTargetStatuses`, 'Forbidden statuses must be unique.');
    for (const status of [...required, ...forbidden]) {
      if (!STATUS_SET.has(status as string)) push('invalid-status', path, `Unknown C00 status: ${String(status)}.`);
    }
    for (const status of required) {
      if (forbidden.includes(status)) push('contradictory-status-rule', path, `Status ${status} cannot be both required and forbidden.`);
    }
    if (option.targetTeam === 'none' && (required.length > 0 || forbidden.length > 0)) {
      push('status-rule-without-target', path, 'An untargeted ACT cannot carry target status predicates.');
    }

    for (const prerequisite of option.requiresUsed ?? []) {
      if (prerequisite === option.id) push('self-prerequisite', `${path}.requiresUsed`, 'An ACT option cannot require itself.');
      else if (!idSet.has(prerequisite)) push('unknown-prerequisite', `${path}.requiresUsed`, `Unknown prerequisite ACT: ${prerequisite}.`);
    }

    if (option.effect === 'act-progress' && progressTarget === undefined) {
      push('progress-effect-without-progress-objective', `${path}.effect`, `Objective ${definition.objective} does not track ACT progress.`);
    }
  }

  for (const duplicate of new Set(duplicates(ids))) push('duplicate-id', 'options', `Duplicate ACT option id: ${duplicate}`);
  if (hasPrerequisiteCycle(scenario.options)) push('prerequisite-cycle', 'options', 'ACT prerequisites form a cycle, so some options are unreachable.');

  if (progressTarget !== undefined) {
    const progressOptions = scenario.options.filter((option) => option.effect === 'act-progress');
    const reachable = progressOptions.some((option) => option.repeatable === true) || progressOptions.length >= progressTarget;
    if (!reachable) {
      push('unreachable-progress-target', 'options', `ACT options can supply at most ${progressOptions.length} of ${progressTarget} required progress steps.`);
    }
  }

  return { ok: issues.length === 0, issues };
}

export function createActLedger(): ActLedger {
  return { usedOptionIds: [] };
}

function validLedger(ledger: ActLedger, scenario: ActScenario): boolean {
  if (!Array.isArray(ledger.usedOptionIds)) return false;
  const ids = new Set(scenario.options.map((option) => option.id));
  return duplicates(ledger.usedOptionIds).length === 0 && ledger.usedOptionIds.every((id) => ids.has(id));
}

function reject(state: CombatState, ledger: ActLedger, optionId: string, targetId: string | undefined, issue: ActIssueCode): ActResolution {
  return { state, ledger, accepted: false, optionId, ...(targetId === undefined ? {} : { targetId }), issue };
}

/**
 * C05 ACT resolver.
 *
 * ACT resolves only options the scenario already owns. `act-progress` advances
 * objective progress by exactly one deterministic step through the C01
 * reducer; `reveal` changes no CombatState at all. ACT does not end the phase,
 * resolve the objective (C07 decides pacification), grant rewards or create
 * evidence. The returned observation descriptor is fictional and inert.
 */
export function resolveAct(
  definition: CombatDefinition,
  state: CombatState,
  ledger: ActLedger,
  scenario: ActScenario,
  optionId: string,
  targetId?: string
): ActResolution {
  if (!validateCombatDefinitionContract(definition).ok) return reject(state, ledger, optionId, targetId, 'invalid-definition');
  if (!validateCombatStateAgainstDefinition(definition, state).ok) return reject(state, ledger, optionId, targetId, 'invalid-state');
  if (!validateActScenario(definition, scenario).ok) return reject(state, ledger, optionId, targetId, 'invalid-scenario');
  if (!validLedger(ledger, scenario)) return reject(state, ledger, optionId, targetId, 'invalid-ledger');
  if (state.phase !== 'player') return reject(state, ledger, optionId, targetId, 'invalid-phase');

  const playerId = definition.combatants.find((combatant) => combatant.team === 'player')?.id;
  const player = state.combatants.find((combatant) => combatant.id === playerId);
  if (!player || player.currentHp <= 0) return reject(state, ledger, optionId, targetId, 'player-defeated');

  const option = scenario.options.find((candidate) => candidate.id === optionId);
  if (!option) return reject(state, ledger, optionId, targetId, 'unknown-act');
  if (!option.repeatable && ledger.usedOptionIds.includes(option.id)) return reject(state, ledger, optionId, targetId, 'already-used');
  if ((option.requiresUsed ?? []).some((id) => !ledger.usedOptionIds.includes(id))) {
    return reject(state, ledger, optionId, targetId, 'missing-prerequisite');
  }

  if (option.targetTeam === 'none') {
    if (targetId !== undefined) return reject(state, ledger, optionId, targetId, 'unexpected-target');
  } else {
    if (targetId === undefined) return reject(state, ledger, optionId, targetId, 'target-required');
    const targetDefinition = definition.combatants.find((combatant) => combatant.id === targetId);
    const targetState = state.combatants.find((combatant) => combatant.id === targetId);
    if (!targetDefinition || !targetState) return reject(state, ledger, optionId, targetId, 'unknown-target');
    if (targetDefinition.team !== option.targetTeam) return reject(state, ledger, optionId, targetId, 'wrong-target-team');
    if (targetState.currentHp <= 0) return reject(state, ledger, optionId, targetId, 'target-defeated');
    for (const status of option.requiredTargetStatuses ?? []) {
      if (!targetState.statuses.includes(status)) return reject(state, ledger, optionId, targetId, 'missing-required-status');
    }
    for (const status of option.forbiddenTargetStatuses ?? []) {
      if (targetState.statuses.includes(status)) return reject(state, ledger, optionId, targetId, 'forbidden-target-status');
    }
  }
  for (const gimmick of option.requiredGimmicks ?? []) {
    if (!definition.gimmicks.includes(gimmick)) return reject(state, ledger, optionId, targetId, 'missing-required-gimmick');
  }

  let nextState = state;
  if (option.effect === 'act-progress') {
    const target = COMBAT_OBJECTIVE_RULES[definition.objective].progressTarget!;
    if (state.objectiveProgress >= target) return reject(state, ledger, optionId, targetId, 'progress-complete');
    const reduced = reduceCombatState(definition, state, { type: 'OBJECTIVE_PROGRESS_SET', progress: state.objectiveProgress + 1 });
    if (!reduced.accepted) return { ...reject(state, ledger, optionId, targetId, 'reducer-rejected'), reducerIssue: reduced.issue };
    nextState = reduced.state;
  }

  const nextLedger: ActLedger = ledger.usedOptionIds.includes(option.id)
    ? ledger
    : { usedOptionIds: [...ledger.usedOptionIds, option.id].sort() };

  return {
    state: nextState,
    ledger: nextLedger,
    accepted: true,
    optionId,
    ...(targetId === undefined ? {} : { targetId }),
    observation: {
      kind: 'act',
      optionId,
      effect: option.effect,
      ...(targetId === undefined ? {} : { targetId }),
      ...(option.observationKey === undefined ? {} : { observationKey: option.observationKey })
    }
  };
}
