/**
 * P12 provider call-count / cost guard.
 *
 * Pure policy. Only narrative proposal operations may ever call a provider,
 * and each has a named local fallback (P08/P09/P10/local Snapshot synthesis)
 * so exhausting the quota degrades wording, never state. Every mechanics
 * operation is provider-free by construction: `providerCallAllowed` returns
 * false for it regardless of quota.
 */

export const NARRATIVE_PROVIDER_OPERATIONS = [
  'journal-acknowledgement',
  'reflection-wording',
  'adventure-scene',
  'snapshot-synthesis'
] as const;
export type NarrativeProviderOperation = (typeof NARRATIVE_PROVIDER_OPERATIONS)[number];

export const MECHANICS_OPERATIONS = [
  'journal-save',
  'journal-privacy',
  'explore-journal-entry',
  'seed-admission',
  'adventure-start',
  'adventure-choice',
  'adventure-withdraw',
  'combat-round',
  'reflection-offer',
  'reflection-decision',
  'evidence-conversion',
  'retirement',
  'persistence'
] as const;
export type MechanicsOperation = (typeof MECHANICS_OPERATIONS)[number];

export type AtlasOperation = NarrativeProviderOperation | MechanicsOperation;

/** Local fallback that replaces each narrative operation when no call is allowed. */
export const NARRATIVE_FALLBACK: Readonly<Record<NarrativeProviderOperation, string>> = {
  'journal-acknowledgement': 'localJournalAcknowledgement',
  'reflection-wording': 'localReflectionWording',
  'adventure-scene': 'localAdventureContinuation',
  'snapshot-synthesis': 'generateLocalAssessment'
};

export interface ProviderQuota {
  /** Calls already made in the current window. */
  used: number;
  /** Maximum calls permitted in the window. 0 means provider disabled. */
  limit: number;
}

export function isNarrativeProviderOperation(operation: string): operation is NarrativeProviderOperation {
  return (NARRATIVE_PROVIDER_OPERATIONS as readonly string[]).includes(operation);
}

/**
 * True only for a narrative operation with remaining, well-formed quota.
 * Malformed quota (negative, non-integer, NaN) fails closed.
 */
export function providerCallAllowed(operation: AtlasOperation | string, quota: ProviderQuota): boolean {
  if (!isNarrativeProviderOperation(operation)) return false;
  const { used, limit } = quota;
  if (!Number.isInteger(used) || !Number.isInteger(limit) || used < 0 || limit < 0) return false;
  return used < limit;
}

/** Record one call; never exceeds the limit. */
export function consumeProviderQuota(quota: ProviderQuota): ProviderQuota {
  return { ...quota, used: Math.min(quota.limit, quota.used + 1) };
}
