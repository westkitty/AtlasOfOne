import { journalProposalSchema, type JournalProposal } from '../journalProposal';
import { fallbackStableIndex } from './stableIndex';

/**
 * P08 bank. Fixed, generic, declarative statements: no questions, and never
 * any fragment of the entry itself.
 */
export const JOURNAL_ACKNOWLEDGEMENT_BANK: readonly string[] = [
  'Noted. This entry is saved in your journal.',
  'Thank you for writing this down. It is kept here for you.',
  'Recorded. You can come back to this whenever you like.',
  'Saved. There is no need to add anything more right now.',
  'Got it. This is part of your journal now.'
];

/**
 * P08 local journal acknowledgement fallback.
 *
 * Deterministic in `seed` (use a non-content ID such as the entry ID — never
 * journal text). The function accepts no journal text at all, so it cannot
 * echo private content. No follow-up question, no evidence, no gap candidates.
 */
export function localJournalAcknowledgement(seed: string): JournalProposal {
  const response = JOURNAL_ACKNOWLEDGEMENT_BANK[
    fallbackStableIndex(seed, JOURNAL_ACKNOWLEDGEMENT_BANK.length)
  ];
  return journalProposalSchema.parse({ kind: 'journal', mode: 'journal', response });
}
