import type { CombatDefinition, CombatGimmick, CombatState } from '../contracts/combat';
import { validateCombatStateAgainstDefinition } from './engine';
import {
  COMBAT_STATUS_KINDS,
  COMBAT_TUNING,
  validateCombatDefinitionContract,
  type CombatStatusKind
} from './rules';

export type TechniqueTargetTeam = 'enemy' | 'ally';
export type TechniqueEffectKind = 'interrupt-charge' | 'protect-ally' | 'expose-target';

export interface TechniqueContextRule {
  targetTeam: TechniqueTargetTeam;
  requiredGimmicks?: readonly CombatGimmick[];
  requiredTargetStatuses?: readonly CombatStatusKind[];
  forbiddenTargetStatuses?: readonly CombatStatusKind[];
}

export interface TechniqueDefinition {
  id: string;
  label: string;
  cost: number;
  cooldownRounds: number;
  context: TechniqueContextRule;
  effect: TechniqueEffectKind;
}

export interface TechniqueCooldown {
  techniqueId: string;
  nextReadyRound: number;
}

export interface TechniqueLedger {
  chargesRemaining: number;
  cooldowns: readonly TechniqueCooldown[];
}

export interface TechniqueEffectDescriptor {
  kind: TechniqueEffectKind;
  targetId: string;
}

export const MVP_TECHNIQUES = [
  {
    id: 'interrupt-charge',
    label: 'Interrupt',
    cost: 1,
    cooldownRounds: 1,
    context: { targetTeam: 'enemy', requiredGimmicks: ['charging'] },
    effect: 'interrupt-charge'
  },
  {
    id: 'cover-ally',
    label: 'Cover',
    cost: 1,
    cooldownRounds: 1,
    context: { targetTeam: 'ally' },
    effect: 'protect-ally'
  },
  {
    id: 'expose-shield',
    label: 'Expose',
    cost: 1,
    cooldownRounds: 1,
    context: { targetTeam: 'enemy', requiredGimmicks: ['shielded'] },
    effect: 'expose-target'
  }
] as const satisfies readonly TechniqueDefinition[];

export type TechniqueRegistryIssueCode =
  | 'blank-id'
  | 'blank-label'
  | 'duplicate-id'
  | 'invalid-cost'
  | 'invalid-cooldown'
  | 'invalid-target-team'
  | 'invalid-effect'
  | 'duplicate-gimmick'
  | 'duplicate-required-status'
  | 'duplicate-forbidden-status'
  | 'invalid-status'
  | 'contradictory-status-rule';

export interface TechniqueRegistryIssue {
  code: TechniqueRegistryIssueCode;
  path: string;
  detail: string;
}

export interface TechniqueRegistryValidation {
  ok: boolean;
  issues: TechniqueRegistryIssue[];
}

export type TechniqueLedgerIssueCode =
  | 'invalid-charges'
  | 'duplicate-cooldown'
  | 'unknown-cooldown-technique'
  | 'invalid-ready-round';

export interface TechniqueLedgerIssue {
  code: TechniqueLedgerIssueCode;
  path: string;
  detail: string;
}

export interface TechniqueLedgerValidation {
  ok: boolean;
  issues: TechniqueLedgerIssue[];
}

export type TechniqueUseIssueCode =
  | 'invalid-definition'
  | 'invalid-state'
  | 'invalid-registry'
  | 'invalid-ledger'
  | 'invalid-phase'
  | 'player-defeated'
  | 'unknown-technique'
  | 'insufficient-charges'
  | 'cooldown-active'
  | 'unknown-target'
  | 'wrong-target-team'
  | 'target-defeated'
  | 'missing-required-gimmick'
  | 'missing-required-status'
  | 'forbidden-target-status';

export interface TechniqueAvailability {
  available: boolean;
  techniqueId: string;
  targetId: string;
  issue?: TechniqueUseIssueCode;
  nextReadyRound?: number;
}

export interface TechniqueUseResult extends TechniqueAvailability {
  state: CombatState;
  ledger: TechniqueLedger;
  effect?: TechniqueEffectDescriptor;
}

const STATUS_SET = new Set<string>(COMBAT_STATUS_KINDS);
const TARGET_TEAM_SET = new Set<string>(['enemy', 'ally']);
const EFFECT_SET = new Set<string>(['interrupt-charge', 'protect-ally', 'expose-target']);
const duplicates = (values: readonly string[]) => values.filter((value, index) => values.indexOf(value) !== index);
const isNonNegativeInteger = (value: number) => Number.isFinite(value) && Number.isInteger(value) && value >= 0;
const blank = (value: string) => value.trim().length === 0;

