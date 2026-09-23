import { z } from 'zod';

export const journalEntrySchema = z.object({
  id: z.string(),
  createdAt: z.string(),
  text: z.string(),
  inputMode: z.enum(['typed', 'speech-to-text']),
  privacy: z.enum(['normal', 'private']),
  status: z.enum(['active', 'retracted']),
  sourcePrompt: z.string().optional(),
  linkedReflectionIds: z.array(z.string()),
  linkedAdventureIds: z.array(z.string())
});

export type JournalEntry = z.infer<typeof journalEntrySchema>;
