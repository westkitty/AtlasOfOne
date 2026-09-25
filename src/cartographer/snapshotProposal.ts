import { z } from 'zod';
import {
  proposalContainsForbiddenAuthority,
  snapshotProposalEnvelopeSchema
} from './proposals';
import { ProposalProvenanceError } from './proposalErrors';

export const snapshotClaimSchema = z.object({
  text: z.string().min(1),
  provenanceIds: z.array(z.string().min(1)).min(1)
}).strict();

/**
 * Narrow guard against terminal framing in Snapshot prose. Snapshots are dated
 * and revisable; they never declare Greyson complete or finally assessed.
 * Exact phrase list only — not a general prose classifier.
 */
const FINALITY_PHRASES = [
  /\bfinal (assessment|verdict|answer|word|conclusion)\b/i,
  /\bcomplete (picture|understanding|profile)\b/i,
  /\bfully (understood|mapped|known)\b/i
];

/**
 * P04 Snapshot proposal.
 *
 * Dated, revisable prose. Every claim cites provenance IDs; at least one
 * uncertainty is mandatory; open questions are allowed. The strict envelope
 * rejects finality flags, eligibility fields and diagnosis fields. Snapshot
 * eligibility and persistence remain deterministic TypeScript authority.
 */
export const snapshotProposalSchema = snapshotProposalEnvelopeSchema.extend({
  asOfDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'asOfDate must be YYYY-MM-DD'),
  revisable: z.literal(true),
  summary: z.string().min(1),
  claims: z.array(snapshotClaimSchema).min(1),
  uncertainties: z.array(z.string().min(1)).min(1),
  openQuestions: z.array(z.string().min(1)).default([])
}).strict().superRefine((proposal, ctx) => {
  const prose = [
    proposal.summary,
    ...proposal.claims.map((c) => c.text),
    ...proposal.uncertainties,
    ...proposal.openQuestions
  ];
  if (prose.some((text) => FINALITY_PHRASES.some((re) => re.test(text)))) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Snapshot proposal must not claim finality or completeness.'
    });
  }
  if (proposalContainsForbiddenAuthority(proposal)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Snapshot proposal contains deterministic authority fields.'
    });
  }
});

export type SnapshotProposal = z.infer<typeof snapshotProposalSchema>;

/** Every claim's provenance IDs must come from the supplied bounded context. */
export function parseSnapshotProposalForContext(
  value: unknown,
  allowedProvenanceIds: readonly string[]
): SnapshotProposal {
  const proposal = snapshotProposalSchema.parse(value);
  const allowed = new Set(allowedProvenanceIds);
  const unknownIds = [...new Set(
    proposal.claims.flatMap((c) => c.provenanceIds).filter((id) => !allowed.has(id))
  )];
  if (unknownIds.length > 0) {
    throw new ProposalProvenanceError(
      `Snapshot proposal cited provenance IDs outside bounded context: ${unknownIds.join(', ')}`,
      unknownIds
    );
  }
  return proposal;
}
