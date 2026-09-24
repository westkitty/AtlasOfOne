import { z } from 'zod';

/**
 * D05 request-mode discriminator.
 *
 * Mode belongs to context compilation/request routing. It does not grant model
 * authority and is deliberately separate from the proposal kind returned by a
 * provider.
 */
export const ATLAS_PROVIDER_MODES = [
  'journal',
  'reflection',
  'adventure',
  'world-interaction',
  'combat',
  'boss-synthesis',
  'mystery-door',
  'snapshot',
  'pure-fun'
] as const;

export const atlasProviderModeSchema = z.enum(ATLAS_PROVIDER_MODES);
export type AtlasProviderMode = z.infer<typeof atlasProviderModeSchema>;

/**
 * Section 23's five proposal families.
 *
 * These are response-shape families, not request modes. For example, several
 * encounter-related request modes may eventually return an encounter-flavor
 * proposal without gaining combat authority.
 */
export const MODEL_PROPOSAL_KINDS = [
  'journal',
  'reflection',
  'adventure-scene',
  'encounter-flavor',
  'snapshot'
] as const;

export const modelProposalKindSchema = z.enum(MODEL_PROPOSAL_KINDS);
export type ModelProposalKind = z.infer<typeof modelProposalKindSchema>;

/**
 * P00 routing-only base schemas.
 *
 * passthrough is intentional: P01-P04 own the exact payload fields and semantic
 * validation. These base schemas exist only so every new provider response can
 * be routed by an explicit kind discriminator before a mode-specific validator
 * sees it.
 *
 * IMPORTANT: modelProposalRoutingSchema is NOT an acceptance/firewall schema.
 * A value that passes here is still untrusted proposal data. Never turn this
 * result into GameEvents, mechanics state, evidence, progression, persistence,
 * or provider context without the later mode-specific validator.
 */
export const journalProposalBaseSchema = z.object({
  kind: z.literal('journal')
}).passthrough();

export const reflectionProposalBaseSchema = z.object({
  kind: z.literal('reflection')
}).passthrough();

export const adventureSceneProposalBaseSchema = z.object({
  kind: z.literal('adventure-scene')
}).passthrough();

export const encounterFlavorProposalBaseSchema = z.object({
  kind: z.literal('encounter-flavor')
}).passthrough();

export const snapshotProposalBaseSchema = z.object({
  kind: z.literal('snapshot')
}).passthrough();

export const modelProposalRoutingSchema = z.discriminatedUnion('kind', [
  journalProposalBaseSchema,
  reflectionProposalBaseSchema,
  adventureSceneProposalBaseSchema,
  encounterFlavorProposalBaseSchema,
  snapshotProposalBaseSchema
]);

export type ModelProposalRoutingTarget = z.infer<typeof modelProposalRoutingSchema>;

/**
 * Resolve only the proposal family. Returning the discriminator instead of the
 * parsed object makes it harder to accidentally treat the P00 router as final
 * content validation.
 */
export function routeModelProposalKind(input: unknown): ModelProposalKind {
  return modelProposalRoutingSchema.parse(input).kind;
}
