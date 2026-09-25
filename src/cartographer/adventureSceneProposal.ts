import { z } from 'zod';
import {
  adventureSceneProposalEnvelopeSchema,
  proposalContainsForbiddenAuthority
} from './proposals';
import { ProposalProvenanceError } from './proposalErrors';

export const adventureDialogueLineSchema = z.object({
  /** Must be an NPC ID supplied by the caller's bounded context. */
  speakerNpcId: z.string().min(1),
  line: z.string().min(1)
}).strict();

export const adventureChoiceSchema = z.object({
  label: z.string().min(1)
}).strict();

/**
 * P03 Adventure scene proposal.
 *
 * Prose, dialogue, a candidate continuation, and offered choice labels only.
 * The provider never decides HP, damage, outcomes, rewards, XP, objective
 * progress, or world flags; deterministic engine code owns all of that. Any
 * entity/NPC/memory reference is validated against caller-supplied IDs by
 * `parseAdventureSceneProposalForContext`.
 */
export const adventureSceneProposalSchema = adventureSceneProposalEnvelopeSchema.extend({
  sceneProse: z.string().min(1),
  dialogue: z.array(adventureDialogueLineSchema).max(8).default([]),
  continuationCandidate: z.string().min(1).optional(),
  choices: z.array(adventureChoiceSchema).max(6).default([]),
  referencedEntityIds: z.array(z.string().min(1)).default([]),
  referencedNpcIds: z.array(z.string().min(1)).default([]),
  referencedMemoryIds: z.array(z.string().min(1)).default([])
}).strict().superRefine((proposal, ctx) => {
  if (proposalContainsForbiddenAuthority(proposal)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Adventure scene proposal contains deterministic authority fields.'
    });
  }
});

export type AdventureSceneProposal = z.infer<typeof adventureSceneProposalSchema>;

export interface AdventureSceneAllowedIds {
  entityIds: readonly string[];
  npcIds: readonly string[];
  memoryIds: readonly string[];
}

/**
 * Validate every entity/NPC/memory reference (including dialogue speakers)
 * against the IDs the caller actually placed in bounded context.
 */
export function parseAdventureSceneProposalForContext(
  value: unknown,
  allowed: AdventureSceneAllowedIds
): AdventureSceneProposal {
  const proposal = adventureSceneProposalSchema.parse(value);
  const entities = new Set(allowed.entityIds);
  const npcs = new Set(allowed.npcIds);
  const memories = new Set(allowed.memoryIds);

  const unknownIds = [...new Set([
    ...proposal.referencedEntityIds.filter((id) => !entities.has(id)),
    ...proposal.referencedNpcIds.filter((id) => !npcs.has(id)),
    ...proposal.dialogue.map((d) => d.speakerNpcId).filter((id) => !npcs.has(id)),
    ...proposal.referencedMemoryIds.filter((id) => !memories.has(id))
  ])];

  if (unknownIds.length > 0) {
    throw new ProposalProvenanceError(
      `Adventure scene proposal referenced IDs outside bounded context: ${unknownIds.join(', ')}`,
      unknownIds
    );
  }
  return proposal;
}
