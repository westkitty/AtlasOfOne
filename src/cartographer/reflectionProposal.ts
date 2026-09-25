import { z } from 'zod';
import {
  proposalContainsForbiddenAuthority,
  reflectionProposalEnvelopeSchema
} from './proposals';

/**
 * P02 Reflection proposal.
 *
 * The provider may suggest one question and an interpretation candidate. It may
 * cite only source IDs already supplied by bounded context. Greyson's decision
 * and deterministic RF02/RF05 conversion remain outside this proposal.
 */
export const reflectionProposalSchema = reflectionProposalEnvelopeSchema.extend({
  question: z.string().min(1),
  interpretationCandidate: z.string().min(1).optional(),
  supportingSourceIds: z.array(z.string().min(1)).default([]),
  uncertaintyStatement: z.string().min(1).optional()
}).strict().superRefine((proposal, ctx) => {
  if (proposal.interpretationCandidate && proposal.supportingSourceIds.length === 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['supportingSourceIds'],
      message: 'Interpretation candidate requires at least one supporting source ID.'
    });
  }

  if (proposalContainsForbiddenAuthority(proposal)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Reflection proposal contains deterministic authority fields.'
    });
  }
});

export type ReflectionProposal = z.infer<typeof reflectionProposalSchema>;
