import { reflectionProposalSchema, type ReflectionProposal } from '../reflectionProposal';
import { fallbackStableIndex } from './stableIndex';

/** P09 bank: open, non-leading questions that carry no interpretation. */
export const REFLECTION_QUESTION_BANK: readonly string[] = [
  'Does any of this feel worth looking at more closely?',
  'Is there anything here you would describe differently now?',
  'What, if anything, stands out to you about this?',
  'Would you like to leave this as it is for now?'
];

/**
 * P09 local reflection wording fallback.
 *
 * Deterministic in `seed` (a non-content ID). Question-only: never an
 * interpretation candidate and never supporting source IDs, so there is no
 * interpretation without provenance.
 */
export function localReflectionWording(seed: string): ReflectionProposal {
  const question = REFLECTION_QUESTION_BANK[
    fallbackStableIndex(seed, REFLECTION_QUESTION_BANK.length)
  ];
  return reflectionProposalSchema.parse({ kind: 'reflection', mode: 'reflection', question });
}
