import { proposalContainsForbiddenAuthority } from '../cartographer/proposals';
import type { CombatState } from './types';

/**
 * C12 Combat authority firewall.
 *
 * Model/provider output may only ever supply narration-shaped strings
 * (COMBAT_CONTRACT §15). It never enters a Combat reducer. This module is the
 * single typed boundary: it accepts a strict narration envelope and otherwise
 * rejects, and `applyCombatNarration` returns the input CombatState by
 * reference in every case, so a proposal cannot mutate engine truth.
 */

export const COMBAT_NARRATION_FIELDS = [
  'narration',
  'enemyName',
  'actWording',
  'telegraphWording',
  'consequenceProse'
] as const;
export type CombatNarrationField = typeof COMBAT_NARRATION_FIELDS[number];

export const MAX_COMBAT_NARRATION_LENGTH = 600;

export interface CombatNarrationProposal {
  kind: 'combat-narration';
  narration?: string;
  enemyName?: string;
  actWording?: string;
  telegraphWording?: string;
  consequenceProse?: string;
}

/** Combat-specific engine keys, checked in addition to the shared cartographer list. */
const COMBAT_FORBIDDEN_KEYS = new Set([
  'phase',
  'round',
  'turn',
  'combatants',
  'definitionId',
  'telegraphedIntents',
  'techniqueReadyRound',
  'actProgressById',
  'completedActIds',
  'progress',
  'completed',
  'success',
  'victory',
  'defeat',
  'pacified',
  'escaped',
  'rawDamage',
  'damageTaken',
  'heal',
  'healing',
  'charges',
  'remainingRounds',
  'loot'
]);

function containsCombatAuthority(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsCombatAuthority);
  if (!value || typeof value !== 'object') return false;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (COMBAT_FORBIDDEN_KEYS.has(key)) return true;
    if (containsCombatAuthority(child)) return true;
  }
  return false;
}

export type CombatProposalVerdict =
  | { accepted: true; proposal: CombatNarrationProposal }
  | { accepted: false; reasons: string[] };

export function validateCombatProposal(value: unknown): CombatProposalVerdict {
  const reasons: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { accepted: false, reasons: ['proposal must be a plain object'] };
  }
  if (Object.getPrototypeOf(value) !== Object.prototype) {
    return { accepted: false, reasons: ['proposal must be a plain object'] };
  }
  if (proposalContainsForbiddenAuthority(value)) reasons.push('forbidden mechanics authority key');
  if (containsCombatAuthority(value)) reasons.push('forbidden combat engine key');

  const record = value as Record<string, unknown>;
  if (record.kind !== 'combat-narration') reasons.push('kind must be combat-narration');

  const allowed = new Set<string>(['kind', ...COMBAT_NARRATION_FIELDS]);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) reasons.push(`unexpected field: ${key}`);
  }
  for (const field of COMBAT_NARRATION_FIELDS) {
    const text = record[field];
    if (text === undefined) continue;
    if (typeof text !== 'string') reasons.push(`${field} must be a string`);
    else if (text.length > MAX_COMBAT_NARRATION_LENGTH) reasons.push(`${field} too long`);
  }

  if (reasons.length > 0) return { accepted: false, reasons: [...new Set(reasons)] };

  const proposal: CombatNarrationProposal = { kind: 'combat-narration' };
  for (const field of COMBAT_NARRATION_FIELDS) {
    if (typeof record[field] === 'string') proposal[field] = record[field] as string;
  }
  return { accepted: true, proposal };
}

export interface CombatNarrationApplication {
  /** Always the exact input state reference: narration never mutates mechanics. */
  state: CombatState;
  verdict: CombatProposalVerdict;
}

export function applyCombatNarration(state: CombatState, value: unknown): CombatNarrationApplication {
  return { state, verdict: validateCombatProposal(value) };
}
