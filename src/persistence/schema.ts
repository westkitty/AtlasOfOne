import { z } from 'zod';
import { finalAssessmentSchema } from '../cartographer/finalize';

const timestamp = z.string();
export const campaignStateSchemaV1 = z.object({
  schemaVersion: z.literal(1), campaignId: z.string(),
  player: z.object({ id: z.string(), displayName: z.string(), pronouns: z.string() }),
  settings: z.object({ sass: z.enum(['low','medium','risks-understood']), reducedMotion: z.boolean(), voiceMode: z.enum(['text','talk']) }),
  xp: z.number().nonnegative(), level: z.number().int().min(1).max(8),
  territories: z.array(z.object({ id: z.string(), label: z.string(), status: z.enum(['fogged','discovered','exploring','charted','deeply-charted']), requiredDimensions: z.array(z.string()), coveredDimensions: z.array(z.string()), evidenceIds: z.array(z.string()) })),
  quests: z.array(z.object({ id: z.string(), label: z.string(), description: z.string(), progress: z.number(), target: z.number(), xpBonus: z.number(), status: z.enum(['active','complete']) })),
  achievements: z.array(z.object({ id: z.string(), label: z.string(), description: z.string(), unlockedAt: timestamp.optional() })),
  unlocks: z.array(z.object({ id: z.string(), label: z.string(), description: z.string(), levelRequired: z.number(), unlockedAt: timestamp.optional() })),
  activeTerritory: z.string(), activeQuest: z.string().nullable(),
  turns: z.array(z.object({ id: z.string(), createdAt: timestamp, territoryId: z.string(), dimension: z.string(), question: z.string(), answer: z.string(), substantive: z.boolean(), behavioralExample: z.boolean(), revision: z.boolean(), retracted: z.boolean() })),
  evidence: z.array(z.object({ id: z.string(), dimension: z.string(), claim: z.string(), sourceTurnIds: z.array(z.string()), basis: z.enum(['explicit','example','inference','revision']), strength: z.union([z.literal(1),z.literal(2),z.literal(3)]), territories: z.array(z.string()), counterEvidenceIds: z.array(z.string()), status: z.enum(['active','retracted','contested']), origin: z.enum(['player-stated','model-proposed','engine-derived']).default('model-proposed'), providerId: z.string().optional() })),
  insights: z.array(z.object({ id: z.string(), title: z.string(), summary: z.string(), evidenceIds: z.array(z.string()), confidence: z.enum(['low','moderate','strong']), status: z.enum(['pending','confirmed','rejected']), createdAt: timestamp })),
  contradictions: z.array(z.object({ id: z.string(), claim: z.string(), evidenceIds: z.array(z.string()), status: z.enum(['open','resolved']) })),
  mapFragments: z.array(z.object({ id: z.string(), territoryId: z.string(), label: z.string(), unlockedAt: timestamp })),
  bossRuns: z.array(z.object({ id: z.string(), bossId: z.string(), territoryId: z.string(), stages: z.array(z.object({ id: z.string(), kind: z.enum(['priority','tradeoff','contradiction']), dimensions: z.array(z.string()), evidenceIds: z.array(z.string()), outcome: z.enum(['pending','answered','passed','private']) })), status: z.enum(['active','complete','withdrawn']), startedAt: timestamp, completedAt: timestamp.optional() })).default([]),
  activeBoss: z.string().nullable().default(null),
  doorRuns: z.array(z.object({ id: z.string(), doorId: z.string(), territoryIds: z.array(z.string()), evidenceIds: z.array(z.string()), dimensions: z.array(z.string()), status: z.enum(['open','complete']), openedAt: timestamp, completedAt: timestamp.optional() })).default([]),
  activeDoor: z.string().nullable().default(null),
  privateTopics: z.array(z.string()), presentation: z.enum(['normal','quiet']), sessionStatus: z.enum(['active','paused']), campaignCompleted: z.boolean(),
  presentationQueue: z.array(z.object({ id: z.string(), kind: z.enum(['level','unlock','achievement','quest','territory']), title: z.string(), detail: z.string(), createdAt: timestamp })),
  campaignHistory: z.array(z.object({ id: z.string(), type: z.string(), at: timestamp, detail: z.string().optional() })),
  finalAssessment: finalAssessmentSchema.nullable().optional().default(null),
  updatedAt: timestamp
});
