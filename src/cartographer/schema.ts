import { z } from 'zod';

export const evidenceProposalSchema = z.object({
  dimension: z.string().min(1),
  claim: z.string().min(1),
  basis: z.enum(['explicit', 'example', 'inference', 'revision']),
  strength: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  territories: z.array(z.string().min(1)).min(1)
});

export const cartographerTurnSchema = z.object({
  reply: z.string(),
  nextQuestion: z.string().min(1),
  presentation: z.enum(['normal', 'quiet']),
  evidence: z.array(evidenceProposalSchema),
  connections: z.array(z.object({ evidenceIds: z.array(z.string()), hypothesis: z.string(), confidence: z.enum(['low', 'moderate', 'strong']) })),
  quoteCandidates: z.array(z.string()),
  summaryPatch: z.string(),
  achievementCandidates: z.array(z.string())
});

export type CartographerTurn = z.infer<typeof cartographerTurnSchema>;
