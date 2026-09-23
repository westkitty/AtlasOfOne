import { z } from 'zod';

export const knowledgeGapSchema = z.object({
  id: z.string(),
  kind: z.enum(['unknown', 'contradiction', 'change', 'underexplored', 'curiosity']),
  territoryIds: z.array(z.string()),
  dimensionIds: z.array(z.string()),
  sourceEvidenceIds: z.array(z.string()),
  sourceJournalEntryIds: z.array(z.string()),
  summary: z.string(),
  status: z.enum(['open', 'seeded', 'resolved', 'retired']),
  priority: z.number()
});

export type KnowledgeGap = z.infer<typeof knowledgeGapSchema>;
