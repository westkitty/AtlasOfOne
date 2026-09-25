import { z } from 'zod';
import { evidenceProposalSchema } from './schema';
import {
  journalProposalEnvelopeSchema,
  proposalContainsForbiddenAuthority
} from './proposals';

const strictEvidenceProposalSchema = evidenceProposalSchema.strict();

export const journalGapCandidateSchema = z.object({
  kind: z.enum(['unknown', 'contradiction', 'change', 'underexplored', 'curiosity']),
  summary: z.string().min(1),
  territoryIds: z.array(z.string().min(1)).min(1),
  dimensionIds: z.array(z.string().min(1)).min(1)
}).strict();

export const exploreLaterSuggestionSchema = z.object({
  label: z.string().min(1),
  /** Index into possibleGapCandidates; the provider never mints a durable gap/seed ID. */
  gapCandidateIndex: z.number().int().nonnegative()
}).strict();

/**
 * P01 Journal proposal.
 *
 * This is acknowledgement/content proposal data only. A follow-up is optional,
 * not a required questionnaire turn. Gap/evidence records remain candidates;
 * deterministic domain code owns eligibility, priority, provenance and durable
 * IDs.
 */
export const journalProposalSchema = journalProposalEnvelopeSchema.extend({
  response: z.string().min(1),
  optionalFollowUp: z.string().min(1).optional(),
  evidence: z.array(strictEvidenceProposalSchema).default([]),
  possibleGapCandidates: z.array(journalGapCandidateSchema).default([]),
  exploreLaterSuggestion: exploreLaterSuggestionSchema.optional()
}).strict().superRefine((proposal, ctx) => {
  const suggestion = proposal.exploreLaterSuggestion;
  if (
    suggestion
    && suggestion.gapCandidateIndex >= proposal.possibleGapCandidates.length
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['exploreLaterSuggestion', 'gapCandidateIndex'],
      message: 'Explore-later suggestion must reference an existing gap candidate.'
    });
  }

  if (proposalContainsForbiddenAuthority(proposal)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Journal proposal contains deterministic authority fields.'
    });
  }
});

export type JournalProposal = z.infer<typeof journalProposalSchema>;