export function validateTechniqueRegistry(registry: readonly TechniqueDefinition[]): TechniqueRegistryValidation {
  const issues: TechniqueRegistryIssue[] = [];
  const push = (code: TechniqueRegistryIssueCode, path: string, detail: string) => issues.push({ code, path, detail });

  for (const [index, technique] of registry.entries()) {
    if (blank(technique.id)) push('blank-id', `[${index}].id`, 'Technique id must be nonblank.');
    if (blank(technique.label)) push('blank-label', `[${index}].label`, 'Technique label must be nonblank.');
    if (!Number.isInteger(technique.cost) || technique.cost <= 0 || technique.cost > COMBAT_TUNING.techniqueChargesAtStart) {
      push('invalid-cost', `[${index}].cost`, `Technique cost must be an integer from 1 to ${COMBAT_TUNING.techniqueChargesAtStart}.`);
    }
    if (!Number.isInteger(technique.cooldownRounds) || technique.cooldownRounds < 0) {
      push('invalid-cooldown', `[${index}].cooldownRounds`, 'Technique cooldown must be a non-negative integer.');
    }
    if (!TARGET_TEAM_SET.has(technique.context.targetTeam as string)) {
      push('invalid-target-team', `[${index}].context.targetTeam`, `Unknown Technique target team: ${String(technique.context.targetTeam)}.`);
    }
    if (!EFFECT_SET.has(technique.effect as string)) {
      push('invalid-effect', `[${index}].effect`, `Unknown Technique effect descriptor: ${String(technique.effect)}.`);
    }

    const requiredGimmicks = technique.context.requiredGimmicks ?? [];
    const requiredStatuses = technique.context.requiredTargetStatuses ?? [];
    const forbiddenStatuses = technique.context.forbiddenTargetStatuses ?? [];

    if (duplicates(requiredGimmicks).length > 0) push('duplicate-gimmick', `[${index}].context.requiredGimmicks`, 'Required gimmicks must be unique.');
    if (duplicates(requiredStatuses).length > 0) push('duplicate-required-status', `[${index}].context.requiredTargetStatuses`, 'Required statuses must be unique.');
    if (duplicates(forbiddenStatuses).length > 0) push('duplicate-forbidden-status', `[${index}].context.forbiddenTargetStatuses`, 'Forbidden statuses must be unique.');

    for (const status of [...requiredStatuses, ...forbiddenStatuses]) {
      if (!STATUS_SET.has(status as string)) push('invalid-status', `[${index}].context`, `Unknown C00 status: ${String(status)}.`);
    }
    for (const status of requiredStatuses) {
      if (forbiddenStatuses.includes(status)) push('contradictory-status-rule', `[${index}].context`, `Status ${status} cannot be both required and forbidden.`);
    }
  }

  for (const duplicate of new Set(duplicates(registry.map((technique) => technique.id)))) {
    push('duplicate-id', 'registry', `Duplicate technique id: ${duplicate}`);
  }

  return { ok: issues.length === 0, issues };
}

export function createTechniqueLedger(): TechniqueLedger {
  return { chargesRemaining: COMBAT_TUNING.techniqueChargesAtStart, cooldowns: [] };
}

export function validateTechniqueLedger(
  ledger: TechniqueLedger,
  registry: readonly TechniqueDefinition[] = MVP_TECHNIQUES
): TechniqueLedgerValidation {
  const issues: TechniqueLedgerIssue[] = [];
  const push = (code: TechniqueLedgerIssueCode, path: string, detail: string) => issues.push({ code, path, detail });
  const registryIds = new Set(registry.map((technique) => technique.id));

  if (!isNonNegativeInteger(ledger.chargesRemaining) || ledger.chargesRemaining > COMBAT_TUNING.techniqueChargesAtStart) {
    push('invalid-charges', 'chargesRemaining', `Technique charges must be an integer from 0 to ${COMBAT_TUNING.techniqueChargesAtStart}.`);
  }

  const cooldownIds = ledger.cooldowns.map((entry) => entry.techniqueId);
  for (const duplicate of new Set(duplicates(cooldownIds))) {
    push('duplicate-cooldown', 'cooldowns', `Duplicate cooldown entry: ${duplicate}`);
  }
  for (const [index, entry] of ledger.cooldowns.entries()) {
    if (!registryIds.has(entry.techniqueId)) push('unknown-cooldown-technique', `cooldowns[${index}].techniqueId`, `Unknown technique: ${entry.techniqueId}.`);
    if (!Number.isInteger(entry.nextReadyRound) || entry.nextReadyRound < 1) {
      push('invalid-ready-round', `cooldowns[${index}].nextReadyRound`, 'nextReadyRound must be an integer >= 1.');
    }
  }

  return { ok: issues.length === 0, issues };
}

