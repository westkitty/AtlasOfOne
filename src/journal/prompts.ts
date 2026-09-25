/**
 * J08 optional, user-requested Journal prompts.
 *
 * Prompts are never shown until Greyson asks for one, never required to save,
 * and never scored. They are deliberately light and non-probing: no questions
 * about pain, diagnosis, or disclosure. A chosen prompt is stored only as the
 * entry's `sourcePrompt` so history can show what it answered.
 */
export const JOURNAL_PROMPTS: readonly string[] = [
  'Something small that went better than expected.',
  'A place you would like to be right now.',
  'What has been taking up space in your head lately?',
  'Something you made, fixed, or figured out.',
  'A conversation you keep thinking about.',
  'What would make tomorrow a little easier?',
  'Something you noticed today that other people might miss.',
  'A thing you are looking forward to.'
];

/** Deterministic rotation: the next prompt after `current`, wrapping. */
export function nextJournalPrompt(current?: string): string {
  const index = current === undefined ? -1 : JOURNAL_PROMPTS.indexOf(current);
  return JOURNAL_PROMPTS[(index + 1) % JOURNAL_PROMPTS.length];
}
