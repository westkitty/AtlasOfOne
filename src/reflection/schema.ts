import { z } from 'zod';

export const reflectionDecisionSchema = z.enum([
  'confirm',
  'partial',
  'reject',
  'uncertain',
  'revise',
  'private'
]);
export type ReflectionDecision = z.infer<typeof reflectionDecisionSchema>;

export const reflectionEpistemicStatusSchema = z.enum([
  'pending',
  'confirmed',
  'partial',
  'rejected',
  'uncertain'
]);
export type ReflectionEpistemicStatus = z.infer<typeof reflectionEpistemicStatusSchema>;

export const reflectionRecordSchema = z.object({
  id: z.string(),
  sourceKind: z.enum(['journal', 'adventure', 'contradiction', 'insight', 'pattern', 'snapshot']),
  sourceIds: z.array(z.string()),
  question: z.string(),
  response: z.string(),
  interpretation: z.string().optional(),
  decision: reflectionDecisionSchema.optional(),
  epistemicStatus: reflectionEpistemicStatusSchema,
  privacy: z.enum(['normal', 'private']),
  recordStatus: z.enum(['active', 'retracted']),
  createdAt: z.string()
});

export type ReflectionRecord = z.infer<typeof reflectionRecordSchema>;