function rejectAvailability(techniqueId: string, targetId: string, issue: TechniqueUseIssueCode, nextReadyRound?: number): TechniqueAvailability {
  return { available: false, techniqueId, targetId, issue, ...(nextReadyRound === undefined ? {} : { nextReadyRound }) };
}

export function checkTechniqueAvailability(
  definition: CombatDefinition,
  state: CombatState,
  ledger: TechniqueLedger,
  techniqueId: string,
  targetId: string,
  registry: readonly TechniqueDefinition[] = MVP_TECHNIQUES
): TechniqueAvailability {
  if (!validateCombatDefinitionContract(definition).ok) return rejectAvailability(techniqueId, targetId, 'invalid-definition');
  if (!validateCombatStateAgainstDefinition(definition, state).ok) return rejectAvailability(techniqueId, targetId, 'invalid-state');
  if (!validateTechniqueRegistry(registry).ok) return rejectAvailability(techniqueId, targetId, 'invalid-registry');
  if (!validateTechniqueLedger(ledger, registry).ok) return rejectAvailability(techniqueId, targetId, 'invalid-ledger');
  if (state.phase !== 'player') return rejectAvailability(techniqueId, targetId, 'invalid-phase');

  const playerId = definition.combatants.find((combatant) => combatant.team === 'player')?.id;
  const player = state.combatants.find((combatant) => combatant.id === playerId);
  if (!player || player.currentHp <= 0) return rejectAvailability(techniqueId, targetId, 'player-defeated');

  const technique = registry.find((candidate) => candidate.id === techniqueId);
  if (!technique) return rejectAvailability(techniqueId, targetId, 'unknown-technique');
  if (ledger.chargesRemaining < technique.cost) return rejectAvailability(techniqueId, targetId, 'insufficient-charges');

  const cooldown = ledger.cooldowns.find((entry) => entry.techniqueId === techniqueId);
  if (cooldown && state.round < cooldown.nextReadyRound) {
    return rejectAvailability(techniqueId, targetId, 'cooldown-active', cooldown.nextReadyRound);
  }

  const targetDefinition = definition.combatants.find((combatant) => combatant.id === targetId);
  const targetState = state.combatants.find((combatant) => combatant.id === targetId);
  if (!targetDefinition || !targetState) return rejectAvailability(techniqueId, targetId, 'unknown-target');
  if (targetDefinition.team !== technique.context.targetTeam) return rejectAvailability(techniqueId, targetId, 'wrong-target-team');
  if (targetState.currentHp <= 0) return rejectAvailability(techniqueId, targetId, 'target-defeated');

  for (const gimmick of technique.context.requiredGimmicks ?? []) {
    if (!definition.gimmicks.includes(gimmick)) return rejectAvailability(techniqueId, targetId, 'missing-required-gimmick');
  }
  for (const status of technique.context.requiredTargetStatuses ?? []) {
    if (!targetState.statuses.includes(status)) return rejectAvailability(techniqueId, targetId, 'missing-required-status');
  }
  for (const status of technique.context.forbiddenTargetStatuses ?? []) {
    if (targetState.statuses.includes(status)) return rejectAvailability(techniqueId, targetId, 'forbidden-target-status');
  }

  return { available: true, techniqueId, targetId };
}

function withCooldown(ledger: TechniqueLedger, techniqueId: string, nextReadyRound: number): readonly TechniqueCooldown[] {
  return [
    ...ledger.cooldowns.filter((entry) => entry.techniqueId !== techniqueId),
    { techniqueId, nextReadyRound }
  ].sort((a, b) => a.techniqueId.localeCompare(b.techniqueId));
}

/**
 * Consume one Technique resource use and emit a bounded mechanics descriptor.
 * CombatState is intentionally returned unchanged; later C07/C10 lanes own
 * objective/status effects and C13 owns turn orchestration.
 */
export function useTechnique(
  definition: CombatDefinition,
  state: CombatState,
  ledger: TechniqueLedger,
  techniqueId: string,
  targetId: string,
  registry: readonly TechniqueDefinition[] = MVP_TECHNIQUES
): TechniqueUseResult {
  const availability = checkTechniqueAvailability(definition, state, ledger, techniqueId, targetId, registry);
  if (!availability.available) return { ...availability, state, ledger };

  const technique = registry.find((candidate) => candidate.id === techniqueId)!;
  const nextReadyRound = state.round + technique.cooldownRounds + 1;
  const nextLedger: TechniqueLedger = {
    chargesRemaining: ledger.chargesRemaining - technique.cost,
    cooldowns: withCooldown(ledger, techniqueId, nextReadyRound)
  };

  return {
    available: true,
    techniqueId,
    targetId,
    state,
    ledger: nextLedger,
    effect: { kind: technique.effect, targetId },
    nextReadyRound
  };
}
