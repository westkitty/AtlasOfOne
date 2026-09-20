/**
 * Frozen v2 journal contract. These records are not persisted until the
 * schema-v2 migration lands; journal text remains first-class provenance.
 */
export type JournalInputMode = 'typed' | 'speech-to-text';
export type JournalPrivacy = 'normal' | 'private';
export type JournalStatus = 'active' | 'retracted';

export interface JournalEntry {
  id: string;
  createdAt: string;
  text: string;
  inputMode: JournalInputMode;
  privacy: JournalPrivacy;
  status: JournalStatus;
  sourcePrompt?: string;
  reflectionIds: string[];
  adventureIds: string[];
}
