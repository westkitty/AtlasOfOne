import { z } from 'zod';

/**
 * D05's complete provider-mode discriminator.
 *
 * Mode declares the job/context. It does not grant mutation authority.
 */
export const atlasProviderModeSchema = z.enum([
  'journal',
  'reflection',
  'adventure',
  'world-interaction',
  'combat',
  'boss-synthesis',
  'mystery-door',
  'snapshot',
  'pure-fun'
]);
export type AtlasProviderMode = z.infer<typeof atlasProviderModeSchema>;

export const modelProposalKindSchema = z.enum([
  'journal',
  'reflection',
  'adventure-scene',
  'encounter-flavor',
  'snapshot'
]);
export type ModelProposalKind = z.infer<typeof modelProposalKindSchema>;

/**
 * P00 freezes the strict mode/family envelope only.
 *
 * The objects are intentionally strict and carry no proposal payload yet.
 * P01-P04 own the actual content schemas. Until those packets extend a branch,
 * unexpected fields — including mechanics/progression authority — are rejected.
 */
export const journalProposalEnvelopeSchema = z.object({
  kind: z.literal('journal'),
  mode: z.literal('journal')
}).strict();

export const reflectionProposalEnvelopeSchema = z.object({
  kind: z.literal('reflection'),
  mode: z.literal('reflection')
}).strict();

export const adventureSceneProposalEnvelopeSchema = z.object({
  kind: z.literal('adventure-scene'),
  mode: z.enum(['adventure', 'world-interaction', 'pure-fun'])
}).strict();

export const encounterFlavorProposalEnvelopeSchema = z.object({
  kind: z.literal('encounter-flavor'),
  mode: z.enum(['combat', 'boss-synthesis', 'mystery-door'])
}).strict();

export const snapshotProposalEnvelopeSchema = z.object({
  kind: z.literal('snapshot'),
  mode: z.literal('snapshot')
}).strict();

export const modelProposalEnvelopeSchema = z.discriminatedUnion('kind', [
  journalProposalEnvelopeSchema,
  reflectionProposalEnvelopeSchema,
  adventureSceneProposalEnvelopeSchema,
  encounterFlavorProposalEnvelopeSchema,
  snapshotProposalEnvelopeSchema
]);

export type ModelProposalEnvelope = z.infer<typeof modelProposalEnvelopeSchema>;

const FORBIDDEN_AUTHORITY_KEYS = new Set([
  'xp',
  'level',
  'unlock',
  'unlocks',
  'achievement',
  'achievements',
  'reward',
  'rewards',
  'hp',
  'currentHp',
  'maxHp',
  'damage',
  'outcome',
  'objective',
  'objectiveProgress',
  'status',
  'statuses',
  'statusEffects',
  'intent',
  'turnOrder',
  'techniqueCharges',
  'gameEvent',
  'events',
  'schemaVersion',
  'eligible',
  'snapshotEligible'
]);

/**
 * Defense-in-depth semantic guard for future proposal schemas.
 *
 * Strict P00 envelopes already reject every extra field. P01-P04 may add content
 * fields, so their semantic tests can reuse this recursive authority scan to
 * ensure a newly allowed payload cannot smuggle deterministic mechanics names.
 *
 * This is not a prose classifier. It checks exact object keys only.
 */
export function proposalContainsForbiddenAuthority(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(proposalContainsForbiddenAuthority);
  if (!value || typeof value !== 'object') return false;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_AUTHORITY_KEYS.has(key)) return true;
    if (proposalContainsForbiddenAuthority(child)) return true;
  }
  return false;
}
